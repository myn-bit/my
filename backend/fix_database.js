const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Завершаю исправление таблицы orders...\n');

// Дополнительные команды для фиксации
const fixCommands = [
    // 1. Удаляем колонку updated_at если она есть (но с ошибкой)
    `ALTER TABLE orders DROP COLUMN updated_at;`,
    
    // 2. Добавляем колонку без дефолта
    `ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP;`,
    
    // 3. Устанавливаем значение updated_at равным created_at
    `UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;`,
    
    // 4. Для записей где created_at NULL, устанавливаем текущее время
    `UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;`,
    
    // 5. Создаем новый триггер (пересоздаем на всякий случай)
    `DROP TRIGGER IF EXISTS update_orders_updated_at;`,
    `CREATE TRIGGER update_orders_updated_at
     AFTER UPDATE ON orders
     FOR EACH ROW
     BEGIN
         UPDATE orders 
         SET updated_at = CURRENT_TIMESTAMP 
         WHERE id = NEW.id;
     END;`
];

function executeFixCommands() {
    console.log('🔄 Выполняю финальные исправления...\n');
    
    // Используем сериализованное выполнение для контроля порядка
    db.serialize(() => {
        // Попробуем удалить колонку updated_at если она есть
        db.run(`ALTER TABLE orders DROP COLUMN updated_at;`, function(err) {
            if (err) {
                console.log('⚠️  Не удалось удалить колонку updated_at (возможно её нет):', err.message);
            } else {
                console.log('✅ Колонка updated_at удалена');
            }
            
            // Добавляем колонку без дефолта
            db.run(`ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP;`, function(err) {
                if (err) {
                    console.log('❌ Ошибка при добавлении колонки updated_at:', err.message);
                    console.log('\n🔄 Пробую альтернативный подход...');
                    recreateTable();
                    return;
                }
                
                console.log('✅ Колонка updated_at добавлена');
                
                // Устанавливаем значения
                db.run(`UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;`, function(err) {
                    if (err) {
                        console.log('⚠️  Ошибка при установке значений:', err.message);
                    } else {
                        console.log(`✅ Значения updated_at установлены (изменено ${this.changes} записей)`);
                    }
                    
                    // Устанавливаем CURRENT_TIMESTAMP для NULL значений
                    db.run(`UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;`, function(err) {
                        if (err) {
                            console.log('⚠️  Ошибка при установке текущего времени:', err.message);
                        } else if (this.changes > 0) {
                            console.log(`✅ Установлено текущее время для ${this.changes} записей`);
                        }
                        
                        // Пересоздаем триггер
                        db.run(`DROP TRIGGER IF EXISTS update_orders_updated_at;`, function(err) {
                            if (err) {
                                console.log('⚠️  Ошибка при удалении триггера:', err.message);
                            }
                            
                            db.run(`
                                CREATE TRIGGER update_orders_updated_at
                                AFTER UPDATE ON orders
                                FOR EACH ROW
                                BEGIN
                                    UPDATE orders 
                                    SET updated_at = CURRENT_TIMESTAMP 
                                    WHERE id = NEW.id;
                                END;
                            `, function(err) {
                                if (err) {
                                    console.log('❌ Ошибка при создании триггера:', err.message);
                                } else {
                                    console.log('✅ Триггер update_orders_updated_at создан');
                                }
                                
                                showFinalResult();
                            });
                        });
                    });
                });
            });
        });
    });
}

function recreateTable() {
    console.log('\n🔄 Пересоздаю таблицу orders с правильной структурой...');
    
    db.serialize(() => {
        // 1. Переименовываем существующую таблицу
        db.run(`ALTER TABLE orders RENAME TO orders_backup;`, function(err) {
            if (err) {
                console.log('❌ Ошибка переименования:', err.message);
                return;
            }
            
            console.log('✅ Существующая таблица переименована в orders_backup');
            
            // 2. Создаем новую таблицу с правильной структурой
            const createTableSQL = `
                CREATE TABLE orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    total_amount REAL NOT NULL,
                    status TEXT DEFAULT 'pending',
                    shipping_address TEXT,
                    payment_method TEXT,
                    notes TEXT,
                    city VARCHAR(100),
                    postal_code VARCHAR(20),
                    delivery_method VARCHAR(50),
                    delivery_cost DECIMAL(10,2) DEFAULT 0,
                    comments TEXT,
                    order_number VARCHAR(50),
                    created_at DATETIME,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;
            
            db.run(createTableSQL, function(err) {
                if (err) {
                    console.log('❌ Ошибка создания таблицы:', err.message);
                    return;
                }
                
                console.log('✅ Новая таблица orders создана');
                
                // 3. Копируем данные из backup
                const copyDataSQL = `
                    INSERT INTO orders (
                        id, user_id, total_amount, status, shipping_address, 
                        payment_method, notes, city, postal_code, delivery_method,
                        delivery_cost, comments, order_number, created_at, updated_at
                    )
                    SELECT 
                        id, user_id, total_amount, status, shipping_address,
                        payment_method, notes, city, postal_code, delivery_method,
                        delivery_cost, comments, order_number, created_at,
                        COALESCE(created_at, CURRENT_TIMESTAMP)
                    FROM orders_backup
                `;
                
                db.run(copyDataSQL, function(err) {
                    if (err) {
                        console.log('❌ Ошибка копирования данных:', err.message);
                        return;
                    }
                    
                    console.log(`✅ Данные скопированы (${this.changes} записей)`);
                    
                    // 4. Удаляем backup таблицу
                    db.run(`DROP TABLE orders_backup;`, function(err) {
                        if (err) {
                            console.log('⚠️  Не удалось удалить backup таблицу:', err.message);
                        } else {
                            console.log('✅ Backup таблица удалена');
                        }
                        
                        // 5. Создаем триггер
                        db.run(`
                            CREATE TRIGGER update_orders_updated_at
                            AFTER UPDATE ON orders
                            FOR EACH ROW
                            BEGIN
                                UPDATE orders 
                                SET updated_at = CURRENT_TIMESTAMP 
                                WHERE id = NEW.id;
                            END;
                        `, function(err) {
                            if (err) {
                                console.log('❌ Ошибка создания триггера:', err.message);
                            } else {
                                console.log('✅ Триггер update_orders_updated_at создан');
                            }
                            
                            showFinalResult();
                        });
                    });
                });
            });
        });
    });
}

function showFinalResult() {
    console.log('\n📋 Проверяю итоговую структуру...');
    console.log('='.repeat(60));
    
    db.all("PRAGMA table_info(orders)", (err, columns) => {
        if (err) {
            console.error('❌ Ошибка при проверке структуры:', err.message);
            db.close();
            return;
        }
        
        console.log('Структура таблицы orders:');
        columns.forEach(col => {
            const pk = col.pk ? 'PK' : '';
            console.log(`  ${col.cid.toString().padStart(2)}. ${col.name.padEnd(20)} ${col.type.padEnd(15)} ${pk}`);
        });
        
        console.log('='.repeat(60));
        
        // Проверяем наличие updated_at
        const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
        
        if (hasUpdatedAt) {
            console.log('✅ Колонка updated_at присутствует в таблице');
            
            // Проверяем данные
            db.all("SELECT id, order_number, status, DATE(created_at) as created, DATE(updated_at) as updated FROM orders LIMIT 5", (err, rows) => {
                if (err) {
                    console.error('Ошибка при чтении данных:', err.message);
                } else {
                    console.log('\n📊 Пример данных:');
                    console.table(rows);
                }
                
                // Тестируем триггер
                testTrigger();
            });
        } else {
            console.log('❌ Колонка updated_at отсутствует!');
            db.close();
        }
    });
}

function testTrigger() {
    console.log('\n🧪 Тестирую работу триггера...');
    
    // Находим любой заказ для теста
    db.get("SELECT id, updated_at FROM orders ORDER BY id LIMIT 1", (err, row) => {
        if (err || !row) {
            console.log('⚠️  Не удалось найти запись для теста');
            db.close();
            return;
        }
        
        const testId = row.id;
        const oldUpdatedAt = row.updated_at;
        
        console.log(`   Заказ ID: ${testId}`);
        console.log(`   Текущее updated_at: ${oldUpdatedAt}`);
        
        // Ждем 1 секунду чтобы время изменилось
        setTimeout(() => {
            // Обновляем статус
            db.run("UPDATE orders SET status = 'test_' || CURRENT_TIMESTAMP WHERE id = ?", [testId], function(err) {
                if (err) {
                    console.log('   ❌ Ошибка при обновлении:', err.message);
                    db.close();
                    return;
                }
                
                // Проверяем обновленное значение
                db.get("SELECT updated_at FROM orders WHERE id = ?", [testId], (err, newRow) => {
                    if (err) {
                        console.log('   ❌ Ошибка при чтении:', err.message);
                        db.close();
                        return;
                    }
                    
                    console.log(`   Новое updated_at: ${newRow.updated_at}`);
                    
                    if (newRow.updated_at !== oldUpdatedAt) {
                        console.log('   ✅ Триггер работает! updated_at обновлен автоматически');
                        
                        // Восстанавливаем исходный статус
                        db.run("UPDATE orders SET status = 'pending' WHERE id = ?", [testId], () => {
                            console.log('\n🎉 ВСЕ ИСПРАВЛЕНИЯ ЗАВЕРШЕНЫ УСПЕШНО!');
                            console.log('🚀 Перезапустите сервер командой: npm start');
                            db.close();
                        });
                    } else {
                        console.log('   ⚠️  Триггер не сработал, updated_at не изменился');
                        console.log('\n💡 Попробуйте простой фикс:');
                        console.log('1. Откройте database.db в DB Browser for SQLite');
                        console.log('2. Выполните команду:');
                        console.log('   ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP;');
                        console.log('   UPDATE orders SET updated_at = CURRENT_TIMESTAMP;');
                        console.log('3. Сохраните изменения');
                        db.close();
                    }
                });
            });
        }, 1000);
    });
}

// Запускаем финальные исправления
executeFixCommands();