const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

// Простая проверка админа
const checkAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Токен отсутствует'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this');
        
        const user = await db.get(
            'SELECT id, username, email, role, is_banned FROM users WHERE id = ?',
            [decoded.userId]
        );
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        if (user.is_banned) {
            return res.status(403).json({
                success: false,
                message: 'Аккаунт заблокирован'
            });
        }
        
        if (user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Доступ запрещен. Требуются права администратора'
            });
        }
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Неверный токен'
        });
    }
};

// Все маршруты требуют прав администратора
router.use(checkAdmin);

// Получение статистики
router.get('/stats', async (req, res) => {
    try {
        const users = await db.get('SELECT COUNT(*) as count FROM users');
        const products = await db.get('SELECT COUNT(*) as count FROM products');
        const orders = await db.get('SELECT COUNT(*) as count FROM orders');
        const categories = await db.get('SELECT COUNT(*) as count FROM categories');
        
        // Рассчитываем доход за последний месяц
        const revenue = await db.get(`
            SELECT SUM(total_amount) as total 
            FROM orders 
            WHERE status = 'completed' 
            AND created_at >= date('now', '-1 month')
        `);
        
        // Новые пользователи за последний месяц
        const newUsers = await db.get(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE created_at >= date('now', '-1 month')
        `);
        
        res.json({
            success: true,
            data: {
                users: users?.count || 0,
                products: products?.count || 0,
                orders: orders?.count || 0,
                categories: categories?.count || 0,
                newUsers: newUsers?.count || 0,
                monthlyRevenue: revenue?.total || 0
            }
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// ========== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ==========

// Получить всех пользователей
router.get('/users', async (req, res) => {
    try {
        const users = await db.all(`
            SELECT id, username, email, role, is_banned, ban_reason, 
                   banned_at, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            data: users || []
        });
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Получить одного пользователя
router.get('/users/:id', async (req, res) => {
    try {
        const user = await db.get(
            'SELECT id, username, email, role, is_banned, ban_reason, banned_at, created_at FROM users WHERE id = ?',
            [req.params.id]
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Ошибка получения пользователя:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Удалить пользователя (ИЗ БД)
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Нельзя удалить самого себя
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Нельзя удалить свой аккаунт'
            });
        }
        
        // Проверяем есть ли пользователь
        const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        // Удаляем пользователя из БД
        await db.run('DELETE FROM users WHERE id = ?', [userId]);
        
        res.json({
            success: true,
            message: 'Пользователь успешно удален из базы данных'
        });
    } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Бан пользователя
router.post('/users/:id/ban', [
    body('reason').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const { reason } = req.body;
        const userId = req.params.id;
        
        // Нельзя забанить самого себя
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Нельзя заблокировать свой аккаунт'
            });
        }
        
        // Проверяем есть ли пользователь
        const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        // Баним пользователя в БД
        await db.run(
            'UPDATE users SET is_banned = 1, ban_reason = ?, banned_at = CURRENT_TIMESTAMP WHERE id = ?',
            [reason, userId]
        );
        
        res.json({
            success: true,
            message: 'Пользователь заблокирован'
        });
    } catch (error) {
        console.error('Ошибка блокировки пользователя:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Разбан пользователя
router.post('/users/:id/unban', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Проверяем есть ли пользователь
        const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        // Разбаниваем пользователя в БД
        await db.run(
            'UPDATE users SET is_banned = 0, ban_reason = NULL, banned_at = NULL WHERE id = ?',
            [userId]
        );
        
        res.json({
            success: true,
            message: 'Пользователь разблокирован'
        });
    } catch (error) {
        console.error('Ошибка разблокировки пользователя:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Изменить роль пользователя
router.put('/users/:id/role', [
    body('role').isIn(['user', 'admin', 'moderator'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const { role } = req.body;
        const userId = req.params.id;
        
        // Нельзя изменить свою роль
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Нельзя изменить свою роль'
            });
        }
        
        // Проверяем есть ли пользователь
        const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        // Изменяем роль в БД
        await db.run(
            'UPDATE users SET role = ? WHERE id = ?',
            [role, userId]
        );
        
        res.json({
            success: true,
            message: 'Роль пользователя изменена'
        });
    } catch (error) {
        console.error('Ошибка изменения роли:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// ========== УПРАВЛЕНИЕ ТОВАРАМИ ==========

// Получить все товары
router.get('/products', async (req, res) => {
    try {
        const products = await db.all(`
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.created_at DESC
        `);
        
        res.json({
            success: true,
            data: products || []
        });
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Получить один товар
router.get('/products/:id', async (req, res) => {
    try {
        const product = await db.get(`
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
        `, [req.params.id]);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Товар не найден'
            });
        }
        
        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Ошибка получения товара:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Добавить товар (В БД)
router.post('/products', [
    body('name').notEmpty().trim(),
    body('price').isFloat({ min: 0 }),
    body('category_id').isInt({ min: 1 }),
    body('stock').isInt({ min: 0 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const { name, description, price, category_id, stock, specifications } = req.body;
        
        // Проверяем есть ли категория
        const category = await db.get('SELECT id FROM categories WHERE id = ?', [category_id]);
        if (!category) {
            return res.status(400).json({
                success: false,
                message: 'Категория не найдена'
            });
        }
        
        // Генерируем slug из имени
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9а-яё]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        // Добавляем товар в БД
        const result = await db.run(
            `INSERT INTO products 
            (name, slug, description, price, category_id, stock, specifications, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [name, slug, description || '', price, category_id, stock, specifications || null]
        );
        
        // Получаем добавленный товар
        const newProduct = await db.get(`
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
        `, [result.lastID]);
        
        res.status(201).json({
            success: true,
            message: 'Товар успешно добавлен в базу данных',
            data: newProduct
        });
    } catch (error) {
        console.error('Ошибка добавления товара:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при добавлении товара'
        });
    }
});

// Редактировать товар
router.put('/products/:id', [
    body('name').notEmpty().trim(),
    body('price').isFloat({ min: 0 }),
    body('category_id').isInt({ min: 1 }),
    body('stock').isInt({ min: 0 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const productId = req.params.id;
        const { name, description, price, category_id, stock, specifications, is_active } = req.body;
        
        // Проверяем есть ли товар
        const existingProduct = await db.get('SELECT id FROM products WHERE id = ?', [productId]);
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Товар не найден'
            });
        }
        
        // Проверяем есть ли категория
        const category = await db.get('SELECT id FROM categories WHERE id = ?', [category_id]);
        if (!category) {
            return res.status(400).json({
                success: false,
                message: 'Категория не найдена'
            });
        }
        
        // Обновляем товар в БД
        await db.run(
            `UPDATE products SET 
            name = ?, description = ?, price = ?, category_id = ?, 
            stock = ?, specifications = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [name, description || '', price, category_id, stock, specifications || null, 
             is_active !== undefined ? is_active : 1, productId]
        );
        
        res.json({
            success: true,
            message: 'Товар успешно обновлен в базе данных'
        });
    } catch (error) {
        console.error('Ошибка обновления товара:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Удалить товар (ИЗ БД)
router.delete('/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        
        // Проверяем есть ли товар
        const product = await db.get('SELECT id FROM products WHERE id = ?', [productId]);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Товар не найден'
            });
        }
        
        // Удаляем товар из БД
        await db.run('DELETE FROM products WHERE id = ?', [productId]);
        
        res.json({
            success: true,
            message: 'Товар успешно удален из базы данных'
        });
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// ========== УПРАВЛЕНИЕ КАТЕГОРИЯМИ ==========

// Получить все категории
router.get('/categories', async (req, res) => {
    try {
        const categories = await db.all(`
            SELECT c.*, COUNT(p.id) as product_count 
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id
            GROUP BY c.id
            ORDER BY c.name
        `);
        
        res.json({
            success: true,
            data: categories || []
        });
    } catch (error) {
        console.error('Ошибка получения категорий:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Получить одну категорию
router.get('/categories/:id', async (req, res) => {
    try {
        const category = await db.get(
            'SELECT * FROM categories WHERE id = ?',
            [req.params.id]
        );
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Категория не найдена'
            });
        }
        
        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Ошибка получения категории:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Добавить категорию
router.post('/categories', [
    body('name').notEmpty().trim(),
    body('slug').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const { name, slug, description } = req.body;
        
        // Проверяем уникальность slug
        const existingCategory = await db.get('SELECT id FROM categories WHERE slug = ?', [slug]);
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Категория с таким slug уже существует'
            });
        }
        
        const result = await db.run(
            'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
            [name, slug, description || '']
        );
        
        res.status(201).json({
            success: true,
            message: 'Категория добавлена',
            data: { id: result.lastID }
        });
    } catch (error) {
        console.error('Ошибка добавления категории:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Редактировать категорию
router.put('/categories/:id', [
    body('name').notEmpty().trim(),
    body('slug').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const categoryId = req.params.id;
        const { name, slug, description, is_active } = req.body;
        
        // Проверяем есть ли категория
        const existingCategory = await db.get('SELECT id FROM categories WHERE id = ?', [categoryId]);
        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: 'Категория не найден'
            });
        }
        
        // Проверяем уникальность slug (кроме текущей категории)
        const existingSlug = await db.get('SELECT id FROM categories WHERE slug = ? AND id != ?', [slug, categoryId]);
        if (existingSlug) {
            return res.status(400).json({
                success: false,
                message: 'Категория с таким slug уже существует'
            });
        }
        
        // Обновляем категорию в БД
        await db.run(
            `UPDATE categories SET 
            name = ?, slug = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [name, slug, description || '', is_active !== undefined ? is_active : 1, categoryId]
        );
        
        res.json({
            success: true,
            message: 'Категория успешно обновлена в базе данных'
        });
    } catch (error) {
        console.error('Ошибка обновления категории:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Удалить категорию
router.delete('/categories/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        
        // Проверяем, есть ли товары в категории
        const productsCount = await db.get(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
            [categoryId]
        );
        
        if (productsCount && productsCount.count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Нельзя удалить категорию, в которой есть товары'
            });
        }
        
        await db.run('DELETE FROM categories WHERE id = ?', [categoryId]);
        
        res.json({
            success: true,
            message: 'Категория удалена'
        });
    } catch (error) {
        console.error('Ошибка удаления категории:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

module.exports = router;