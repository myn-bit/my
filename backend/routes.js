// routes.js - Основные маршруты API
const express = require('express');
const router = express.Router();

// Импорт контроллеров
const authController = require('./controllers/authController');
const productController = require('./controllers/productController');
const orderController = require('./controllers/orderController');
const adminController = require('./controllers/adminController');

// Middleware
const { authenticateToken, requireAdmin } = require('./middleware/auth');

// ========== ПУБЛИЧНЫЕ РОУТЫ ==========

// Тестовый эндпоинт
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API работает корректно',
        timestamp: new Date().toISOString()
    });
});

// Авторизация
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify', authenticateToken, authController.verify);

// Продукты
router.get('/products', productController.getAllProducts);
router.get('/products/:id', productController.getProductById);
router.get('/products/top/:limit?', productController.getTopProducts);
router.get('/products/new/:limit?', productController.getNewProducts);

// Категории
router.get('/categories', productController.getCategories);

// Поиск
router.get('/search', productController.searchProducts);

// ========== ЗАЩИЩЕННЫЕ РОУТЫ ==========

// Профиль
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);

// Заказы
router.post('/orders', authenticateToken, orderController.createOrder);
router.get('/orders/my', authenticateToken, orderController.getUserOrders);
router.get('/orders/:id', authenticateToken, orderController.getOrderById);

// Избранное
router.get('/favorites', authenticateToken, productController.getFavorites);
router.post('/favorites/add', authenticateToken, productController.addFavorite);
router.post('/favorites/remove', authenticateToken, productController.removeFavorite);
router.get('/favorites/check/:productId', authenticateToken, productController.checkFavorite);

// ========== АДМИН РОУТЫ ==========

// Пользователи
router.get('/admin/users', authenticateToken, requireAdmin, adminController.getUsers);
router.get('/admin/users/:id', authenticateToken, requireAdmin, adminController.getUser);
router.post('/admin/users', authenticateToken, requireAdmin, adminController.createUser);
router.put('/admin/users/:id', authenticateToken, requireAdmin, adminController.updateUser);
router.delete('/admin/users/:id', authenticateToken, requireAdmin, adminController.deleteUser);

// Товары (админ)
router.get('/admin/products', authenticateToken, requireAdmin, adminController.getAdminProducts);
router.post('/admin/products', authenticateToken, requireAdmin, adminController.createProduct);
router.put('/admin/products/:id', authenticateToken, requireAdmin, adminController.updateProduct);
router.delete('/admin/products/:id', authenticateToken, requireAdmin, adminController.deleteProduct);

// Категории (админ)
router.get('/admin/categories', authenticateToken, requireAdmin, adminController.getAdminCategories);
router.post('/admin/categories', authenticateToken, requireAdmin, adminController.createCategory);
router.put('/admin/categories/:id', authenticateToken, requireAdmin, adminController.updateCategory);
router.delete('/admin/categories/:id', authenticateToken, requireAdmin, adminController.deleteCategory);

// Заказы (админ)
router.get('/admin/orders', authenticateToken, requireAdmin, adminController.getAdminOrders);
router.get('/admin/orders/:id', authenticateToken, requireAdmin, adminController.getAdminOrder);
router.put('/admin/orders/:id/status', authenticateToken, requireAdmin, adminController.updateOrderStatus);
router.delete('/admin/orders/:id', authenticateToken, requireAdmin, adminController.deleteOrder);

// Статистика
router.get('/admin/stats', authenticateToken, requireAdmin, adminController.getStats);

// Логи
router.get('/admin/logs', authenticateToken, requireAdmin, adminController.getLogs);

module.exports = router;