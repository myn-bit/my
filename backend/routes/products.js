const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Получение всех категорий с количеством товаров
router.get('/categories', async (req, res) => {
    try {
        const categories = await db.all(`
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY c.name
        `);
        
        res.json({
            success: true,
            data: categories
        });
        
    } catch (error) {
        console.error('Ошибка получения категорий:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Получение товаров с фильтрацией
router.get('/', async (req, res) => {
    try {
        const { 
            category, 
            search, 
            page = 1, 
            limit = 12,
            sort = 'newest'
        } = req.query;
        
        const offset = (page - 1) * limit;
        
        // Базовый запрос
        let query = `
            SELECT p.*, c.name as category_name, c.slug as category_slug
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
        `;
        
        const params = [];
        
        // Фильтр по категории
        if (category && category !== 'all') {
            query += ' AND c.slug = ?';
            params.push(category);
        }
        
        // Поиск
        if (search) {
            query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        // Сортировка
        switch(sort) {
            case 'price_asc':
                query += ' ORDER BY p.price ASC';
                break;
            case 'price_desc':
                query += ' ORDER BY p.price DESC';
                break;
            case 'name_asc':
                query += ' ORDER BY p.name ASC';
                break;
            case 'name_desc':
                query += ' ORDER BY p.name DESC';
                break;
            default:
                query += ' ORDER BY p.created_at DESC';
        }
        
        // Пагинация
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        // Получаем товары
        const products = await db.all(query, params);
        
        // Получаем общее количество
        let countQuery = `
            SELECT COUNT(*) as total
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
        `;
        
        const countParams = [];
        
        if (category && category !== 'all') {
            countQuery += ' AND c.slug = ?';
            countParams.push(category);
        }
        
        if (search) {
            countQuery += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm);
        }
        
        const countResult = await db.get(countQuery, countParams);
        const total = countResult ? countResult.total : 0;
        
        res.json({
            success: true,
            data: products,
            pagination: {
                total: total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Получение одного товара по slug
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const product = await db.get(`
            SELECT p.*, c.name as category_name, c.slug as category_slug
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.slug = ? AND p.is_active = 1
        `, [slug]);
        
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

module.exports = router;