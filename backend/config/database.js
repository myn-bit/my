const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, '..', 'database.sqlite');

// Создаем соединение с базой данных
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
    } else {
        console.log('Подключение к базе данных успешно!');
        // Включаем внешние ключи
        db.run("PRAGMA foreign_keys = ON");
    }
});

// Обертка для асинхронных операций с базой данных
const database = {
    // Выполнить запрос с возвратом всех строк
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Ошибка выполнения запроса all:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },
    
    // Выполнить запрос с возвратом одной строки
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('Ошибка выполнения запроса get:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    
    // Выполнить запрос без возврата данных (INSERT, UPDATE, DELETE)
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) {
                    console.error('Ошибка выполнения запроса run:', err);
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    },
    
    // Выполнить несколько запросов в транзакции
    exec: (sql) => {
        return new Promise((resolve, reject) => {
            db.exec(sql, (err) => {
                if (err) {
                    console.error('Ошибка выполнения exec:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
    
    // Закрыть соединение с базой данных
    close: () => {
        db.close();
    }
};

module.exports = database;