-- Хранимые процедуры для PC Store

-- Процедура для получения заказов пользователя
DELIMITER $$
CREATE PROCEDURE GetUserOrders(IN user_id INT)
BEGIN
    SELECT 
        o.id,
        o.total,
        o.status,
        o.created_at,
        COUNT(oi.id) as items_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = user_id
    GROUP BY o.id
    ORDER BY o.created_at DESC;
END$$
DELIMITER ;

-- Процедура для получения популярных товаров
DELIMITER $$
CREATE PROCEDURE GetPopularProducts(IN limit_count INT)
BEGIN
    SELECT 
        p.*,
        c.name as category_name,
        SUM(oi.quantity) as total_sold
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN order_items oi ON p.id = oi.product_id
    WHERE p.is_active = TRUE
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT limit_count;
END$$
DELIMITER ;

-- Процедура для создания заказа
DELIMITER $$
CREATE PROCEDURE CreateOrderWithItems(
    IN p_user_id INT,
    IN p_total DECIMAL(10,2),
    IN p_shipping_address TEXT,
    IN p_customer_name VARCHAR(100),
    IN p_customer_email VARCHAR(100),
    IN p_customer_phone VARCHAR(20)
)
BEGIN
    DECLARE new_order_id INT;
    
    -- Создаем заказ
    INSERT INTO orders (user_id, total, shipping_address, customer_name, customer_email, customer_phone)
    VALUES (p_user_id, p_total, p_shipping_address, p_customer_name, p_customer_email, p_customer_phone);
    
    SET new_order_id = LAST_INSERT_ID();
    
    SELECT new_order_id as order_id;
END$$
DELIMITER ;

-- Процедура для получения статистики продаж
DELIMITER $$
CREATE PROCEDURE GetSalesStatistics(IN start_date DATE, IN end_date DATE)
BEGIN
    SELECT 
        DATE(o.created_at) as sale_date,
        COUNT(*) as orders_count,
        SUM(o.total) as total_revenue,
        SUM(oi.quantity) as items_sold
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE DATE(o.created_at) BETWEEN start_date AND end_date
    AND o.status != 'cancelled'
    GROUP BY DATE(o.created_at)
    ORDER BY sale_date;
END$$
DELIMITER ;