const { createConnection } = require('mysql2');

let connection = null;

function connect(config) {
    connection = createConnection(config);

    connection.connect(err => {
        if (err) {
            console.error('MySQL connection error:', err);
            return;
        }
        console.log('MySQL connected successfully');
    });

    connection.on('error', err => {
        console.error('MySQL error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            connect(config);
        }
    });

    return connection;
}

function getConnection() {
    return connection;
}

module.exports = { connect, getConnection };
