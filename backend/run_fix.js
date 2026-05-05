const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к вашей базе данных
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Начинаю исправление таблицы orders...');
console.log('📁 База данных:', dbPath);

// Читаем SQL-скрипт
const sql = fs.readFileSync('fix_updated_at.sql', 'utf8');

// Выполняем SQL-скрипт
db.exec(sql, function(err) {
    if (err) {
        console.error('❌ ОШИБКА:', err.message);
        console.error('Детали:', err);
    } else {
        console.log('✅ SQL скрипт успешно выполнен!');
        
        // Дополнительная проверка
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'", (err, rows) => {
            if (err) {
                console.error('Ошибка проверки:', err.message);
            } else if (rows.length > 0) {
                console.log('✅ Таблица orders существует');
                
                // Проверяем наличие колонки updated_at
                db.all("PRAGMA table_info(orders)", (err, columns) => {
                    if (err) {
                        console.error('Ошибка проверки структуры:', err.message);
                    } else {
                        const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
                        if (hasUpdatedAt) {
                            console.log('✅ Колонка updated_at добавлена');
                            console.log('🎉 Исправление завершено успешно!');
                        } else {
                            console.log('❌ Колонка updated_at не найдена');
                        }
                    }
                    db.close();
                });
            } else {
                console.log('❌ Таблица orders не найдена');
                db.close();
            }
        });
    }
});