// Контроллер для работы с заказами
const db = require('../../database/connection');

exports.createOrder = async (req, res) => {
    try {
        const { userId, items, total, shippingAddress } = req.body;
        
        const [result] = await db.query(
            'INSERT INTO orders (user_id, total, shipping_address, status) VALUES (?, ?, ?, ?)',
            [userId || null, total, shippingAddress, 'pending']
        );
        
        const orderId = result.insertId;
        
        // Добавляем товары в заказ
        for (const item of items) {
            await db.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [orderId, item.productId, item.quantity, item.price]
            );
        }
        
        res.status(201).json({ 
            success: true, 
            message: 'Заказ создан', 
            orderId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};