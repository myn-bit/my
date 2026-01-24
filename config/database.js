// Конфигурация базы данных
module.exports = {
    development: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'pc_store',
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    },
    test: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'pc_store_test',
        connectionLimit: 5
    },
    production: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        connectionLimit: 20,
        waitForConnections: true,
        queueLimit: 0
    }
};