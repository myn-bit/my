const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Проверяю структуру таблицы orders...\n');

// 1. Проверяем структуру таблицы orders
db.all("PRAGMA table_info(orders)", (err, columns) => {
    if (err) {
        console.error('❌ Ошибка при проверке структуры orders:', err.message);
        
        // Проверяем, существует ли таблица
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'", (err, rows) => {
            if (err) {
                console.error('Ошибка проверки существования таблицы:', err.message);
            } else if (rows.length === 0) {
                console.log('⚠️ Таблица orders не существует!');
            } else {
                console.log('✅ Таблица orders существует');
            }
            db.close();
        });
        return;
    }
    
    console.log('📋 Структура таблицы orders:');
    console.log('='.repeat(50));
    columns.forEach(col => {
        console.log(`${col.cid}. ${col.name} (${col.type}) - ${col.notnull ? 'NOT NULL' : 'NULLABLE'}`);
    });
    console.log('='.repeat(50));
    
    // 2. Проверяем данные в таблице
    db.all("SELECT * FROM orders LIMIT 3", (err, rows) => {
        if (err) {
            console.error('Ошибка при чтении данных:', err.message);
        } else {
            console.log('\n📊 Пример данных (первые 3 записи):');
            console.log(JSON.stringify(rows, null, 2));
        }
        
        // 3. Проверяем существующие триггеры
        db.all("SELECT name, sql FROM sqlite_master WHERE type = 'trigger'", (err, triggers) => {
            if (err) {
                console.error('Ошибка при проверке триггеров:', err.message);
            } else if (triggers.length > 0) {
                console.log('\n🔧 Существующие триггеры:');
                triggers.forEach(trigger => {
                    console.log(`- ${trigger.name}`);
                });
            }
            
            db.close();
        });
    });
});