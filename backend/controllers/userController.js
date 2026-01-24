// Контроллер для работы с пользователями
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../database/connection');

exports.register = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        // Проверяем, существует ли пользователь
        const [existingUser] = await db.query(
            'SELECT id FROM users WHERE email = ?', 
            [email]
        );
        
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Пользователь уже существует' });
        }
        
        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Создаем пользователя
        const [result] = await db.query(
            'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
            [email, hashedPassword, name]
        );
        
        res.status(201).json({ 
            success: true, 
            message: 'Пользователь создан',
            userId: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Ищем пользователя
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ?', 
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        
        const user = users[0];
        
        // Проверяем пароль
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        
        // Создаем JWT токен
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ 
            success: true, 
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};