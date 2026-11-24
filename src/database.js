const { escapeId } = require('mysql2');
const { createPool } = require('mysql2/promise');
const { getMysqlConfig } = require('./config');

let pool;
let poolOptions;

function getConnection() {
    if (!pool) {
        poolOptions = {
            ...getMysqlConfig(),
            supportBigNumbers: true,
            bigNumberStrings: true,
        };
        pool = createPool(poolOptions);
    }
    return pool;
}

async function ensureDatabase() {
    const connectionPool = getConnection();
    try {
        await connectionPool.query('SELECT 1');
    } catch (error) {
        if (error.code !== 'ER_BAD_DB_ERROR') throw error;

        const { database, ...serverOptions } = poolOptions;
        const provisioningPool = createPool({ ...serverOptions, connectionLimit: 1 });
        try {
            await provisioningPool.query(`CREATE DATABASE IF NOT EXISTS ${escapeId(database, true)}`);
        } finally {
            await provisioningPool.end();
        }
    }
    return connectionPool;
}

module.exports = { getConnection, ensureDatabase };
