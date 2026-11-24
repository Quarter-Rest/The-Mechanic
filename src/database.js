const { createPool } = require('mysql2/promise');
const { getMysqlConfig } = require('./config');

let pool;

function getConnection() {
    pool ??= createPool({
        ...getMysqlConfig(),
        supportBigNumbers: true,
        bigNumberStrings: true,
    });
    return pool;
}

module.exports = { getConnection };
