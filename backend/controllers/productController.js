// Контроллер для работы с товарами
const db = require('../../database/connection');

exports.getAllProducts = async (req, res) => {
    try {
        const [products] = await db.query('SELECT * FROM products WHERE is_active = 1');
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const [product] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (product.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        res.json(product[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getFeaturedProducts = async (req, res) => {
    try {
        const [products] = await db.query(
            'SELECT * FROM products WHERE is_featured = 1 AND is_active = 1 LIMIT 6'
        );
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};