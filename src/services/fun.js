const { setTimeout: sleep } = require('node:timers/promises');
const { ensureDatabase } = require('../database');

const maxBalance = 2n ** 64n - 1n;
const writeRetryDelays = [250, 1000, 5000];
const retryableWriteErrors = new Set([
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOENT',
    'EPIPE',
    'ETIMEDOUT',
    'ER_CON_COUNT_ERROR',
    'ER_LOCK_DEADLOCK',
    'ER_LOCK_WAIT_TIMEOUT',
    'ER_SERVER_SHUTDOWN',
    'PROTOCOL_CONNECTION_LOST',
]);
let playerSchema;
let rewardSchema;
let paymentSchema;

async function preparePlayers() {
    const pool = await ensureDatabase();
    await pool.query(`
        CREATE TABLE IF NOT EXISTS fun_players (
            user_id VARCHAR(20) CHARACTER SET ascii PRIMARY KEY,
            balance BIGINT UNSIGNED NOT NULL DEFAULT 0
        ) ENGINE=InnoDB
    `);
    return pool;
}

function getPlayerPool() {
    playerSchema ??= preparePlayers().catch(error => {
        playerSchema = undefined;
        throw error;
    });
    return playerSchema;
}

async function prepareMessageRewards() {
    const pool = await getPlayerPool();
    await pool.query(`
        CREATE TABLE IF NOT EXISTS fun_message_rewards (
            message_id BIGINT UNSIGNED PRIMARY KEY
        ) ENGINE=InnoDB
    `);
    return pool;
}

function getRewardPool() {
    rewardSchema ??= prepareMessageRewards().catch(error => {
        rewardSchema = undefined;
        throw error;
    });
    return rewardSchema;
}

async function preparePayments() {
    const pool = await getPlayerPool();
    await pool.query(`
        CREATE TABLE IF NOT EXISTS fun_payments (
            payment_id BIGINT UNSIGNED PRIMARY KEY
        ) ENGINE=InnoDB
    `);
    return pool;
}

function getPaymentPool() {
    paymentSchema ??= preparePayments().catch(error => {
        paymentSchema = undefined;
        throw error;
    });
    return paymentSchema;
}

async function initialize() {
    await Promise.all([getRewardPool(), getPaymentPool()]);
}

function validateDiscordId(id, kind) {
    if (typeof id !== 'string' || !/^[1-9]\d{0,19}$/.test(id)) {
        throw new TypeError(`Expected a Discord ${kind} ID string.`);
    }
}

async function getBalance(userId) {
    validateDiscordId(userId, 'user');
    const pool = await getPlayerPool();
    const [rows] = await pool.execute('SELECT balance FROM fun_players WHERE user_id = ?', [userId]);
    return BigInt(rows[0]?.balance ?? 0);
}

async function withTransaction(pool, work) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        if (result.ok) {
            await connection.commit();
        } else {
            await connection.rollback();
        }
        return result;
    } catch (error) {
        await connection.rollback().catch(() => connection.destroy());
        throw error;
    } finally {
        connection.release();
    }
}

async function lockPlayerBalance(connection, userId) {
    // Give concurrent updates a row to lock, including a player's first transaction.
    await connection.execute(
        'INSERT INTO fun_players (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id',
        [userId],
    );
    const [rows] = await connection.execute(
        'SELECT balance FROM fun_players WHERE user_id = ? FOR UPDATE',
        [userId],
    );
    return BigInt(rows[0].balance);
}

async function updateBalance(connection, userId, balance) {
    await connection.execute('UPDATE fun_players SET balance = ? WHERE user_id = ?', [balance.toString(), userId]);
}

async function adjustBalance(userId, delta) {
    validateDiscordId(userId, 'user');
    if (typeof delta !== 'bigint') {
        throw new TypeError('Expected a bigint balance adjustment.');
    }

    const pool = await getPlayerPool();
    return withTransaction(pool, async connection => {
        const balance = await lockPlayerBalance(connection, userId) + delta;
        if (balance < 0n || balance > maxBalance) {
            return { ok: false, reason: balance < 0n ? 'insufficient_funds' : 'overflow' };
        }

        await updateBalance(connection, userId, balance);
        return { ok: true, balance };
    });
}

async function retryIdempotentWrite(write) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await write();
        } catch (error) {
            const delay = writeRetryDelays[attempt];
            if (delay === undefined || !retryableWriteErrors.has(error.code)) throw error;
            await sleep(delay);
        }
    }
}

async function applyTransfer(senderId, recipientId, amount, paymentId) {
    const pool = await getPaymentPool();
    return withTransaction(pool, async connection => {
        try {
            await connection.execute('INSERT INTO fun_payments (payment_id) VALUES (?)', [paymentId]);
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return { ok: false, reason: 'already_paid' };
            throw error;
        }

        // Lock accounts in the same order even when the payment goes in the opposite direction.
        const balances = new Map();
        for (const userId of [senderId, recipientId].sort()) {
            balances.set(userId, await lockPlayerBalance(connection, userId));
        }

        const senderBalance = balances.get(senderId) - amount;
        if (senderBalance < 0n) return { ok: false, reason: 'insufficient_funds' };

        const recipientBalance = balances.get(recipientId) + amount;
        if (recipientBalance > maxBalance) return { ok: false, reason: 'overflow' };

        await updateBalance(connection, senderId, senderBalance);
        await updateBalance(connection, recipientId, recipientBalance);
        return { ok: true, senderBalance };
    });
}

async function transferBalance(senderId, recipientId, amount, paymentId) {
    validateDiscordId(senderId, 'sender');
    validateDiscordId(recipientId, 'recipient');
    validateDiscordId(paymentId, 'payment');
    if (senderId === recipientId) throw new RangeError('Expected two different players.');
    if (typeof amount !== 'bigint' || amount <= 0n) throw new RangeError('Expected a positive bigint amount.');

    return retryIdempotentWrite(() => applyTransfer(senderId, recipientId, amount, paymentId));
}

async function applyMessageReward(userId, messageId) {
    const pool = await getRewardPool();
    return withTransaction(pool, async connection => {
        // Commit the receipt and the credit together so retries can safely reuse the message ID.
        try {
            await connection.execute('INSERT INTO fun_message_rewards (message_id) VALUES (?)', [messageId]);
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return { ok: false, reason: 'already_rewarded' };
            throw error;
        }

        await connection.execute(`
            INSERT INTO fun_players (user_id, balance) VALUES (?, 1)
            ON DUPLICATE KEY UPDATE balance = IF(balance < ${maxBalance}, balance + 1, balance)
        `, [userId]);
        return { ok: true };
    });
}

async function rewardMessage(userId, messageId) {
    validateDiscordId(userId, 'user');
    validateDiscordId(messageId, 'message');
    return retryIdempotentWrite(() => applyMessageReward(userId, messageId));
}

module.exports = { initialize, getBalance, adjustBalance, transferBalance, rewardMessage };
