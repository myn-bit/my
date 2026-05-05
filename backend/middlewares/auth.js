// middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-secret-key-change-in-production';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Требуется авторизация. Токен отсутствует.' 
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                message: 'Неверный или просроченный токен' 
            });
        }
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false, 
            message: 'Требуется авторизация' 
        });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Требуются права администратора' 
        });
    }
    next();
};

const requireModerator = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false, 
            message: 'Требуется авторизация' 
        });
    }
    
    const allowedRoles = ['admin', 'moderator'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
            success: false, 
            message: 'Недостаточно прав' 
        });
    }
    next();
};

module.exports = {
    authenticateToken,
    requireAdmin,
    requireModerator
};