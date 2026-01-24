// Подключение к MySQL
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pc_store',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Тестовое подключение
pool.getConnection()
    .then(connection => {
        console.log('✅ Подключение к базе данных установлено');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Ошибка подключения к базе данных:', err.message);
    });

module.exports = pool;