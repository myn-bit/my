const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
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
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Неверный токен'
        });
    }
};

const adminMiddleware = async (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Доступ запрещен. Требуются права администратора'
        });
    }
    next();
};

module.exports = { authMiddleware, adminMiddleware };