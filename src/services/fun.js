const { setTimeout: sleep } = require('node:timers/promises');
const { ensureDatabase } = require('../database');

const maxBalance = 2n ** 64n - 1n;
const rewardRetryDelays = [250, 1000, 5000];
const retryableRewardErrors = new Set([
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

async function initialize() {
    await getRewardPool();
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

async function adjustBalance(userId, delta) {
    validateDiscordId(userId, 'user');
    if (typeof delta !== 'bigint') {
        throw new TypeError('Expected a bigint balance adjustment.');
    }

    const pool = await getPlayerPool();
    return withTransaction(pool, async connection => {
        // Give concurrent adjustments a row to lock, including a player's first adjustment.
        await connection.execute(
            'INSERT INTO fun_players (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id',
            [userId],
        );
        const [rows] = await connection.execute(
            'SELECT balance FROM fun_players WHERE user_id = ? FOR UPDATE',
            [userId],
        );
        const balance = BigInt(rows[0].balance) + delta;
        if (balance < 0n || balance > maxBalance) {
            return { ok: false, reason: balance < 0n ? 'insufficient_funds' : 'overflow' };
        }

        await connection.execute('UPDATE fun_players SET balance = ? WHERE user_id = ?', [balance.toString(), userId]);
        return { ok: true, balance };
    });
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

    for (let attempt = 0; ; attempt++) {
        try {
            return await applyMessageReward(userId, messageId);
        } catch (error) {
            const delay = rewardRetryDelays[attempt];
            if (delay === undefined || !retryableRewardErrors.has(error.code)) throw error;
            await sleep(delay);
        }
    }
}

module.exports = { initialize, getBalance, adjustBalance, rewardMessage };
