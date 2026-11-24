const { getConnection } = require('../database');

const maxBalance = 2n ** 64n - 1n;
let schemaReady;

async function getPlayerPool() {
    const pool = getConnection();
    schemaReady ??= pool.query(`
        CREATE TABLE IF NOT EXISTS fun_players (
            user_id VARCHAR(20) CHARACTER SET ascii PRIMARY KEY,
            balance BIGINT UNSIGNED NOT NULL DEFAULT 0
        ) ENGINE=InnoDB
    `).catch(error => {
        schemaReady = undefined;
        throw error;
    });
    await schemaReady;
    return pool;
}

function validateUserId(userId) {
    if (typeof userId !== 'string' || !/^[1-9]\d{0,19}$/.test(userId)) {
        throw new TypeError('Expected a Discord user ID string.');
    }
}

async function getBalance(userId) {
    validateUserId(userId);
    const pool = await getPlayerPool();
    const [rows] = await pool.execute('SELECT balance FROM fun_players WHERE user_id = ?', [userId]);
    return BigInt(rows[0]?.balance ?? 0);
}

async function adjustBalance(userId, delta) {
    validateUserId(userId);
    if (typeof delta !== 'bigint') {
        throw new TypeError('Expected a bigint balance adjustment.');
    }

    const pool = await getPlayerPool();
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
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
            await connection.rollback();
            return { ok: false, reason: balance < 0n ? 'insufficient_funds' : 'overflow' };
        }

        await connection.execute('UPDATE fun_players SET balance = ? WHERE user_id = ?', [balance.toString(), userId]);
        await connection.commit();
        return { ok: true, balance };
    } catch (error) {
        await connection.rollback().catch(() => connection.destroy());
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { getBalance, adjustBalance };
