const express = require('express');
const router = express.Router();
const { pool } = require('./db');
const authenticateToken = require('./middleware/auth');

// Создание заказа
router.post('/', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const {
            items,
            totalAmount,
            deliveryMethod = 'pickup',
            deliveryCost = 0,
            shippingAddress = 'Самовывоз',
            paymentMethod = 'card',
            notes = ''
        } = req.body;
        
        const userId = req.user.id;
        
        console.log('📝 Создание заказа для пользователя ID:', userId);
        console.log('📦 Товары:', items);
        console.log('🚚 Способ доставки:', deliveryMethod);
        console.log('🏠 Адрес доставки:', shippingAddress);
        
        // Начинаем транзакцию
        await client.query('BEGIN');
        
        // Создаем заказ
        const orderQuery = `
            INSERT INTO orders (
                user_id, total_amount, status, 
                delivery_method, delivery_cost, shipping_address,
                payment_method, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, created_at
        `;
        
        const orderResult = await client.query(orderQuery, [
            userId,
            totalAmount,
            'pending', // статус по умолчанию
            deliveryMethod,
            deliveryCost,
            shippingAddress,
            paymentMethod,
            notes
        ]);
        
        const orderId = orderResult.rows[0].id;
        
        // Добавляем товары в заказ
        const orderItemsQuery = `
            INSERT INTO order_items (
                order_id, product_id, quantity, price, product_name
            ) VALUES ($1, $2, $3, $4, $5)
        `;
        
        for (const item of items) {
            await client.query(orderItemsQuery, [
                orderId,
                item.productId,
                item.quantity,
                item.price,
                item.productName || `Товар #${item.productId}`
            ]);
        }
        
        // Завершаем транзакцию
        await client.query('COMMIT');
        
        // Получаем полную информацию о заказе
        const fullOrderQuery = `
            SELECT 
                o.*,
                u.username as user_name,
                u.email as user_email,
                json_agg(
                    json_build_object(
                        'product_id', oi.product_id,
                        'product_name', oi.product_name,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'total', oi.quantity * oi.price
                    )
                ) as items
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = $1
            GROUP BY o.id, u.username, u.email
        `;
        
        const fullOrderResult = await client.query(fullOrderQuery, [orderId]);
        
        res.json({
            success: true,
            message: 'Заказ успешно создан',
            order: fullOrderResult.rows[0]
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка создания заказа:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка создания заказа',
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Получение заказов пользователя
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const query = `
            SELECT 
                o.*,
                json_agg(
                    json_build_object(
                        'product_id', oi.product_id,
                        'product_name', oi.product_name,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'total', oi.quantity * oi.price
                    )
                ) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.user_id = $1
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `;
        
        const result = await pool.query(query, [userId]);
        
        res.json({
            success: true,
            orders: result.rows
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения заказов:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения заказов',
            error: error.message
        });
    }
});

// Получение всех заказов (для админа)
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Доступ запрещен'
            });
        }
        
        const query = `
            SELECT 
                o.*,
                u.username as user_name,
                u.email as user_email,
                json_agg(
                    json_build_object(
                        'product_id', oi.product_id,
                        'product_name', oi.product_name,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'total', oi.quantity * oi.price
                    )
                ) as items
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            GROUP BY o.id, u.username, u.email
            ORDER BY o.created_at DESC
        `;
        
        const result = await pool.query(query);
        
        res.json({
            success: true,
            orders: result.rows
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения заказов:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения заказов',
            error: error.message
        });
    }
});

// Получение деталей заказа
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user.id;
        
        const query = `
            SELECT 
                o.*,
                u.username as user_name,
                u.email as user_email,
                json_agg(
                    json_build_object(
                        'product_id', oi.product_id,
                        'product_name', oi.product_name,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'total', oi.quantity * oi.price
                    )
                ) as items
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = $1 AND (o.user_id = $2 OR $3 = 'admin')
            GROUP BY o.id, u.username, u.email
        `;
        
        const result = await pool.query(query, [orderId, userId, req.user.role]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Заказ не найден'
            });
        }
        
        res.json({
            success: true,
            order: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения заказа:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения заказа',
            error: error.message
        });
    }
});

// Обновление статуса заказа (для админа)
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Доступ запрещен'
            });
        }
        
        const orderId = req.params.id;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Некорректный статус'
            });
        }
        
        const query = `
            UPDATE orders 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;
        
        const result = await pool.query(query, [status, orderId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Заказ не найден'
            });
        }
        
        res.json({
            success: true,
            message: 'Статус заказа обновлен',
            order: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Ошибка обновления статуса заказа:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка обновления статуса заказа',
            error: error.message
        });
    }
});

module.exports = router;