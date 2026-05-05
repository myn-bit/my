-- =============================================
-- FIX_updated_at_fixed.sql
-- Исправление с учетом текущей структуры таблицы
-- =============================================

BEGIN TRANSACTION;

PRAGMA foreign_keys = OFF;

-- 1. Сначала узнаем текущую структуру таблицы
DROP TABLE IF EXISTS orders_structure;
CREATE TEMP TABLE orders_structure AS 
SELECT * FROM pragma_table_info('orders');

-- 2. Создаем временную таблицу с данными
DROP TABLE IF EXISTS orders_temp;
CREATE TABLE orders_temp AS SELECT * FROM orders;

-- 3. Удаляем оригинальную таблицу
DROP TABLE IF EXISTS orders;

-- 4. Создаем новую таблицу с правильной структурой
--    Мы сохраняем все существующие колонки и добавляем нужные
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL DEFAULT ('ORD-' || (strftime('%Y%m%d%H%M%S') || '-' || substr('00000' || abs(random() % 100000), -5))),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    shipping_address TEXT NOT NULL,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    delivery_method VARCHAR(50) NOT NULL DEFAULT 'courier',
    delivery_cost DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'card',
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Определяем, какие колонки нужно копировать
--    Создаем динамический SQL для вставки данных

-- 6. Сначала вставляем данные, которые точно есть
INSERT INTO orders (id, user_id, total_amount, status, shipping_address, created_at, updated_at)
SELECT 
    id, 
    user_id, 
    COALESCE(total_amount, 0) as total_amount,
    COALESCE(status, 'pending') as status,
    COALESCE(shipping_address, 'Адрес не указан') as shipping_address,
    COALESCE(created_at, CURRENT_TIMESTAMP) as created_at,
    COALESCE(created_at, CURRENT_TIMESTAMP) as updated_at
FROM orders_temp;

-- 7. Теперь добавляем недостающие колонки если они есть
--    Проверяем и добавляем колонку 'city' если она была
UPDATE orders 
SET city = (
    SELECT city FROM orders_temp WHERE orders_temp.id = orders.id
)
WHERE EXISTS (SELECT 1 FROM orders_temp WHERE orders_temp.id = orders.id AND orders_temp.city IS NOT NULL);

-- Проверяем и добавляем колонку 'postal_code' если она была
UPDATE orders 
SET postal_code = (
    SELECT postal_code FROM orders_temp WHERE orders_temp.id = orders.id
)
WHERE EXISTS (SELECT 1 FROM orders_temp WHERE orders_temp.id = orders.id AND orders_temp.postal_code IS NOT NULL);

-- Проверяем и добавляем колонку 'delivery_method' если она была
UPDATE orders 
SET delivery_method = (
    SELECT delivery_method FROM orders_temp WHERE orders_temp.id = orders.id
)
WHERE EXISTS (SELECT 1 FROM orders_temp WHERE orders_temp.id = orders.id AND orders_temp.delivery_method IS NOT NULL);

-- Проверяем и добавляем колонку 'delivery_cost' если она была
UPDATE orders 
SET delivery_cost = (
    SELECT delivery_cost FROM orders_temp WHERE orders_temp.id = orders.id
)
WHERE EXISTS (SELECT 1 FROM orders_temp WHERE orders_temp.id = orders.id AND orders_temp.delivery_cost IS NOT NULL);

-- Проверяем и добавляем колонку 'payment_method' если она была
UPDATE orders 
SET payment_method = (
    SELECT payment_method FROM orders_temp WHERE orders_temp.id = orders.id
)
WHERE EXISTS (SELECT 1 FROM orders_temp WHERE orders_temp.id = orders.id AND orders_temp.payment_method IS NOT NULL);

-- Проверяем и добавляем колонку 'comments' если она была
UPDATE orders 
SET comments = (
    SELECT comments FROM orders_temp WHERE orders_temp.id = orders.id
)
WHERE EXISTS (SELECT 1 FROM orders_temp WHERE orders_temp.id = orders.id AND orders_temp.comments IS NOT NULL);

-- 8. Генерируем уникальные номера заказов для существующих записей
UPDATE orders 
SET order_number = 'ORD-' || substr('000000' || id, -6) || '-' || strftime('%Y%m%d')
WHERE order_number IS NULL OR order_number = '';

-- 9. Создаем триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at;
CREATE TRIGGER update_orders_updated_at
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    UPDATE orders 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- 10. Создаем индексы
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- 11. Удаляем временные таблицы
DROP TABLE IF EXISTS orders_temp;
DROP TABLE IF EXISTS orders_structure;

PRAGMA foreign_keys = ON;

COMMIT;

-- =============================================
-- Проверка
-- =============================================
SELECT '✅ УСПЕШНО: Таблица orders обновлена!' as message;

-- Показываем несколько записей для проверки
SELECT 
    id, 
    order_number, 
    status, 
    DATE(created_at) as created_date,
    DATE(updated_at) as updated_date
FROM orders 
LIMIT 5;