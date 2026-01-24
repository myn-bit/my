const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Регистрация
router.post('/register', userController.register);

// Вход
router.post('/login', userController.login);

// Получить профиль
router.get('/profile', userController.getProfile);

module.exports = router;