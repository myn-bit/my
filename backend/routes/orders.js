const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middlewares/auth');

// Создать заказ
router.post('/', orderController.createOrder);

// Получить заказы пользователя (требует авторизации)
router.get('/my-orders', auth, orderController.getUserOrders);

// Получить все заказы (для админа)
router.get('/', auth, orderController.getAllOrders);

module.exports = router;