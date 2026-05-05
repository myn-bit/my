const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

// Простая проверка админа
const checkAdmin = async (req, res, next) => {
    try {
        // Проверяем токен из заголовка Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Токен отсутствует'
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Токен отсутствует'
            });
        }
        
        // Проверяем токен
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this');
        
        // Получаем пользователя из БД
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
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Неверный токен'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Токен истек'
            });
        }
        console.error('Ошибка проверки токена:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
};

// Все маршруты требуют прав администратора
router.use(checkAdmin);

// Получение статистики (обновленная версия)
router.get('/stats', async (req, res) => {
    try {
        const users = await db.get('SELECT COUNT(*) as count FROM users');
        const products = await db.get('SELECT COUNT(*) as count FROM products');
        const orders = await db.get('SELECT COUNT(*) as count FROM orders');
        const categories = await db.get('SELECT COUNT(*) as count FROM categories');
        
        // Рассчитываем общую стоимость всех товаров
        const totalValue = await db.get('SELECT SUM(price) as total FROM products');
        
        // Рассчитываем доход за последний месяц
        const monthlyRevenue = await db.get(`
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
            users: users?.count || 0,
            products: products?.count || 0,
            orders: orders?.count || 0,
            categories: categories?.count || 0,
            newUsers: newUsers?.count || 0,
            totalValue: totalValue?.total || 0,
            monthlyRevenue: monthlyRevenue?.total || 0
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

// Получить всех пользователей (упрощенная версия для фронтенда)
router.get('/users', async (req, res) => {
    try {
        const users = await db.all(`
            SELECT id, username, email, role, 
                   CASE WHEN is_banned = 1 THEN 'banned' ELSE 'active' END as status,
                   ban_reason, banned_at, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            users: users || []
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
            user: user
        });
    } catch (error) {
        console.error('Ошибка получения пользователя:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Создать нового пользователя
router.post('/users', [
    body('username').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').optional().isIn(['user', 'admin', 'moderator'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }
    
    try {
        const { username, email, password, role = 'user', status = 'active', notes } = req.body;
        
        // Проверяем уникальность email
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Пользователь с таким email уже существует'
            });
        }
        
        // Хэшируем пароль (предполагается, что bcrypt установлен)
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Добавляем пользователя в БД
        const result = await db.run(
            `INSERT INTO users (username, email, password, role, is_banned, notes, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [username, email, hashedPassword, role, status === 'banned' ? 1 : 0, notes || null]
        );
        
        res.status(201).json({
            success: true,
            message: 'Пользователь успешно создан',
            userId: result.lastID
        });
    } catch (error) {
        console.error('Ошибка создания пользователя:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при создании пользователя'
        });
    }
});

// Обновить пользователя
router.put('/users/:id', [
    body('username').optional().notEmpty().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['user', 'admin', 'moderator']),
    body('status').optional().isIn(['active', 'banned', 'inactive'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }
    
    try {
        const userId = req.params.id;
        const { username, email, role, status, password, notes } = req.body;
        
        // Проверяем существование пользователя
        const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        // Нельзя изменять самого себя
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Нельзя изменять свой аккаунт'
            });
        }
        
        // Проверяем уникальность email (если изменяется)
        if (email) {
            const emailExists = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Пользователь с таким email уже существует'
                });
            }
        }
        
        // Строим запрос на обновление динамически
        let updateFields = [];
        let queryParams = [];
        
        if (username) {
            updateFields.push('username = ?');
            queryParams.push(username);
        }
        
        if (email) {
            updateFields.push('email = ?');
            queryParams.push(email);
        }
        
        if (role) {
            updateFields.push('role = ?');
            queryParams.push(role);
        }
        
        if (status) {
            const is_banned = status === 'banned' ? 1 : 0;
            updateFields.push('is_banned = ?');
            queryParams.push(is_banned);
            
            // Если баним, добавляем время бана
            if (status === 'banned') {
                updateFields.push('banned_at = datetime("now")');
            } else {
                updateFields.push('banned_at = NULL');
            }
        }
        
        if (password) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push('password = ?');
            queryParams.push(hashedPassword);
        }
        
        if (notes !== undefined) {
            updateFields.push('notes = ?');
            queryParams.push(notes);
        }
        
        // Добавляем обновление времени
        updateFields.push('updated_at = datetime("now")');
        
        // Добавляем ID пользователя в конец параметров
        queryParams.push(userId);
        
        // Обновляем пользователя
        await db.run(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            queryParams
        );
        
        res.json({
            success: true,
            message: 'Пользователь успешно обновлен'
        });
    } catch (error) {
        console.error('Ошибка обновления пользователя:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при обновлении пользователя'
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

// Бан пользователя (новый endpoint)
router.put('/users/:id/ban', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        // Нельзя забанить самого себя
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Нельзя заблокировать свой аккаунт'
            });
        }
        
        // Проверяем есть ли пользователь
        const user = await db.get('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        // Баним пользователя в БД
        await db.run(
            'UPDATE users SET is_banned = 1, ban_reason = ?, banned_at = datetime("now") WHERE id = ?',
            [reason || 'Заблокирован администратором', id]
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

// Разбан пользователя (новый endpoint)
router.put('/users/:id/unban', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверяем есть ли пользователь
        const user = await db.get('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        // Разбаниваем пользователя в БД
        await db.run(
            'UPDATE users SET is_banned = 0, ban_reason = NULL, banned_at = NULL WHERE id = ?',
            [id]
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

// Изменить роль пользователя (новый endpoint)
router.put('/users/:id/role', [
    body('role').isIn(['user', 'admin', 'moderator'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
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

// Проверить, является ли пользователь администратором (для фронтенда)
router.get('/check/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await db.get('SELECT role FROM users WHERE id = ?', [id]);
        
        if (!user) {
            return res.json({ 
                success: false,
                isAdmin: false,
                message: 'Пользователь не найден' 
            });
        }
        
        res.json({ 
            success: true,
            isAdmin: user.role === 'admin' 
        });
    } catch (error) {
        console.error('Ошибка проверки прав:', error);
        res.status(500).json({ 
            success: false,
            isAdmin: false,
            message: 'Ошибка сервера' 
        });
    }
});

// ========== УПРАВЛЕНИЕ ТОВАРАМИ ==========

// Получить все товары (упрощенная версия для фронтенда)
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
            products: products || []
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
            product: product
        });
    } catch (error) {
        console.error('Ошибка получения товара:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Добавить товар (В БД) (упрощенная версия)
router.post('/products', [
    body('name').notEmpty().trim(),
    body('price').isFloat({ min: 0 }),
    body('category_id').isInt({ min: 1 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }
    
    try {
        const { name, description, price, category_id, stock = 10, image_url } = req.body;
        
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
            .replace(/[^a-z0-9а-яё\s]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        // Добавляем товар в БД
        const result = await db.run(
            `INSERT INTO products 
            (name, slug, description, price, category_id, stock, image_url, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [name, slug, description || '', price, category_id, stock, image_url || null]
        );
        
        res.status(201).json({
            success: true,
            message: 'Товар успешно добавлен в базу данных',
            productId: result.lastID
        });
    } catch (error) {
        console.error('Ошибка добавления товара:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при добавлении товара'
        });
    }
});

// Редактировать товар (упрощенная версия)
router.put('/products/:id', [
    body('name').optional().notEmpty().trim(),
    body('price').optional().isFloat({ min: 0 }),
    body('category_id').optional().isInt({ min: 1 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }
    
    try {
        const productId = req.params.id;
        const { name, description, price, category_id, stock, image_url, is_active } = req.body;
        
        // Проверяем есть ли товар
        const existingProduct = await db.get('SELECT id FROM products WHERE id = ?', [productId]);
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Товар не найден'
            });
        }
        
        // Проверяем есть ли категория (если изменяется)
        if (category_id) {
            const category = await db.get('SELECT id FROM categories WHERE id = ?', [category_id]);
            if (!category) {
                return res.status(400).json({
                    success: false,
                    message: 'Категория не найдена'
                });
            }
        }
        
        // Строим запрос на обновление динамически
        let updateFields = [];
        let queryParams = [];
        
        if (name) {
            updateFields.push('name = ?');
            queryParams.push(name);
            
            // Генерируем новый slug
            const slug = name.toLowerCase()
                .replace(/[^a-z0-9а-яё\s]/g, '-')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            updateFields.push('slug = ?');
            queryParams.push(slug);
        }
        
        if (description !== undefined) {
            updateFields.push('description = ?');
            queryParams.push(description || '');
        }
        
        if (price) {
            updateFields.push('price = ?');
            queryParams.push(price);
        }
        
        if (category_id) {
            updateFields.push('category_id = ?');
            queryParams.push(category_id);
        }
        
        if (stock !== undefined) {
            updateFields.push('stock = ?');
            queryParams.push(stock);
        }
        
        if (image_url !== undefined) {
            updateFields.push('image_url = ?');
            queryParams.push(image_url || null);
        }
        
        if (is_active !== undefined) {
            updateFields.push('is_active = ?');
            queryParams.push(is_active ? 1 : 0);
        }
        
        // Добавляем обновление времени
        updateFields.push('updated_at = datetime("now")');
        
        // Добавляем ID товара в конец параметров
        queryParams.push(productId);
        
        // Обновляем товар
        await db.run(
            `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`,
            queryParams
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

// Получить все категории (упрощенная версия для фронтенда)
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
            categories: categories || []
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
            category: category
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
    body('name').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }
    
    try {
        const { name, description } = req.body;
        
        // Генерируем slug из имени
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9а-яё\s]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
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
            categoryId: result.lastID
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
    body('name').optional().notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }
    
    try {
        const categoryId = req.params.id;
        const { name, description, is_active } = req.body;
        
        // Проверяем есть ли категория
        const existingCategory = await db.get('SELECT id FROM categories WHERE id = ?', [categoryId]);
        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: 'Категория не найдена'
            });
        }
        
        // Строим запрос на обновление динамически
        let updateFields = [];
        let queryParams = [];
        
        if (name) {
            updateFields.push('name = ?');
            queryParams.push(name);
            
            // Генерируем новый slug
            const slug = name.toLowerCase()
                .replace(/[^a-z0-9а-яё\s]/g, '-')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            updateFields.push('slug = ?');
            queryParams.push(slug);
        }
        
        if (description !== undefined) {
            updateFields.push('description = ?');
            queryParams.push(description || '');
        }
        
        if (is_active !== undefined) {
            updateFields.push('is_active = ?');
            queryParams.push(is_active ? 1 : 0);
        }
        
        // Добавляем обновление времени
        updateFields.push('updated_at = datetime("now")');
        
        // Добавляем ID категории в конец параметров
        queryParams.push(categoryId);
        
        // Обновляем категорию
        await db.run(
            `UPDATE categories SET ${updateFields.join(', ')} WHERE id = ?`,
            queryParams
        );
        
        res.json({
            success: true,
            message: 'Категория успешно обновлена'
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