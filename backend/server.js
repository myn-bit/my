// server.js - Полная версия сервера с бессрочными токенами и исправленными заказами
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Импорт системы логирования
const logger = require('./logger');
const logMiddleware = require('./logMiddleware');

const app = express();
const PORT = 3001;

// Маркер инициализации базы данных
const INIT_MARKER = path.join(__dirname, '.initialized');

// Функция для проверки первого запуска
function isFirstRun() {
    return !fs.existsSync(INIT_MARKER);
}

// Функция для отметки о выполненной инициализации
function markInitialized() {
    fs.writeFileSync(INIT_MARKER, JSON.stringify({
        initialized: true,
        date: new Date().toISOString(),
        version: '1.0.0'
    }, null, 2));
    console.log('✅ Создан маркер инициализации базы данных');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Middleware для логирования запросов
app.use(logMiddleware.logRequests);

// Секретный ключ для JWT
const JWT_SECRET = 'your-secret-key-change-in-production';

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ТОКЕНАМИ (БЕССРОЧНЫЕ) ==========

// Генерирует уникальный бессрочный токен для каждого пользователя
const generateToken = (user) => {
    const salt = crypto.randomBytes(16).toString('hex');
    
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            email: user.email, 
            role: user.role,
            salt: salt,
            createdAt: Date.now()
        },
        JWT_SECRET
    );
};

// Упрощенный middleware для проверки - ТОЛЬКО ПРОВЕРЯЕТ ПОДПИСЬ, НО НЕ СРОК!
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    console.log('\n🔐 ===== ПРОВЕРКА АУТЕНТИФИКАЦИИ =====');
    console.log('🔐 Путь:', req.path);
    console.log('🔐 Метод:', req.method);
    console.log('🔐 Authorization заголовок:', authHeader ? 'присутствует' : 'отсутствует');
    
    if (!authHeader) {
        console.log('🔐 Аутентификация: заголовок Authorization отсутствует');
        logger.warn('Отсутствует заголовок Authorization', { 
            url: req.url, 
            method: req.method 
        });
        return res.status(401).json({ 
            success: false, 
            message: 'Требуется авторизация. Токен отсутствует.'
        });
    }
    
    const parts = authHeader.split(' ');
    console.log('🔐 Части заголовка:', parts);
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        console.log('🔐 Аутентификация: неверный формат заголовка Authorization');
        return res.status(401).json({ 
            success: false, 
            message: 'Неверный формат токена. Используйте "Bearer <токен>"'
        });
    }
    
    const token = parts[1];
    
    if (token === 'undefined' || token === 'null' || token === '') {
        console.log('🔐 Аутентификация: токен равен "undefined" или пуст');
        return res.status(401).json({ 
            success: false, 
            message: 'Токен не найден. Пожалуйста, войдите снова.'
        });
    }
    
    console.log(`🔐 Аутентификация: получен токен длиной ${token.length} символов`);
    
    try {
        const user = jwt.verify(token, JWT_SECRET);
        
        console.log(`✅ Аутентификация успешна: пользователь ${user.username} (ID: ${user.id}, роль: ${user.role})`);
        console.log(`✅ Токен создан: ${new Date(user.createdAt).toLocaleString('ru-RU')}`);
        console.log(`✅ Токен БЕССРОЧНЫЙ - никогда не истечет!`);
        
        req.user = user;
        next();
    } catch (err) {
        console.log(`❌ Ошибка верификации токена: ${err.message}`);
        console.log(`🔍 Тип ошибки: ${err.name}`);
        
        logger.error('Ошибка верификации токена', {
            error: err.message,
            errorType: err.name,
            path: req.path
        });
        
        return res.status(403).json({ 
            success: false, 
            message: 'Неверный токен. Пожалуйста, войдите снова.',
            error: err.name
        });
    }
};

// Middleware для проверки прав администратора
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Требуется авторизация' });
    }
    if (req.user.role !== 'admin') {
        console.log(`⛔ Отказ в доступе: пользователь ${req.user.username} не администратор`);
        logger.warn('Попытка доступа к админ-функциям без прав', {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            path: req.path
        });
        return res.status(403).json({ success: false, message: 'Требуются права администратора' });
    }
    next();
};

// ========== ЭНДПОИНТЫ ДЛЯ АВАТАРА ==========

// Получить аватар пользователя
app.get('/api/profile/avatar', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    console.log(`🖼️ Запрос аватара пользователя ID: ${userId}`);
    
    db.get('SELECT avatar, avatar_type FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('❌ Ошибка получения аватара:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        res.json({
            success: true,
            avatar: user.avatar || null,
            avatar_type: user.avatar_type || 'initials'
        });
    });
});

// Загрузка аватара
app.post('/api/profile/avatar', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    console.log(`🖼️ Загрузка аватара для пользователя ID: ${userId}`);
    console.log('📦 Тело запроса:', JSON.stringify(req.body, null, 2));
    
    let avatarValue = null;
    let avatarType = 'image';
    
    if (req.body.value) {
        avatarValue = req.body.value;
        avatarType = req.body.type || 'image';
    }
    else if (req.body.avatar) {
        avatarValue = req.body.avatar;
        avatarType = req.body.avatar_type || 'image';
    }
    else if (req.body.data) {
        avatarValue = req.body.data;
        avatarType = req.body.type || 'image';
    }
    else if (typeof req.body === 'string' && req.body.length > 100) {
        avatarValue = req.body;
    }
    
    console.log(`🖼️ Найденное значение: ${avatarValue ? 'да' : 'нет'}`);
    if (avatarValue) {
        console.log(`🖼️ Длина: ${avatarValue.length} символов`);
        console.log(`🖼️ Начинается с: ${avatarValue.substring(0, 50)}...`);
        console.log(`🖼️ Тип: ${avatarType}`);
    }
    
    if (!avatarValue) {
        console.log('❌ Данные аватара не предоставлены');
        return res.status(400).json({
            success: false,
            message: 'Данные аватара не предоставлены',
            receivedBody: req.body
        });
    }
    
    db.run(
        'UPDATE users SET avatar = ?, avatar_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [avatarValue, avatarType, userId],
        function(err) {
            if (err) {
                console.error('❌ Ошибка обновления аватара в БД:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка сохранения аватара'
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Пользователь не найден'
                });
            }
            
            console.log(`✅ Аватар сохранен в БД для пользователя ID: ${userId}`);
            
            res.json({
                success: true,
                message: 'Аватар успешно загружен',
                avatar: avatarValue,
                avatar_type: avatarType
            });
        }
    );
});

// Удалить аватар
app.delete('/api/profile/avatar', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    console.log(`🗑️ Удаление аватара пользователя ID: ${userId}`);
    
    db.run(
        'UPDATE users SET avatar = NULL, avatar_type = "initials", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [userId],
        function(err) {
            if (err) {
                console.error('❌ Ошибка удаления аватара из БД:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка удаления аватара'
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Пользователь не найден'
                });
            }
            
            console.log(`✅ Аватар удален из БД для пользователя ID: ${userId}`);
            
            res.json({
                success: true,
                message: 'Аватар успешно удален'
            });
        }
    );
});

// ========== КОРНЕВОЙ ЭНДПОИНТ ==========
app.get('/', (req, res) => {
    console.log('🏠 Запрос к корневому пути /');
    logger.info('Запрос к корневому пути', { 
        ip: req.ip, 
        userAgent: req.headers['user-agent'],
        method: 'GET',
        url: '/'
    });
    
    res.json({
        success: true,
        message: '🚀 Добро пожаловать в PC Store API! (Бессрочные токены)',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        server: 'Node.js + Express + SQLite',
        port: PORT,
        endpoints: {
            auth: [
                'POST /api/register - регистрация',
                'POST /api/login - вход',
                'GET /api/verify - проверка токена',
                'GET /api/profile - профиль пользователя',
                'PUT /api/profile - обновление профиля',
                'PUT /api/profile/password - смена пароля',
                'DELETE /api/profile - удаление аккаунта'
            ],
            avatar: [
                'GET /api/profile/avatar - получить аватар',
                'POST /api/profile/avatar - загрузить аватар',
                'DELETE /api/profile/avatar - удалить аватар'
            ],
            products: [
                'GET /api/products - все товары',
                'GET /api/products/:id - товар по ID',
                'GET /api/products/top/:limit? - топ товары',
                'GET /api/products/new/:limit? - новые товары',
                'GET /api/search?q=... - поиск товаров'
            ],
            categories: [
                'GET /api/categories - все категории'
            ],
            orders: [
                'POST /api/orders - создание заказа',
                'POST /api/orders/create - создание заказа (альтернатива)',
                'GET /api/orders/my - мои заказы',
                'GET /api/orders/:id - детали заказа',
                'POST /api/orders/create-full - полное создание заказа'
            ],
            favorites: [
                'GET /api/favorites - избранное',
                'POST /api/favorites/add - добавить в избранное',
                'POST /api/favorites/remove - удалить из избранного',
                'GET /api/favorites/check/:productId - проверка избранного'
            ],
            admin: [
                'GET /api/admin/users - все пользователи (admin)',
                'GET /api/admin/products - все товары (admin)',
                'GET /api/admin/categories - все категории (admin)',
                'GET /api/admin/orders - все заказы (admin)',
                'GET /api/admin/stats - статистика (admin)'
            ],
            other: [
                'GET /api/home - данные главной страницы',
                'GET /api/test - тест сервера',
                'GET /api/test-logs - тест логирования',
                'GET /api/logs/view - просмотр логов (admin)'
            ]
        }
    });
});

// ========== ДИАГНОСТИЧЕСКИЕ ЭНДПОИНТЫ ==========

// Эндпоинт для смены пароля
app.put('/api/profile/password', authenticateToken, (req, res) => {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;
    
    console.log(`🔐 Смена пароля для пользователя ID: ${userId}`);
    
    if (!current_password || !new_password) {
        return res.status(400).json({
            success: false,
            message: 'Текущий и новый пароль обязательны'
        });
    }
    
    if (new_password.length < 8) {
        return res.status(400).json({
            success: false,
            message: 'Новый пароль должен содержать минимум 8 символов'
        });
    }
    
    if (new_password === current_password) {
        return res.status(400).json({
            success: false,
            message: 'Новый пароль должен отличаться от текущего'
        });
    }
    
    const hasLetters = /[a-zA-Zа-яА-Я]/.test(new_password);
    const hasNumbers = /\d/.test(new_password);
    
    if (!hasLetters || !hasNumbers) {
        return res.status(400).json({
            success: false,
            message: 'Пароль должен содержать буквы и цифры'
        });
    }
    
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('❌ Ошибка получения пользователя:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        const isCurrentPasswordValid = bcrypt.compareSync(current_password, user.password);
        
        if (!isCurrentPasswordValid) {
            console.log(`❌ Неверный текущий пароль для пользователя ID: ${userId}`);
            return res.status(401).json({
                success: false,
                message: 'Неверный текущий пароль'
            });
        }
        
        const hashedNewPassword = bcrypt.hashSync(new_password, 10);
        
        db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedNewPassword, userId],
            function(err) {
                if (err) {
                    console.error('❌ Ошибка обновления пароля:', err.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Ошибка базы данных'
                    });
                }
                
                console.log(`✅ Пароль успешно изменен для пользователя ID: ${userId}`);
                
                res.json({
                    success: true,
                    message: 'Пароль успешно изменен'
                });
            }
        );
    });
});

// Тестовый эндпоинт для проверки токена
app.post('/api/test-token', authenticateToken, (req, res) => {
    console.log('✅ Тестовый запрос токена успешен');
    res.json({
        success: true,
        message: 'Токен валиден!',
        user: req.user
    });
});

// Эндпоинт для создания тестового токена (БЕССРОЧНОГО!)
app.post('/api/create-test-token', (req, res) => {
    const { userId = 1, username = 'testuser', email = 'test@example.com', role = 'user' } = req.body;
    
    const testUser = { id: userId, username, email, role };
    const testToken = generateToken(testUser);
    
    console.log(`🔐 Создан тестовый БЕССРОЧНЫЙ токен длиной ${testToken.length} символов`);
    
    res.json({
        success: true,
        message: 'Тестовый БЕССРОЧНЫЙ токен создан',
        token: testToken,
        tokenInfo: {
            userId: userId,
            username: username,
            role: role,
            expiresIn: 'НИКОГДА (бессрочный)',
            tokenLength: testToken.length
        }
    });
});

// Эндпоинт для удаления аккаунта
app.delete('/api/profile', authenticateToken, (req, res) => {
    const { password } = req.body;
    const userId = req.user.id;
    
    console.log(`🗑️ Запрос на удаление аккаунта пользователя ID: ${userId}`);
    
    if (!password) {
        return res.status(400).json({
            success: false,
            message: 'Для удаления аккаунта требуется пароль'
        });
    }
    
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('❌ Ошибка получения пользователя:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        
        if (!isPasswordValid) {
            console.log(`❌ Неверный пароль для удаления аккаунта пользователя ID: ${userId}`);
            return res.status(401).json({
                success: false,
                message: 'Неверный пароль'
            });
        }
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            db.run('DELETE FROM favorites WHERE user_id = ?', [userId], (err) => {
                if (err) {
                    console.error('❌ Ошибка удаления избранного:', err.message);
                    db.run('ROLLBACK');
                    return res.status(500).json({
                        success: false,
                        message: 'Ошибка удаления данных пользователя'
                    });
                }
                
                console.log(`✅ Избранное пользователя ID: ${userId} удалено`);
                
                db.all('SELECT id FROM orders WHERE user_id = ?', [userId], (err, orders) => {
                    if (err) {
                        console.error('❌ Ошибка получения заказов:', err.message);
                        db.run('ROLLBACK');
                        return res.status(500).json({
                            success: false,
                            message: 'Ошибка удаления данных пользователя'
                        });
                    }
                    
                    orders.forEach(order => {
                        db.run('DELETE FROM order_items WHERE order_id = ?', [order.id], (err) => {
                            if (err) console.error('Ошибка удаления товаров заказа:', err.message);
                        });
                    });
                    
                    db.run('DELETE FROM orders WHERE user_id = ?', [userId], (err) => {
                        if (err) {
                            console.error('❌ Ошибка удаления заказов:', err.message);
                            db.run('ROLLBACK');
                            return res.status(500).json({
                                success: false,
                                message: 'Ошибка удаления данных пользователя'
                            });
                        }
                        
                        console.log(`✅ Заказы пользователя ID: ${userId} удалены`);
                        
                        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                            if (err) {
                                console.error('❌ Ошибка удаления пользователя:', err.message);
                                db.run('ROLLBACK');
                                return res.status(500).json({
                                    success: false,
                                    message: 'Ошибка удаления аккаунта'
                                });
                            }
                            
                            if (this.changes === 0) {
                                db.run('ROLLBACK');
                                return res.status(404).json({
                                    success: false,
                                    message: 'Пользователь не найден'
                                });
                            }
                            
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('❌ Ошибка коммита транзакции:', err.message);
                                    db.run('ROLLBACK');
                                    return res.status(500).json({
                                        success: false,
                                        message: 'Ошибка удаления аккаунта'
                                    });
                                }
                                
                                console.log(`✅ Аккаунт пользователя ID: ${userId} полностью удален`);
                                
                                res.json({
                                    success: true,
                                    message: 'Аккаунт успешно удален'
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Эндпоинт для получения реального БЕССРОЧНОГО токена из БД
app.get('/api/get-token/:userId?', (req, res) => {
    const userId = req.params.userId || 1;
    
    console.log(`🔐 Запрос БЕССРОЧНОГО токена для пользователя ID: ${userId}`);
    
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            console.log(`⚠️ Пользователь ${userId} не найден, создаем тестовый БЕССРОЧНЫЙ токен`);
            
            const testUser = { 
                id: userId, 
                username: 'testuser', 
                email: 'test@example.com', 
                role: 'user' 
            };
            
            const testToken = generateToken(testUser);
            
            return res.json({
                success: true,
                message: 'Тестовый БЕССРОЧНЫЙ токен создан',
                token: testToken,
                tokenInfo: {
                    length: testToken.length,
                    expiresIn: 'НИКОГДА (бессрочный)',
                    userId: userId,
                    isTestToken: true
                }
            });
        }
        
        const userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        };
        
        const token = generateToken(userData);
        
        console.log(`✅ БЕССРОЧНЫЙ токен создан для пользователя: ${user.username}`);
        console.log(`🔐 Длина токена: ${token.length} символов`);
        
        res.json({
            success: true,
            message: 'БЕССРОЧНЫЙ токен создан',
            token: token,
            tokenInfo: {
                length: token.length,
                expiresIn: 'НИКОГДА (бессрочный)',
                userId: user.id,
                username: user.username,
                role: user.role,
                isTestToken: false
            }
        });
    });
});

// Эндпоинт для диагностики токена
app.post('/api/debug-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    
    console.log('\n🔍 ===== ДИАГНОСТИКА ТОКЕНА =====');
    console.log('🔍 Заголовок Authorization:', authHeader);
    
    const result = {
        success: true,
        tokenInfo: {},
        serverMode: 'БЕССРОЧНЫЕ ТОКЕНЫ (никогда не истекают)'
    };
    
    if (!authHeader) {
        result.message = 'Заголовок Authorization отсутствует';
        return res.json(result);
    }
    
    const parts = authHeader.split(' ');
    
    result.tokenInfo = {
        rawHeader: authHeader,
        partsCount: parts.length,
        parts: parts,
        hasBearer: parts[0] === 'Bearer',
        tokenLength: parts[1] ? parts[1].length : 0,
        tokenValue: parts[1] ? (parts[1].substring(0, 50) + (parts[1].length > 50 ? '...' : '')) : 'нет токена',
        isUndefined: parts[1] === 'undefined',
        isNull: parts[1] === 'null',
        isEmpty: parts[1] === ''
    };
    
    if (parts[1] && parts[1].length > 10 && parts[1] !== 'undefined' && parts[1] !== 'null') {
        try {
            const decoded = jwt.decode(parts[1]);
            if (decoded) {
                result.tokenInfo.decoded = {
                    id: decoded.id,
                    username: decoded.username,
                    email: decoded.email,
                    role: decoded.role,
                    salt: decoded.salt ? 'присутствует' : 'отсутствует',
                    createdAt: decoded.createdAt ? new Date(decoded.createdAt).toISOString() : null
                };
                result.tokenInfo.isValidFormat = true;
                result.tokenInfo.note = 'Этот токен БЕССРОЧНЫЙ - никогда не истечет!';
            }
        } catch (e) {
            result.tokenInfo.decodeError = e.message;
            result.tokenInfo.isValidFormat = false;
        }
        
        try {
            const verified = jwt.verify(parts[1], JWT_SECRET);
            result.tokenInfo.verification = {
                success: true,
                user: {
                    id: verified.id,
                    username: verified.username,
                    email: verified.email,
                    role: verified.role
                }
            };
        } catch (e) {
            result.tokenInfo.verification = {
                success: false,
                error: e.message,
                errorType: e.name
            };
        }
    }
    
    console.log('🔍 Результат диагностики:', JSON.stringify(result, null, 2));
    
    res.json(result);
});

// Эндпоинт для проверки структуры localStorage
app.get('/api/check-localstorage', (req, res) => {
    console.log('📋 Запрос на проверку структуры localStorage');
    
    res.json({
        success: true,
        localStorageStructure: {
            user: {
                description: 'Должен содержать объект пользователя с полями: id, username, email, role, token',
                example: JSON.stringify({
                    id: 1,
                    username: 'user',
                    email: 'user@example.com',
                    role: 'user',
                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                }, null, 2)
            },
            note: 'Токены БЕССРОЧНЫЕ - никогда не истекают!',
            commonIssues: [
                '1. Токен не сохраняется при входе',
                '2. Токен сохраняется как "undefined" строка',
                '3. localStorage.getItem("user") возвращает null',
                '4. Пользователь вышел, но данные остались'
            ],
            solutions: [
                '1. Очистить localStorage: localStorage.clear()',
                '2. Войти заново',
                '3. Проверить код входа на фронтенде',
                '4. Использовать Developer Tools -> Application -> Local Storage'
            ]
        }
    });
});

// ========== ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ ==========

// Путь к базе данных
const dbPath = path.join(__dirname, 'database.db');
console.log(`🗃️  База данных: ${dbPath}`);

// Подключение к SQLite
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Подключено к SQLite базе данных');
        initDatabase();
    }
});

// Функция для добавления отсутствующих колонок в таблицу
function addMissingColumns() {
    console.log('🔧 Проверка структуры таблиц...');
    
    db.all(`PRAGMA table_info(users)`, [], (err, columns) => {
        if (err) {
            console.error('❌ Ошибка проверки структуры таблицы users:', err.message);
            return;
        }
        
        const existingColumns = columns.map(col => col.name);
        console.log('📊 Существующие колонки в users:', existingColumns);
        
        const requiredColumns = [
            { name: 'is_banned', type: 'INTEGER DEFAULT 0' },
            { name: 'ban_reason', type: 'TEXT' },
            { name: 'banned_at', type: 'DATETIME' },
            { name: 'notes', type: 'TEXT' },
            { name: 'updated_at', type: 'DATETIME' },
            { name: 'avatar', type: 'TEXT' },
            { name: 'avatar_type', type: 'TEXT DEFAULT "initials"' }
        ];
        
        requiredColumns.forEach(col => {
            if (!existingColumns.includes(col.name)) {
                console.log(`➕ Добавляем колонку ${col.name} в таблицу users`);
                db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, (err) => {
                    if (err) {
                        console.error(`❌ Ошибка добавления колонки ${col.name}:`, err.message);
                    } else {
                        console.log(`✅ Колонка ${col.name} добавлена`);
                    }
                });
            }
        });
    });
    
    db.all('PRAGMA table_info(products)', [], (err, columns) => {
        if (err) {
            console.error('❌ Ошибка проверки структуры таблицы products:', err.message);
            return;
        }
        
        const existingColumns = columns.map(col => col.name);
        console.log('📊 Существующие колонки в products:', existingColumns);
        
        const requiredColumns = [
            { name: 'is_active', type: 'INTEGER DEFAULT 1' },
            { name: 'slug', type: 'TEXT' },
            { name: 'updated_at', type: 'DATETIME' }
        ];
        
        requiredColumns.forEach(col => {
            if (!existingColumns.includes(col.name)) {
                console.log(`➕ Добавляем колонку ${col.name} в таблицу products`);
                db.run(`ALTER TABLE products ADD COLUMN ${col.name} ${col.type}`, (err) => {
                    if (err) {
                        console.error(`❌ Ошибка добавления колонки ${col.name}:`, err.message);
                    } else {
                        console.log(`✅ Колонка ${col.name} добавлена`);
                    }
                });
            }
        });
    });
    
    db.all('PRAGMA table_info(categories)', [], (err, columns) => {
        if (err) {
            console.error('❌ Ошибка проверки структуры таблицы categories:', err.message);
            return;
        }
        
        const existingColumns = columns.map(col => col.name);
        console.log('📊 Существующие колонки в categories:', existingColumns);
        
        const requiredColumns = [
            { name: 'is_active', type: 'INTEGER DEFAULT 1' },
            { name: 'updated_at', type: 'DATETIME' }
        ];
        
        requiredColumns.forEach(col => {
            if (!existingColumns.includes(col.name)) {
                console.log(`➕ Добавляем колонку ${col.name} в таблицу categories`);
                db.run(`ALTER TABLE categories ADD COLUMN ${col.name} ${col.type}`, (err) => {
                    if (err) {
                        console.error(`❌ Ошибка добавления колонки ${col.name}:`, err.message);
                    } else {
                        console.log(`✅ Колонка ${col.name} добавлена`);
                    }
                });
            }
        });
    });
    
    db.all(`PRAGMA table_info(orders)`, [], (err, columns) => {
        if (err) {
            console.error('❌ Ошибка проверки структуры таблицы orders:', err.message);
            return;
        }
        
        const existingColumns = columns.map(col => col.name);
        console.log('📊 Существующие колонки в orders:', existingColumns);
        
        const requiredColumns = [
            { name: 'order_number', type: 'TEXT' },
            { name: 'city', type: 'TEXT' },
            { name: 'postal_code', type: 'TEXT' },
            { name: 'delivery_method', type: 'TEXT DEFAULT "courier"' },
            { name: 'delivery_cost', type: 'REAL DEFAULT 0' },
            { name: 'comments', type: 'TEXT' }
        ];
        
        requiredColumns.forEach(col => {
            if (!existingColumns.includes(col.name)) {
                console.log(`➕ Добавляем колонку ${col.name} в таблицу orders`);
                db.run(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.type}`, (err) => {
                    if (err) {
                        console.error(`❌ Ошибка добавления колонки ${col.name}:`, err.message);
                    } else {
                        console.log(`✅ Колонка ${col.name} добавлена`);
                    }
                });
            }
        });
    });
}

// Инициализация базы данных
function initDatabase() {
    console.log('🔄 Инициализация базы данных...');
    
    // Проверяем, первый ли это запуск
    const firstRun = isFirstRun();
    console.log(`🔍 Первый запуск: ${firstRun ? 'ДА' : 'НЕТ'}`);
    
    // СНАЧАЛА создаём ВСЕ таблицы
    console.log('📋 Создание таблиц...');
    
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        is_banned INTEGER DEFAULT 0,
        ban_reason TEXT,
        banned_at DATETIME,
        notes TEXT,
        avatar TEXT,
        avatar_type TEXT DEFAULT 'initials',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('❌ Ошибка создания таблицы users:', err.message);
        else console.log('✅ Таблица users создана/проверена');
    });
    
    // Таблица категорий
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        icon TEXT DEFAULT 'fas fa-microchip',
        color TEXT DEFAULT '#4f46e5',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('❌ Ошибка создания таблицы categories:', err.message);
        else console.log('✅ Таблица categories создана/проверена');
    });
    
    // Таблица товаров
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT,
        description TEXT,
        price REAL NOT NULL,
        old_price REAL,
        category_id INTEGER,
        stock INTEGER DEFAULT 10,
        image_url TEXT DEFAULT 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
        rating REAL DEFAULT 4.5,
        reviews_count INTEGER DEFAULT 0,
        is_featured BOOLEAN DEFAULT 0,
        is_new BOOLEAN DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
    )`, (err) => {
        if (err) console.error('❌ Ошибка создания таблицы products:', err.message);
        else console.log('✅ Таблица products создана/проверена');
    });
    
    // Таблица заказов
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        shipping_address TEXT,
        payment_method TEXT DEFAULT 'card',
        notes TEXT,
        order_number TEXT,
        city TEXT,
        postal_code TEXT,
        delivery_method TEXT DEFAULT 'courier',
        delivery_cost REAL DEFAULT 0,
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) console.error('❌ Ошибка создания таблицы orders:', err.message);
        else console.log('✅ Таблица orders создана/проверена');
    });
    
    // Таблица элементов заказа
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`, (err) => {
        if (err) console.error('❌ Ошибка создания таблицы order_items:', err.message);
        else console.log('✅ Таблица order_items создана/проверена');
    });
    
    // Таблица избранного
    db.run(`CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (product_id) REFERENCES products (id),
        UNIQUE(user_id, product_id)
    )`, (err) => {
        if (err) console.error('❌ Ошибка создания таблицы favorites:', err.message);
        else console.log('✅ Таблица favorites создана/проверена');
    });
    
    console.log('✅ Все таблицы созданы/проверены');
    
    // Добавляем недостающие колонки
    setTimeout(() => {
        addMissingColumns();
    }, 500);
    
    // ========== ПРОВЕРКА И ДОБАВЛЕНИЕ ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ (ВСЕГДА) ==========
    setTimeout(() => {
        console.log('👥 Проверка тестовых пользователей...');
        
        // Администратор
        db.get('SELECT COUNT(*) as count FROM users WHERE email = ?', ['admin@pcstore.ru'], (err, row) => {
            if (!err && row.count === 0) {
                const adminPassword = bcrypt.hashSync('admin123', 10);
                db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, 
                    ['admin', 'admin@pcstore.ru', adminPassword, 'admin'],
                    (err) => {
                        if (!err) console.log('👑 Администратор создан (admin@pcstore.ru / admin123)');
                    }
                );
            } else {
                console.log('✅ Администратор уже существует');
            }
        });
        
        // Второй администратор
        db.get('SELECT COUNT(*) as count FROM users WHERE email = ?', ['admin2@pcstore.ru'], (err, row) => {
            if (!err && row.count === 0) {
                const admin2Password = bcrypt.hashSync('admin456', 10);
                db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, 
                    ['admin2', 'admin2@pcstore.ru', admin2Password, 'admin'],
                    (err) => {
                        if (!err) console.log('👑 Второй администратор создан (admin2@pcstore.ru / admin456)');
                    }
                );
            }
        });
        
        // Тестовый пользователь
        db.get('SELECT COUNT(*) as count FROM users WHERE email = ?', ['user@pcstore.ru'], (err, row) => {
            if (!err && row.count === 0) {
                const userPassword = bcrypt.hashSync('user123', 10);
                db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, 
                    ['user', 'user@pcstore.ru', userPassword, 'user'],
                    (err) => {
                        if (!err) console.log('👤 Тестовый пользователь создан (user@pcstore.ru / user123)');
                    }
                );
            }
        });
        
        // Модератор
        db.get('SELECT COUNT(*) as count FROM users WHERE email = ?', ['moderator@pcstore.ru'], (err, row) => {
            if (!err && row.count === 0) {
                const modPassword = bcrypt.hashSync('mod123', 10);
                db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, 
                    ['moderator', 'moderator@pcstore.ru', modPassword, 'moderator'],
                    (err) => {
                        if (!err) console.log('👤 Модератор создан (moderator@pcstore.ru / mod123)');
                    }
                );
            }
        });
    }, 1000);
    
    // ========== ПРОВЕРКА И ДОБАВЛЕНИЕ КАТЕГОРИЙ (ВСЕГДА) ==========
    setTimeout(() => {
        console.log('📂 Проверка категорий...');
        
        db.get('SELECT COUNT(*) as count FROM categories', [], (err, row) => {
            if (!err && row.count === 0) {
                console.log('📂 Категории не найдены — создаём...');
                
                const categories = [
                    ['Процессоры', 'processors', 'Процессоры Intel и AMD', 'fas fa-microchip', '#3b82f6'],
                    ['Видеокарты', 'video-cards', 'Видеокарты NVIDIA и AMD', 'fas fa-gamepad', '#ef4444'],
                    ['Материнские платы', 'motherboards', 'Материнские платы для ПК', 'fas fa-server', '#10b981'],
                    ['Оперативная память', 'ram', 'Оперативная память DDR4/DDR5', 'fas fa-memory', '#f59e0b'],
                    ['Накопители', 'storage', 'SSD и HDD накопители', 'fas fa-hdd', '#8b5cf6'],
                    ['Блоки питания', 'power-supplies', 'Блоки питания для ПК', 'fas fa-plug', '#6366f1'],
                    ['Корпуса', 'cases', 'Корпуса для компьютеров', 'fas fa-desktop', '#64748b'],
                    ['Охлаждение', 'cooling', 'Системы охлаждения', 'fas fa-wind', '#06b6d4']
                ];
                
                const stmt = db.prepare(`INSERT INTO categories (name, slug, description, icon, color) VALUES (?, ?, ?, ?, ?)`);
                categories.forEach(([name, slug, description, icon, color]) => {
                    stmt.run([name, slug, description, icon, color]);
                });
                stmt.finalize();
                
                console.log('✅ Категории созданы (8 шт.)');
            } else {
                console.log(`✅ Категории уже существуют (${row ? row.count : '?'} шт.)`);
            }
        });
    }, 1500);
    
    // Отмечаем, что инициализация выполнена
    if (firstRun) {
        markInitialized();
    }
    
    console.log('🎉 Инициализация базы данных завершена');
}

// ========== ИСПРАВЛЕННЫЙ ГЛАВНЫЙ ЭНДПОИНТ ДЛЯ СОЗДАНИЯ ЗАКАЗА ==========
app.post('/api/orders', authenticateToken, (req, res) => {
    console.log('\n🛒 ===== ЗАПРОС НА СОЗДАНИЕ ЗАКАЗА (ПОЛНЫЙ ФОРМАТ) =====');
    console.log('👤 Пользователь:', req.user.id, req.user.username);
    console.log('📦 Тело запроса:', JSON.stringify(req.body, null, 2));
    
    try {
        const orderData = req.body;
        const userId = req.user.id;
        
        let calculatedSubtotal = 0;
        let itemsCount = 0;
        
        console.log('🧮 Расчет суммы заказа:');
        
        if (orderData.items && orderData.items.length > 0) {
            orderData.items.forEach((item, index) => {
                const itemTotal = Number(item.price) * Number(item.quantity);
                calculatedSubtotal += itemTotal;
                itemsCount += item.quantity;
                console.log(`  ${index + 1}. ${item.product_name}: ${item.price} × ${item.quantity} = ${itemTotal} ₽`);
            });
        }
        
        const deliveryCost = Number(orderData.delivery_cost) || 0;
        const calculatedTotal = calculatedSubtotal + deliveryCost;
        const receivedTotal = Number(orderData.total_amount) || 0;
        
        console.log('💰 Итоги расчета:');
        console.log(`  Сумма товаров: ${calculatedSubtotal} ₽`);
        console.log(`  Стоимость доставки: ${deliveryCost} ₽`);
        console.log(`  Итого (расчет): ${calculatedTotal} ₽`);
        console.log(`  Итого (в запросе): ${receivedTotal} ₽`);
        
        const difference = Math.abs(calculatedTotal - receivedTotal);
        
        if (difference > 1) {
            console.log(`⚠️  РАСХОЖДЕНИЕ В СУММАХ! Разница: ${difference} ₽`);
            console.log('🔍 Принимаю расчетную сумму как правильную');
            orderData.total_amount = calculatedTotal;
        } else {
            console.log('✅ Суммы совпадают (разница < 1 рубля)');
        }
        
        if (!orderData.items || orderData.items.length === 0) {
            console.log('❌ ОШИБКА: корзина пуста');
            return res.status(400).json({
                success: false,
                message: 'Корзина пуста'
            });
        }
        
        if (!orderData.shipping_address || orderData.shipping_address.trim() === '') {
            console.log('❌ ОШИБКА: не указан адрес доставки');
            return res.status(400).json({
                success: false,
                message: 'Укажите адрес доставки'
            });
        }
        
        const finalTotal = orderData.total_amount || calculatedTotal;
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            const orderNumber = 'ORD-' + Date.now().toString().slice(-8);
            
            const orderQuery = `
                INSERT INTO orders (
                    user_id, order_number, total_amount, status, 
                    shipping_address, city, postal_code, delivery_method, 
                    delivery_cost, payment_method, comments, created_at
                ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            const orderParams = [
                userId,
                orderNumber,
                finalTotal,
                orderData.shipping_address || '',
                orderData.city || '',
                orderData.postalCode || '',
                orderData.delivery_method || 'courier',
                deliveryCost,
                orderData.payment_method || 'card',
                orderData.comments || ''
            ];
            
            console.log('📝 Создаю заказ с номером:', orderNumber);
            console.log('📝 Параметры заказа:', orderParams);
            
            db.run(orderQuery, orderParams, function(err) {
                if (err) {
                    if (err.message.includes('no such column') || err.message.includes('has no column')) {
                        console.log('⚠️  Проблема со структурой таблицы, пробую альтернативный запрос...');
                        
                        const altQuery = `
                            INSERT INTO orders (
                                user_id, total_amount, shipping_address, payment_method, created_at
                            ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                        `;
                        
                        const altParams = [
                            userId,
                            finalTotal,
                            orderData.shipping_address || '',
                            orderData.payment_method || 'card'
                        ];
                        
                        db.run(altQuery, altParams, function(altErr) {
                            if (altErr) {
                                db.run('ROLLBACK');
                                console.error('❌ ОШИБКА альтернативного SQL:', altErr.message);
                                return res.status(500).json({
                                    success: false,
                                    message: 'Ошибка создания заказа: ' + altErr.message,
                                    debug: {
                                        originalError: err.message,
                                        alternativeError: altErr.message,
                                        tableStructure: 'Таблица orders может иметь неполную структуру'
                                    }
                                });
                            }
                            
                            const orderId = this.lastID;
                            console.log(`✅ Заказ создан через альтернативный запрос, ID: ${orderId}`);
                            processOrderItems(orderId, finalTotal, orderNumber);
                        });
                    } else {
                        db.run('ROLLBACK');
                        console.error('❌ ОШИБКА SQL при создании заказа:', err.message);
                        return res.status(500).json({
                            success: false,
                            message: 'Ошибка создания заказа в базе данных: ' + err.message
                        });
                    }
                } else {
                    const orderId = this.lastID;
                    console.log(`✅ Заказ создан в БД, ID: ${orderId}, номер: ${orderNumber}`);
                    processOrderItems(orderId, finalTotal, orderNumber);
                }
            });
            
            function processOrderItems(orderId, totalAmount, orderNumber) {
                let itemsProcessed = 0;
                let hasError = false;
                
                orderData.items.forEach((item, index) => {
                    const itemQuery = `
                        INSERT INTO order_items (order_id, product_id, quantity, price)
                        VALUES (?, ?, ?, ?)
                    `;
                    
                    const itemParams = [
                        orderId,
                        item.product_id,
                        item.quantity,
                        item.price
                    ];
                    
                    db.run(itemQuery, itemParams, (err) => {
                        if (err) {
                            if (err.message.includes('no such column') || err.message.includes('has no column')) {
                                console.log('⚠️  Проблема со структурой order_items, пробую альтернативный запрос...');
                                
                                const altItemQuery = `
                                    INSERT INTO order_items (order_id, product_id, quantity, price, product_name)
                                    VALUES (?, ?, ?, ?, ?)
                                `;
                                
                                const altItemParams = [
                                    orderId,
                                    item.product_id,
                                    item.quantity,
                                    item.price,
                                    item.product_name || `Товар ${item.product_id}`
                                ];
                                
                                db.run(altItemQuery, altItemParams, (altErr) => {
                                    if (altErr) {
                                        hasError = true;
                                        db.run('ROLLBACK');
                                        console.error('❌ ОШИБКА альтернативного добавления товара:', altErr.message);
                                        return res.status(500).json({
                                            success: false,
                                            message: 'Ошибка добавления товара в заказ'
                                        });
                                    }
                                    
                                    itemsProcessed++;
                                    console.log(`✅ Товар ${item.product_id} добавлен (альтернативно) (${itemsProcessed}/${orderData.items.length})`);
                                    checkIfComplete();
                                });
                            } else {
                                hasError = true;
                                db.run('ROLLBACK');
                                console.error('❌ ОШИБКА добавления товара:', err.message);
                                return res.status(500).json({
                                    success: false,
                                    message: 'Ошибка добавления товара в заказ'
                                });
                            }
                        } else {
                            itemsProcessed++;
                            console.log(`✅ Товар ${item.product_id} добавлен (${itemsProcessed}/${orderData.items.length})`);
                            checkIfComplete();
                        }
                    });
                });
                
                function checkIfComplete() {
                    if (itemsProcessed === orderData.items.length && !hasError) {
                        db.run('COMMIT', (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                console.error('❌ ОШИБКА коммита транзакции:', err.message);
                                return res.status(500).json({
                                    success: false,
                                    message: 'Ошибка фиксации заказа'
                                });
                            }
                            
                            console.log(`🎉 ===== ЗАКАЗ #${orderId} УСПЕШНО ОФОРМЛЕН! =====`);
                            console.log(`💰 Сумма: ${totalAmount} руб.`);
                            console.log(`📦 Товаров: ${orderData.items.length} шт. (${itemsCount} единиц)`);
                            console.log(`🚚 Доставка: ${orderData.shipping_address}`);
                            console.log(`💳 Оплата: ${orderData.payment_method}`);
                            
                            const orderLogData = {
                                orderId: orderId,
                                orderNumber: orderNumber,
                                userId: userId,
                                username: req.user.username,
                                totalAmount: totalAmount,
                                itemsCount: orderData.items.length,
                                shippingAddress: orderData.shipping_address,
                                deliveryMethod: orderData.delivery_method,
                                paymentMethod: orderData.payment_method,
                                timestamp: new Date().toISOString()
                            };
                            
                            logger.logOrder(orderLogData);
                            
                            res.json({
                                success: true,
                                message: 'Заказ успешно оформлен!',
                                order: {
                                    id: orderId,
                                    order_number: orderNumber,
                                    total_amount: totalAmount,
                                    status: 'pending',
                                    items_count: orderData.items.length,
                                    shipping_address: orderData.shipping_address,
                                    payment_method: orderData.payment_method,
                                    created_at: new Date().toISOString()
                                },
                                clearCart: true
                            });
                        });
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('💥 НЕОБРАБОТАННАЯ ОШИБКА при создании заказа:', error);
        res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера при создании заказа'
        });
    }
});

// ========== АДМИН ЭНДПОИНТЫ ==========
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    console.log('👥 Запрос всех пользователей (админ)');
    
    db.all(`SELECT id, username, email, role, 
                   COALESCE(is_banned, 0) as is_banned, 
                   ban_reason, 
                   created_at,
                   avatar,
                   avatar_type
            FROM users 
            ORDER BY id DESC`, [], (err, users) => {
        if (err) {
            console.error('❌ Ошибка получения пользователей:', err.message);
            return res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        }
        
        console.log(`✅ Получено ${users.length} пользователей для админ-панели`);
        
        res.json({
            success: true,
            users: users,
            count: users.length
        });
    });
});

app.get('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log(`👤 Запрос пользователя ID: ${id} (админ)`);
    
    db.get(`SELECT id, username, email, role, 
                   COALESCE(is_banned, 0) as is_banned, 
                   ban_reason, created_at,
                   avatar, avatar_type
            FROM users WHERE id = ?`, [id], (err, user) => {
        if (err) {
            console.error('❌ Ошибка получения пользователя:', err.message);
            return res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        }
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        console.log(`✅ Пользователь найден: ${user.username}`);
        
        res.json({
            success: true,
            user: user
        });
    });
});

app.post('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    const { username, email, password, role = 'user' } = req.body;
    
    console.log('👤 Создание нового пользователя (админ):', { username, email, role });
    
    if (!username || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Все поля обязательны' 
        });
    }
    
    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Пароль должен содержать минимум 6 символов'
        });
    }
    
    if (!email.includes('@')) {
        return res.status(400).json({
            success: false,
            message: 'Введите корректный email'
        });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, 
        [username, email, hashedPassword, role], 
        function(err) {
            if (err) {
                console.error('❌ Ошибка создания пользователя:', err.message);
                
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Пользователь уже существует' 
                    });
                }
                return res.status(500).json({ 
                    success: false, 
                    message: 'Ошибка базы данных' 
                });
            }
            
            const userId = this.lastID;
            console.log(`✅ Пользователь создан: ${username} (ID: ${userId}, роль: ${role})`);
            
            res.json({
                success: true,
                message: 'Пользователь успешно создан',
                userId: userId
            });
        }
    );
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { username, email, password, role, is_banned, ban_reason } = req.body;
    
    console.log(`✏️ Обновление пользователя ID: ${id} (админ)`, { username, email, role });
    
    if (!username || !email) {
        return res.status(400).json({ 
            success: false, 
            message: 'Имя пользователя и email обязательны' 
        });
    }
    
    let updateFields = ['username = ?', 'email = ?', 'role = ?', 'updated_at = CURRENT_TIMESTAMP'];
    let params = [username, email, role];
    
    if (password) {
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Пароль должен содержать минимум 6 символов'
            });
        }
        const hashedPassword = bcrypt.hashSync(password, 10);
        updateFields.push('password = ?');
        params.push(hashedPassword);
    }
    
    if (is_banned !== undefined) {
        updateFields.push('is_banned = ?');
        params.push(is_banned ? 1 : 0);
        
        if (is_banned && ban_reason) {
            updateFields.push('ban_reason = ?');
            params.push(ban_reason);
            updateFields.push('banned_at = CURRENT_TIMESTAMP');
        } else if (!is_banned) {
            updateFields.push('ban_reason = NULL');
            updateFields.push('banned_at = NULL');
        }
    }
    
    params.push(id);
    
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    
    db.run(query, params, function(err) {
        if (err) {
            console.error('❌ Ошибка обновления пользователя:', err.message);
            
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Пользователь с таким email уже существует' 
                });
            }
            return res.status(500).json({ 
                success: false, 
                message: 'Ошибка базы данных' 
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        console.log(`✅ Пользователь обновлен: ${username} (ID: ${id})`);
        
        res.json({
            success: true,
            message: 'Пользователь успешно обновлен'
        });
    });
});

app.post('/api/admin/users/:id/ban', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    console.log(`🔒 Бан пользователя ID: ${id}, причина: ${reason || 'не указана'}`);
    
    const query = `UPDATE users SET is_banned = 1, ban_reason = ?, banned_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.run(query, [reason || 'Нарушение правил', id], function(err) {
        if (err) {
            console.error('❌ Ошибка бана пользователя:', err.message);
            return res.status(500).json({ 
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        console.log(`✅ Пользователь забанен ID: ${id}`);
        
        res.json({
            success: true,
            message: 'Пользователь успешно забанен'
        });
    });
});

app.post('/api/admin/users/:id/unban', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log(`🔓 Разбан пользователя ID: ${id}`);
    
    const query = `UPDATE users SET is_banned = 0, ban_reason = NULL, banned_at = NULL WHERE id = ?`;
    
    db.run(query, [id], function(err) {
        if (err) {
            console.error('❌ Ошибка разбана пользователя:', err.message);
            return res.status(500).json({ 
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }
        
        console.log(`✅ Пользователь разбанен ID: ${id}`);
        
        res.json({
            success: true,
            message: 'Пользователь успешно разбанен'
        });
    });
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log(`🗑️ Удаление пользователя ID: ${id} (админ)`);
    
    if (req.user.id.toString() === id) {
        return res.status(400).json({
            success: false,
            message: 'Нельзя удалить свой собственный аккаунт'
        });
    }
    
    db.get('SELECT COUNT(*) as count FROM orders WHERE user_id = ?', [id], (err, result) => {
        if (err) {
            console.error('❌ Ошибка проверки заказов пользователя:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        if (result.count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Нельзя удалить пользователя, у которого есть заказы'
            });
        }
        
        db.get('SELECT username FROM users WHERE id = ?', [id], (err, user) => {
            if (err) {
                console.error('❌ Ошибка при получении пользователя для удаления:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка базы данных'
                });
            }
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Пользователь не найден'
                });
            }
            
            db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error('❌ Ошибка удаления пользователя:', err.message);
                    return res.status(500).json({ 
                        success: false,
                        message: 'Ошибка базы данных'
                    });
                }
                
                console.log(`✅ Пользователь удален: ${user.username} (ID: ${id})`);
                
                res.json({
                    success: true,
                    message: 'Пользователь успешно удален'
                });
            });
        });
    });
});

app.get('/api/admin/products', authenticateToken, requireAdmin, (req, res) => {
    console.log('🛍️ Запрос всех товаров (админ)');
    
    const query = `
        SELECT p.*, 
               c.name as category_name, 
               c.slug as category_slug,
               COALESCE(p.is_active, 1) as is_active
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.id DESC
    `;
    
    db.all(query, [], (err, products) => {
        if (err) {
            console.error('❌ Ошибка получения товаров (админ):', err.message);
            return res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        }
        
        console.log(`✅ Получено ${products.length} товаров для админ-панели`);
        
        res.json({
            success: true,
            products: products,
            count: products.length
        });
    });
});

// Сброс счётчика AUTOINCREMENT для продуктов
app.post('/api/admin/products/reset-counter', authenticateToken, requireAdmin, (req, res) => {
    db.run('DELETE FROM sqlite_sequence WHERE name = "products"', (err) => {
        if (err) {
            console.error('❌ Ошибка сброса счётчика:', err.message);
            return res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
        console.log('✅ Счётчик продуктов сброшен');
        res.json({ success: true, message: 'Счётчик сброшен' });
    });
});

app.post('/api/admin/products', authenticateToken, requireAdmin, (req, res) => {
    const { name, description, price, category_id, stock = 10, image_url, is_active = 1 } = req.body;
    
    console.log('🆕 Создание нового товара (админ):', { name, price });
    
    if (!name || !price) {
        return res.status(400).json({ 
            success: false, 
            message: 'Название и цена обязательны' 
        });
    }
    
    if (price <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Цена должна быть больше 0'
        });
    }
    
    if (stock < 0) {
        return res.status(400).json({
            success: false,
            message: 'Количество не может быть отрицательным'
        });
    }
    
    const slug = name.toLowerCase()
        .replace(/[^a-z0-9а-яё\s]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    
    // ИСПРАВЛЕННЫЙ ЗАПРОС — rating = 0, reviews_count = 0
    const query = `
        INSERT INTO products (name, slug, description, price, category_id, stock, image_url, is_active, rating, reviews_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `;
    
    db.run(query, [
        name, 
        slug, 
        description || '', 
        parseFloat(price), 
        category_id || null, 
        parseInt(stock), 
        image_url || 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', 
        is_active ? 1 : 0
    ], function(err) {
        if (err) {
            console.error('❌ Ошибка создания товара:', err.message);
            return res.status(500).json({ 
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        const productId = this.lastID;
        console.log(`✅ Товар создан: ${name} (ID: ${productId}, rating: 0)`);
        
        res.json({
            success: true,
            message: 'Товар успешно создан',
            productId: productId
        });
    });
});

app.put('/api/admin/products/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, description, price, category_id, stock, image_url, is_active } = req.body;
    
    console.log(`✏️ Обновление товара ID: ${id} (админ)`, { name, price });
    
    if (!name || !price) {
        return res.status(400).json({ 
            success: false, 
            message: 'Название и цена обязательны' 
        });
    }
    
    if (price <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Цена должна быть больше 0'
        });
    }
    
    if (stock < 0) {
        return res.status(400).json({
            success: false,
            message: 'Количество не может быть отрицательным'
        });
    }
    
    const slug = name.toLowerCase()
        .replace(/[^a-z0-9а-яё\s]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    
    const query = `
        UPDATE products 
        SET name = ?, slug = ?, description = ?, price = ?, 
            category_id = ?, stock = ?, image_url = ?, 
            is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    
    const params = [
        name,
        slug,
        description || '',
        parseFloat(price),
        category_id || null,
        parseInt(stock) || 10,
        image_url || 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        parseInt(id)
    ];
    
    db.run(query, params, function(err) {
        if (err) {
            console.error('❌ Ошибка обновления товара:', err.message);
            return res.status(500).json({ 
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Товар не найден'
            });
        }
        
        console.log(`✅ Товар обновлен: ${name} (ID: ${id})`);
        
        res.json({
            success: true,
            message: 'Товар успешно обновлен'
        });
    });
});

app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log(`🗑️ Удаление товара ID: ${id} (админ)`);
    
    db.get('SELECT name FROM products WHERE id = ?', [id], (err, product) => {
        if (err) {
            console.error('❌ Ошибка при получении товара для удаления:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Товар не найден'
            });
        }
        
        db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
            if (err) {
                console.error('❌ Ошибка удаления товара:', err.message);
                return res.status(500).json({ 
                    success: false,
                    message: 'Ошибка базы данных'
                });
            }
            
            console.log(`✅ Товар удален: ${product.name} (ID: ${id})`);
            
            res.json({
                success: true,
                message: 'Товар успешно удален'
            });
        });
    });
});

app.get('/api/admin/categories', authenticateToken, requireAdmin, (req, res) => {
    console.log('📂 Запрос всех категорий (админ)');
    
    db.all(`SELECT *, COALESCE(is_active, 1) as is_active FROM categories ORDER BY id DESC`, [], (err, categories) => {
        if (err) {
            console.error('❌ Ошибка получения категорий (админ):', err.message);
            return res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        }
        
        console.log(`✅ Получено ${categories.length} категорий для админ-панели`);
        
        res.json({
            success: true,
            categories: categories,
            count: categories.length
        });
    });
});

app.post('/api/admin/categories', authenticateToken, requireAdmin, (req, res) => {
    const { name, slug, description, icon = 'fas fa-microchip', color = '#4f46e5', is_active = 1 } = req.body;
    
    console.log('📁 Создание новой категории (админ):', { name, slug });
    
    if (!name || !slug) {
        return res.status(400).json({ 
            success: false, 
            message: 'Название и slug обязательны' 
        });
    }
    
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({
            success: false,
            message: 'Slug может содержать только латинские буквы, цифры и дефисы'
        });
    }
    
    const query = `
        INSERT INTO categories (name, slug, description, icon, color, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [name, slug, description || '', icon, color, is_active ? 1 : 0], function(err) {
        if (err) {
            console.error('❌ Ошибка создания категории:', err.message);
            
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Категория с таким slug уже существует' 
                });
            }
            return res.status(500).json({ 
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        const categoryId = this.lastID;
        console.log(`✅ Категория создана: ${name} (ID: ${categoryId}, slug: ${slug})`);
        
        res.json({
            success: true,
            message: 'Категория успешно создана',
            categoryId: categoryId
        });
    });
});

app.put('/api/admin/categories/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, slug, description, icon, color, is_active } = req.body;
    
    console.log(`✏️ Обновление категории ID: ${id} (админ)`, { name, slug });
    
    if (!name || !slug) {
        return res.status(400).json({ 
            success: false, 
            message: 'Название и slug обязательны' 
        });
    }
    
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({
            success: false,
            message: 'Slug может содержать только латинские буквы, цифры и дефисы'
        });
    }
    
    const query = `
        UPDATE categories 
        SET name = ?, slug = ?, description = ?, 
            icon = ?, color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    
    const params = [
        name,
        slug,
        description || '',
        icon || 'fas fa-microchip',
        color || '#4f46e5',
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        parseInt(id)
    ];
    
    db.run(query, params, function(err) {
        if (err) {
            console.error('❌ Ошибка обновления категории:', err.message);
            
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Категория с таким slug уже существует' 
                });
            }
            return res.status(500).json({ 
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Категория не найдена'
            });
        }
        
        console.log(`✅ Категория обновлена: ${name} (ID: ${id}, slug: ${slug})`);
        
        res.json({
            success: true,
            message: 'Категория успешно обновлена'
        });
    });
});

app.delete('/api/admin/categories/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log(`🗑️ Удаление категории ID: ${id} (админ)`);
    
    db.get('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [id], (err, result) => {
        if (err) {
            console.error('❌ Ошибка при проверке товаров категории:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        if (result.count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Нельзя удалить категорию, в которой есть товары'
            });
        }
        
        db.get('SELECT name FROM categories WHERE id = ?', [id], (err, category) => {
            if (err) {
                console.error('❌ Ошибка при получении категории для удаления:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка базы данных'
                });
            }
            
            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Категория не найдена'
                });
            }
            
            db.run('DELETE FROM categories WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error('❌ Ошибка удаления категории:', err.message);
                    return res.status(500).json({ 
                        success: false,
                        message: 'Ошибка базы данных'
                    });
                }
                
                console.log(`✅ Категория удалена: ${category.name} (ID: ${id})`);
                
                res.json({
                    success: true,
                    message: 'Категория успешно удалена'
                });
            });
        });
    });
});

app.get('/api/admin/orders', authenticateToken, requireAdmin, (req, res) => {
    console.log('📋 Запрос всех заказов (админ)');
    
    const query = `
        SELECT o.*, u.username, u.email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
    `;
    
    db.all(query, [], (err, orders) => {
        if (err) {
            console.error('❌ Ошибка получения заказов (админ):', err.message);
            return res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        }
        
        console.log(`✅ Получено ${orders.length} заказов для админ-панели`);
        
        res.json({
            success: true,
            orders: orders,
            count: orders.length
        });
    });
});

app.get('/api/admin/orders/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log(`📦 Запрос заказа ID: ${id} (админ)`);
    
    const orderQuery = `
        SELECT o.*, u.username, u.email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
    `;
    
    db.get(orderQuery, [id], (err, order) => {
        if (err) {
            console.error('❌ Ошибка получения заказа:', err.message);
            return res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        }
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Заказ не найден'
            });
        }
        
        const itemsQuery = `
            SELECT oi.*, p.name, p.image_url
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `;
        
        db.all(itemsQuery, [id], (err, items) => {
            if (err) {
                console.error('❌ Ошибка получения товаров заказа:', err.message);
                return res.status(500).json({ 
                    success: false,
                    error: 'Ошибка сервера'
                });
            }
            
            order.items = items;
            
            console.log(`✅ Заказ найден: #${order.id}, товаров: ${items.length}`);
            
            res.json({
                success: true,
                order: order
            });
        });
    });
});

app.put('/api/admin/orders/:id/status', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    console.log(`✏️ Обновление статуса заказа ID: ${id} (админ)`, { status });
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Неверный статус заказа' 
        });
    }
    
    db.run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id], function(err) {
        if (err) {
            console.error('❌ Ошибка обновления статуса заказа:', err.message);
            return res.status(500).json({ 
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Заказ не найден'
            });
        }
        
        console.log(`✅ Статус заказа обновлен: ID: ${id}, новый статус: ${status}`);
        
        res.json({
            success: true,
            message: 'Статус заказа успешно обновлен'
        });
    });
});

app.delete('/api/admin/orders/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log(`🗑️ Удаление заказа ID: ${id} (админ)`);
    
    db.run('DELETE FROM order_items WHERE order_id = ?', [id], function(err) {
        if (err) {
            console.error('❌ Ошибка удаления товаров заказа:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        db.run('DELETE FROM orders WHERE id = ?', [id], function(err) {
            if (err) {
                console.error('❌ Ошибка удаления заказа:', err.message);
                return res.status(500).json({ 
                    success: false,
                    message: 'Ошибка базы данных'
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Заказ не найден'
                });
            }
            
            console.log(`✅ Заказ удален: ID: ${id}`);
            
            res.json({
                success: true,
                message: 'Заказ успешно удален'
            });
        });
    });
});

app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    console.log('📊 Запрос статистики администратором');
    
    const statsQueries = {
        totalUsers: 'SELECT COUNT(*) as count FROM users',
        totalProducts: 'SELECT COUNT(*) as count FROM products',
        totalCategories: 'SELECT COUNT(*) as count FROM categories',
        totalOrders: 'SELECT COUNT(*) as count FROM orders',
        totalRevenue: 'SELECT SUM(total_amount) as total FROM orders WHERE status = "delivered"',
        lowStock: 'SELECT COUNT(*) as count FROM products WHERE stock < 5',
        pendingOrders: 'SELECT COUNT(*) as count FROM orders WHERE status = "pending"',
        processingOrders: 'SELECT COUNT(*) as count FROM orders WHERE status = "processing"',
        bannedUsers: 'SELECT COUNT(*) as count FROM users WHERE COALESCE(is_banned, 0) = 1',
        newUsersToday: `SELECT COUNT(*) as count FROM users WHERE date(created_at) = date('now')`
    };
    
    const stats = {};
    let queriesCompleted = 0;
    const totalQueries = Object.keys(statsQueries).length;
    
    Object.entries(statsQueries).forEach(([key, query]) => {
        db.get(query, [], (err, row) => {
            if (err) {
                console.error(`❌ Ошибка получения статистики ${key}:`, err.message);
                stats[key] = 0;
            } else {
                stats[key] = row.count || row.total || 0;
            }
            
            queriesCompleted++;
            if (queriesCompleted === totalQueries) {
                stats.averageOrderValue = stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : 0;
                stats.stockWarning = stats.lowStock > 0;
                
                console.log('✅ Статистика отправлена администратору');
                
                res.json({
                    success: true,
                    stats: stats,
                    timestamp: new Date().toISOString()
                });
            }
        });
    });
});

// ========== ОБЩИЕ ЭНДПОИНТЫ С JWT ==========

app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    
    console.log('\n👤 ===== ЗАПРОС НА РЕГИСТРАЦИЮ =====');
    console.log('👤 Имя пользователя:', username);
    console.log('📧 Email:', email ? 'указан' : 'нет');
    console.log('🔐 Длина пароля:', password ? password.length : 0);
    
    if (!username || !email || !password) {
        console.log('❌ Попытка регистрации с неполными данными');
        return res.status(400).json({ 
            success: false, 
            message: 'Все поля обязательны' 
        });
    }
    
    if (password.length < 6) {
        console.log('❌ Пароль слишком короткий');
        return res.status(400).json({
            success: false,
            message: 'Пароль должен содержать минимум 6 символов'
        });
    }
    
    if (!email.includes('@')) {
        console.log('❌ Неверный формат email');
        return res.status(400).json({
            success: false,
            message: 'Введите корректный email'
        });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, 
        [username, email, hashedPassword], 
        function(err) {
            if (err) {
                console.error('❌ Ошибка регистрации:', err.message);
                
                if (err.message.includes('UNIQUE constraint failed')) {
                    console.log('⚠️ Пользователь уже существует');
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Пользователь уже существует' 
                    });
                }
                return res.status(500).json({ 
                    success: false, 
                    message: 'Ошибка базы данных' 
                });
            }
            
            const userId = this.lastID;
            console.log(`✅ Пользователь зарегистрирован: ${username} (ID: ${userId})`);
            
            db.get('SELECT id, username, email, role FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Ошибка получения данных пользователя' });
                }
                
                const token = generateToken(user);
                
                console.log(`🔐 Сгенерирован БЕССРОЧНЫЙ токен длиной ${token.length} символов`);
                console.log(`🔐 Токен НИКОГДА НЕ ИСТЕЧЕТ!`);
                
                const userWithToken = {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    token: token
                };
                
                res.json({
                    success: true,
                    message: 'Регистрация успешна!',
                    token: token,
                    user: userWithToken
                });
            });
        }
    );
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    console.log('\n🔐 ===== ЗАПРОС НА ВХОД =====');
    console.log('📧 Email:', email);
    console.log('🔐 Длина пароля:', password ? password.length : 0);
    
    if (!email || !password) {
        console.log('❌ Попытка входа с неполными данными');
        return res.status(400).json({ 
            success: false, 
            message: 'Email и пароль обязательны' 
        });
    }
    
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) {
            console.error('❌ Ошибка при входе:', err.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Ошибка сервера' 
            });
        }
        
        if (!user) {
            console.log(`⚠️ Пользователь не найден: ${email}`);
            return res.status(401).json({ 
                success: false, 
                message: 'Неверный email или пароль' 
            });
        }
        
        if (user.is_banned === 1) {
            console.log(`🚫 Заблокированный пользователь пытается войти: ${email}`);
            return res.status(403).json({ 
                success: false, 
                message: `Ваш аккаунт заблокирован. Причина: ${user.ban_reason || 'не указана'}` 
            });
        }
        
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            console.log(`⚠️ Неверный пароль для: ${email}`);
            return res.status(401).json({ 
                success: false, 
                message: 'Неверный email или пароль' 
            });
        }
        
        console.log(`✅ Успешный вход: ${user.username} (ID: ${user.id}, роль: ${user.role})`);
        
        const userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        };
        
        const token = generateToken(userData);
        
        console.log(`🔐 Сгенерирован БЕССРОЧНЫЙ токен длиной ${token.length} символов`);
        console.log(`🔐 Токен: ${token.substring(0, 50)}...`);
        console.log(`🔐 Токен НИКОГДА НЕ ИСТЕЧЕТ!`);
        
        const userWithToken = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            token: token
        };
        
        res.json({
            success: true,
            message: 'Вход выполнен!',
            token: token,
            user: userWithToken
        });
    });
});

app.get('/api/verify', authenticateToken, (req, res) => {
    console.log('✅ Проверка токена успешна');
    res.json({
        success: true,
        user: req.user
    });
});

app.get('/api/profile', authenticateToken, (req, res) => {
    console.log(`👤 Запрос профиля пользователя ID: ${req.user.id}`);
    
    db.get('SELECT id, username, email, role, created_at, avatar, avatar_type FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error('❌ Ошибка получения профиля:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
        
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
    });
});

app.put('/api/profile', authenticateToken, (req, res) => {
    const { username, email } = req.body;
    const userId = req.user.id;
    
    console.log(`✏️ Обновление профиля пользователя ID: ${userId}`);
    
    if (!username || !email) {
        return res.status(400).json({
            success: false,
            message: 'Имя пользователя и email обязательны'
        });
    }
    
    db.run('UPDATE users SET username = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
        [username, email, userId], 
        function(err) {
            if (err) {
                console.error('❌ Ошибка обновления профиля:', err.message);
                
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({
                        success: false,
                        message: 'Пользователь с таким email уже существует'
                    });
                }
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка базы данных'
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Пользователь не найден'
                });
            }
            
            console.log(`✅ Профиль обновлен: ${username} (ID: ${userId})`);
            
            res.json({
                success: true,
                message: 'Профиль успешно обновлен'
            });
        }
    );
});

app.get('/api/test', (req, res) => {
    console.log('🔍 Запрос к /api/test');
    
    logger.info('Запрос к /api/test', { ip: req.ip });
    
    res.json({ 
        success: true, 
        message: '✅ Сервер работает! (Бессрочные токены)', 
        timestamp: new Date().toISOString(),
        port: PORT,
        version: '1.0.0',
        logging: 'Включено'
    });
});

app.get('/api/test-logs', (req, res) => {
    console.log('🔍 Запрос на проверку логирования');
    
    try {
        logger.info('Тестовое сообщение из API', { test: true, timestamp: new Date().toISOString() });
        
        const testOrder = {
            orderId: 'TEST-' + Date.now(),
            userId: 'test-user',
            totalAmount: 9999,
            itemsCount: 2,
            shippingAddress: 'Тестовый адрес',
            paymentMethod: 'test',
            items: [
                { productId: 1, quantity: 1, price: 5000 },
                { productId: 2, quantity: 1, price: 4999 }
            ]
        };
        
        logger.logOrder(testOrder);
        
        const logFiles = logger.checkLogs();
        
        res.json({
            success: true,
            message: 'Логирование проверено',
            logsDirectory: logger.logDir,
            files: logFiles,
            testOrder: testOrder.orderId,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Ошибка теста логирования:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/logs/view', authenticateToken, requireAdmin, (req, res) => {
    try {
        const logDir = logger.logDir;
        
        if (!fs.existsSync(logDir)) {
            return res.json({
                success: false,
                message: 'Папка logs не существует',
                logsDirectory: logDir
            });
        }
        
        const files = fs.readdirSync(logDir);
        
        const logs = {
            directory: logDir,
            totalFiles: files.length,
            files: []
        };
        
        files.forEach(file => {
            const filePath = path.join(logDir, file);
            const stats = fs.statSync(filePath);
            
            const fileInfo = {
                name: file,
                size: stats.size,
                isDirectory: stats.isDirectory(),
                modified: stats.mtime
            };
            
            if (!stats.isDirectory() && (file.endsWith('.log') || file.endsWith('.json'))) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    if (file.endsWith('.json')) {
                        try {
                            fileInfo.content = JSON.parse(content);
                        } catch {
                            fileInfo.content = content;
                        }
                    } else {
                        const lines = content.split('\n').filter(line => line.trim());
                        fileInfo.lines = lines.length;
                        fileInfo.lastLines = lines.slice(-10);
                    }
                } catch (e) {
                    fileInfo.error = 'Ошибка чтения файла';
                }
            }
            
            logs.files.push(fileInfo);
        });
        
        res.json({
            success: true,
            ...logs
        });
        
    } catch (error) {
        console.error('❌ Ошибка чтения логов:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/categories', (req, res) => {
    console.log('📂 Запрос категорий');
    
    const query = `
        SELECT c.*, 
               (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
        FROM categories c 
        WHERE COALESCE(c.is_active, 1) = 1
        ORDER BY c.name
    `;
    
    db.all(query, [], (err, categories) => {
        if (err) {
            console.error('❌ Ошибка получения категорий:', err.message);
            res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        } else {
            console.log(`✅ Получено ${categories.length} категорий`);
            res.json({
                success: true,
                categories: categories
            });
        }
    });
});

app.get('/api/products', (req, res) => {
    const { 
        category = 'all', 
        page = 1, 
        limit = 12,
        minPrice,
        maxPrice,
        sortBy = 'newest',
        search
    } = req.query;
    
    console.log('🛒 Запрос товаров:', { 
        category, 
        page, 
        limit,
        search: search ? 'есть' : 'нет'
    });
    
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT p.*, 
               c.name as category_name, 
               c.slug as category_slug,
               c.icon as category_icon,
               c.color as category_color
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE COALESCE(p.is_active, 1) = 1
    `;
    
    let countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE COALESCE(p.is_active, 1) = 1
    `;
    
    const params = [];
    const countParams = [];
    
    if (category && category !== 'all') {
        query += ' AND c.slug = ?';
        countQuery += ' AND c.slug = ?';
        params.push(category);
        countParams.push(category);
    }
    
    if (minPrice && !isNaN(minPrice)) {
        query += ' AND p.price >= ?';
        countQuery += ' AND p.price >= ?';
        params.push(parseInt(minPrice));
        countParams.push(parseInt(minPrice));
    }
    
    if (maxPrice && !isNaN(maxPrice)) {
        query += ' AND p.price <= ?';
        countQuery += ' AND p.price <= ?';
        params.push(parseInt(maxPrice));
        countParams.push(parseInt(maxPrice));
    }
    
    if (search) {
        query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        countQuery += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
        countParams.push(searchTerm, searchTerm);
    }
    
    let orderBy = 'p.created_at DESC';
    switch(sortBy) {
        case 'price_asc':
            orderBy = 'p.price ASC';
            break;
        case 'price_desc':
            orderBy = 'p.price DESC';
            break;
        case 'newest':
            orderBy = 'p.created_at DESC';
            break;
        case 'rating':
            orderBy = 'p.rating DESC, p.reviews_count DESC';
            break;
    }
    
    query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    db.all(query, params, (err, products) => {
        if (err) {
            console.error('❌ Ошибка получения товаров:', err.message);
            res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        } else {
            db.get(countQuery, countParams, (err, countResult) => {
                if (err) {
                    console.error('❌ Ошибка подсчёта товаров:', err.message);
                    res.json({
                        success: true,
                        products: products,
                        total: products.length,
                        page: parseInt(page),
                        pages: 1,
                        limit: parseInt(limit)
                    });
                } else {
                    const total = countResult.total;
                    const pages = Math.ceil(total / limit);
                    
                    console.log(`✅ Найдено ${total} товаров, показано ${products.length}`);
                    
                    res.json({
                        success: true,
                        products: products,
                        total: total,
                        page: parseInt(page),
                        pages: pages,
                        limit: parseInt(limit)
                    });
                }
            });
        }
    });
});

app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;
    
    console.log(`📦 Запрос товара по ID: ${id}`);
    
    const query = `
        SELECT p.*, 
               c.name as category_name, 
               c.slug as category_slug,
               c.icon as category_icon,
               c.color as category_color
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? AND COALESCE(p.is_active, 1) = 1
    `;
    
    db.get(query, [id], (err, product) => {
        if (err) {
            console.error('❌ Ошибка получения товара:', err.message);
            res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера' 
            });
        } else if (!product) {
            console.log(`⚠️ Товар с ID ${id} не найден`);
            res.status(404).json({ 
                success: false,
                error: 'Товар не найден' 
            });
        } else {
            console.log(`✅ Товар найден: ${product.name}`);
            res.json({
                success: true,
                product: product
            });
        }
    });
});

app.get('/api/products/top/:limit?', (req, res) => {
    const limit = parseInt(req.params.limit) || 6;
    
    console.log(`🏆 Запрос топ ${limit} товаров`);
    
    const query = `
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE COALESCE(p.is_active, 1) = 1 AND (p.is_featured = 1 OR p.rating >= 4.5)
        ORDER BY p.rating DESC, p.reviews_count DESC
        LIMIT ?
    `;
    
    db.all(query, [limit], (err, products) => {
        if (err) {
            console.error('❌ Ошибка получения топ товаров:', err.message);
            res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        } else {
            console.log(`✅ Получено ${products.length} топ товаров`);
            res.json({
                success: true,
                products: products
            });
        }
    });
});

app.get('/api/products/new/:limit?', (req, res) => {
    const limit = parseInt(req.params.limit) || 6;
    
    console.log(`🆕 Запрос новых товары, лимит: ${limit}`);
    
    const query = `
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE COALESCE(p.is_active, 1) = 1 AND p.is_new = 1
        ORDER BY p.created_at DESC
        LIMIT ?
    `;
    
    db.all(query, [limit], (err, products) => {
        if (err) {
            console.error('❌ Ошибка получения новых товаров:', err.message);
            res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера' 
            });
        } else {
            console.log(`✅ Получено ${products.length} новых товаров`);
            res.json({
                success: true,
                products: products
            });
        }
    });
});

app.post('/api/orders/create', authenticateToken, (req, res) => {
    try {
        const { items, totalAmount, shippingAddress, paymentMethod, notes } = req.body;
        const userId = req.user.id;
        
        console.log('\n🛒 ===== СОЗДАНИЕ ЗАКАЗА (альтернативный эндпоинт) =====');
        console.log('👤 Пользователь:', userId, req.user.username);
        console.log('📦 Товаров:', items?.length || 0);
        console.log('💰 Сумма:', totalAmount);
        
        if (!items || items.length === 0) {
            console.log('❌ ОШИБКА: корзина пуста');
            return res.status(400).json({
                success: false,
                message: 'Корзина пуста'
            });
        }
        
        if (!totalAmount || totalAmount <= 0) {
            console.log('❌ ОШИБКА: неверная сумма заказа');
            return res.status(400).json({
                success: false,
                message: 'Неверная сумма заказа'
            });
        }
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            db.run(`INSERT INTO orders (user_id, total_amount, shipping_address, payment_method, notes) 
                    VALUES (?, ?, ?, ?, ?)`,
                [userId, totalAmount, shippingAddress || 'Самовывоз', paymentMethod || 'card', notes || ''],
                function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('❌ ОШИБКА SQL при создании заказа:', err.message);
                        return res.status(500).json({
                            success: false,
                            message: 'Ошибка создания заказа в базе данных'
                        });
                    }
                    
                    const orderId = this.lastID;
                    console.log(`✅ Заказ создан в БД, ID: ${orderId}`);
                    
                    let itemsProcessed = 0;
                    let hasError = false;
                    
                    items.forEach(item => {
                        db.run(`INSERT INTO order_items (order_id, product_id, quantity, price) 
                                VALUES (?, ?, ?, ?)`,
                            [orderId, item.productId, item.quantity, item.price],
                            (err) => {
                                if (err) {
                                    hasError = true;
                                    db.run('ROLLBACK');
                                    console.error('❌ ОШИБКА добавления товара:', err.message);
                                    return res.status(500).json({
                                        success: false,
                                        message: 'Ошибка добавления товара в заказ'
                                    });
                                }
                                
                                itemsProcessed++;
                                console.log(`✅ Товар ${item.productId} добавлен (${itemsProcessed}/${items.length})`);
                                
                                if (itemsProcessed === items.length && !hasError) {
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            console.error('❌ ОШИБКА коммита транзакции:', err.message);
                                            return res.status(500).json({
                                                success: false,
                                                message: 'Ошибка фиксации заказа'
                                            });
                                        }
                                        
                                        console.log(`🎉 ===== ЗАКАЗ #${orderId} УСПЕШНО ОФОРМЛЕН! =====`);
                                        
                                        res.json({
                                            success: true,
                                            message: 'Заказ успешно оформлен!',
                                            orderId: orderId,
                                            orderData: {
                                                id: orderId,
                                                totalAmount: totalAmount,
                                                shippingAddress: shippingAddress,
                                                paymentMethod: paymentMethod,
                                                status: 'pending',
                                                createdAt: new Date().toISOString(),
                                                itemsCount: items.length
                                            }
                                        });
                                    });
                                }
                            }
                        );
                    });
                }
            );
        });
        
    } catch (error) {
        console.error('💥 НЕОБРАБОТАННАЯ ОШИБКА при создании заказа:');
        console.error(error);
        
        res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера при создании заказа'
        });
    }
});

app.get('/api/orders/my', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    console.log(`📋 Запрос заказов пользователя ID: ${userId}`);
    
    const query = `
        SELECT 
            o.*, 
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_count,
            (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) as total_items,
            'ORD-' || substr('000000' || o.id, -6) as order_number_display
        FROM orders o
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
    `;
    
    db.all(query, [userId], (err, orders) => {
        if (err) {
            console.error('❌ Ошибка получения заказов:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка сервера',
                error: err.message
            });
        }
        
        console.log(`✅ Получено ${orders.length} заказов для пользователя ID: ${userId}`);
        
        res.json({
            success: true,
            orders: orders
        });
    });
});

app.get('/api/orders/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log(`📦 Запрос деталей заказа ID: ${id} пользователем ID: ${userId}`);
    
    const query = `
        SELECT o.*, u.username, u.email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = ? AND (o.user_id = ? OR ? = (SELECT role FROM users WHERE id = ? AND role = 'admin'))
    `;
    
    db.get(query, [id, userId, req.user.role, userId], (err, order) => {
        if (err) {
            console.error('❌ Ошибка получения заказа:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Заказ не найден или доступ запрещен'
            });
        }
        
        const itemsQuery = `
            SELECT oi.*, p.name, p.image_url
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `;
        
        db.all(itemsQuery, [id], (err, items) => {
            if (err) {
                console.error('❌ Ошибка получения товаров заказа:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка сервера'
                });
            }
            
            order.items = items;
            
            console.log(`✅ Заказ найден: #${order.id}, товаров: ${items.length}`);
            
            res.json({
                success: true,
                order: order
            });
        });
    });
});

app.post('/api/favorites/add', authenticateToken, (req, res) => {
    const { productId } = req.body;
    const userId = req.user.id;
    
    console.log(`❤️  Добавление в избранное: пользователь ${userId}, товар ${productId}`);
    
    if (!productId) {
        console.log('❌ Не указан productId');
        return res.status(400).json({
            success: false,
            message: 'Не указан productId'
        });
    }
    
    db.run(`INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)`,
        [userId, productId],
        function(err) {
            if (err) {
                console.error('❌ Ошибка добавления в избранное:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка базы данных'
                });
            }
            
            const added = this.changes > 0;
            
            if (added) {
                console.log(`✅ Товар ${productId} добавлен в избранное пользователя ${userId}`);
            } else {
                console.log(`ℹ️ Товар ${productId} уже в избранном у пользователя ${userId}`);
            }
            
            res.json({
                success: true,
                message: added ? 'Добавлено в избранное' : 'Уже в избранном',
                added: added
            });
        }
    );
});

app.post('/api/favorites/remove', authenticateToken, (req, res) => {
    const { productId } = req.body;
    const userId = req.user.id;
    
    console.log(`❌ Удаление из избранного: пользователь ${userId}, товар ${productId}`);
    
    if (!productId) {
        console.log('❌ Не указан productId');
        return res.status(400).json({
            success: false,
            message: 'Не указан productId'
        });
    }
    
    db.run(`DELETE FROM favorites WHERE user_id = ? AND product_id = ?`,
        [userId, productId],
        function(err) {
            if (err) {
                console.error('❌ Ошибка удаления из избранного:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка базы данных'
                });
            }
            
            const removed = this.changes > 0;
            
            if (removed) {
                console.log(`✅ Товар ${productId} удален из избранного пользователя ${userId}`);
            } else {
                console.log(`ℹ️ Товар ${productId} не найден в избранном у пользователя ${userId}`);
            }
            
            res.json({
                success: true,
                message: removed ? 'Удалено из избранного' : 'Не найдено в избранном',
                removed: removed
            });
        }
    );
});

app.get('/api/favorites', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    console.log(`❤️  Запрос избранного пользователя ID: ${userId}`);
    
    const query = `
        SELECT p.*, c.name as category_name
        FROM favorites f
        JOIN products p ON f.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE f.user_id = ? AND COALESCE(p.is_active, 1) = 1
        ORDER BY f.created_at DESC
    `;
    
    db.all(query, [userId], (err, favorites) => {
        if (err) {
            console.error('❌ Ошибка получения избранного:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
        
        console.log(`✅ Получено ${favorites.length} избранных товаров для пользователя ID: ${userId}`);
        
        res.json({
            success: true,
            favorites: favorites,
            count: favorites.length
        });
    });
});

app.get('/api/favorites/check/:productId', authenticateToken, (req, res) => {
    const { productId } = req.params;
    const userId = req.user.id;
    
    console.log(`🔍 Проверка избранного: пользователь ${userId}, товар ${productId}`);
    
    db.get('SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?', 
        [userId, productId], 
        (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки избранного:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка сервера'
                });
            }
            
            const isFavorite = !!row;
            
            res.json({
                success: true,
                isFavorite: isFavorite
            });
        }
    );
});

app.get('/api/search', (req, res) => {
    const { q, limit = 10 } = req.query;
    
    console.log(`🔍 Поиск товаров: "${q}", лимит: ${limit}`);
    
    if (!q) {
        console.log('❌ Не указан поисковый запрос');
        return res.status(400).json({
            success: false,
            message: 'Не указан поисковый запрос'
        });
    }
    
    const query = `
        SELECT p.id, p.name, p.price, p.image_url, c.name as category_name
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE COALESCE(p.is_active, 1) = 1 AND (p.name LIKE ? OR p.description LIKE ?)
        LIMIT ?
    `;
    
    const searchTerm = `%${q}%`;
    
    db.all(query, [searchTerm, searchTerm, parseInt(limit)], (err, results) => {
        if (err) {
            console.error('❌ Ошибка поиска:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
        
        console.log(`✅ По запросу "${q}" найдено ${results.length} товаров`);
        
        res.json({
            success: true,
            query: q,
            results: results,
            count: results.length
        });
    });
});

app.get('/api/home', (req, res) => {
    console.log('🏠 Запрос данных для главной страницы');
    
    const promises = {
        topProducts: new Promise((resolve, reject) => {
            db.all(`
                SELECT p.*, c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE COALESCE(p.is_active, 1) = 1 AND p.is_featured = 1
                ORDER BY p.rating DESC
                LIMIT 8
            `, [], (err, products) => {
                if (err) reject(err);
                else resolve(products);
            });
        }),
        
        newProducts: new Promise((resolve, reject) => {
            db.all(`
                SELECT p.*, c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE COALESCE(p.is_active, 1) = 1 AND p.is_new = 1
                ORDER BY p.created_at DESC
                LIMIT 6
            `, [], (err, products) => {
                if (err) reject(err);
                else resolve(products);
            });
        }),
        
        categories: new Promise((resolve, reject) => {
            db.all(`
                SELECT c.*, 
                       (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND COALESCE(p.is_active, 1) = 1) as product_count
                FROM categories c 
                WHERE COALESCE(c.is_active, 1) = 1
                ORDER BY c.name
                LIMIT 6
            `, [], (err, categories) => {
                if (err) reject(err);
                else resolve(categories);
            });
        })
    };
    
    Promise.all([promises.topProducts, promises.newProducts, promises.categories])
        .then(([topProducts, newProducts, categories]) => {
            console.log(`✅ Главная страница: ${topProducts.length} топ товаров, ${newProducts.length} новых товаров, ${categories.length} категорий`);
            
            res.json({
                success: true,
                topProducts: topProducts,
                newProducts: newProducts,
                categories: categories,
                stats: {
                    totalProducts: topProducts.length + newProducts.length,
                    totalCategories: categories.length
                }
            });
        })
        .catch(err => {
            console.error('❌ Ошибка получения данных для главной:', err.message);
            res.status(500).json({
                success: false,
                error: 'Ошибка сервера'
            });
        });
});

app.get('/api/cart/count', authenticateToken, (req, res) => {
    res.json({
        success: true,
        count: 0
    });
});

app.post('/api/orders/create-full', authenticateToken, (req, res) => {
    try {
        const { 
            items, 
            totalAmount, 
            shippingAddress, 
            paymentMethod, 
            notes,
            customerName,
            customerEmail,
            customerPhone 
        } = req.body;
        const userId = req.user.id;
        
        console.log('\n🛒 ===== ПОЛНОЕ СОЗДАНИЕ ЗАКАЗА =====');
        console.log('👤 Пользователь:', userId, req.user.username);
        console.log('📦 Товаров:', items?.length || 0);
        console.log('💰 Сумма:', totalAmount);
        console.log('🚚 Адрес:', shippingAddress || 'самовывоз');
        console.log('💳 Оплата:', paymentMethod || 'card');
        
        if (!items || items.length === 0) {
            console.log('❌ ОШИБКА: корзина пуста');
            return res.status(400).json({
                success: false,
                message: 'Корзина пуста'
            });
        }
        
        if (!totalAmount || totalAmount <= 0) {
            console.log('❌ ОШИБКА: неверная сумма заказа');
            return res.status(400).json({
                success: false,
                message: 'Неверная сумма заказа'
            });
        }
        
        if (!shippingAddress || shippingAddress.trim() === '') {
            console.log('❌ ОШИБКА: не указан адрес доставки');
            return res.status(400).json({
                success: false,
                message: 'Укажите адрес доставки'
            });
        }
        
        if (!customerName || !customerPhone) {
            console.log('❌ ОШИБКА: не заполнены контактные данные');
            return res.status(400).json({
                success: false,
                message: 'Заполните контактные данные'
            });
        }
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            const orderData = {
                userId: userId,
                totalAmount: totalAmount,
                shippingAddress: shippingAddress,
                paymentMethod: paymentMethod,
                notes: notes || '',
                customerName: customerName || req.user.username,
                customerEmail: customerEmail || req.user.email,
                customerPhone: customerPhone,
                status: 'pending'
            };
            
            db.run(`INSERT INTO orders 
                    (user_id, total_amount, shipping_address, payment_method, notes, status) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    orderData.userId,
                    orderData.totalAmount,
                    orderData.shippingAddress,
                    orderData.paymentMethod,
                    orderData.notes,
                    orderData.status
                ],
                function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('❌ ОШИБКА SQL при создании заказа:', err.message);
                        return res.status(500).json({
                            success: false,
                            message: 'Ошибка создания заказа в базе данных'
                        });
                    }
                    
                    const orderId = this.lastID;
                    console.log(`✅ Заказ создан в БД, ID: ${orderId}`);
                    
                    let itemsProcessed = 0;
                    let hasError = false;
                    
                    items.forEach(item => {
                        db.run(`INSERT INTO order_items (order_id, product_id, quantity, price) 
                                VALUES (?, ?, ?, ?)`,
                            [orderId, item.productId, item.quantity, item.price],
                            (err) => {
                                if (err) {
                                    hasError = true;
                                    db.run('ROLLBACK');
                                    console.error('❌ ОШИБКА добавления товара:', err.message);
                                    return res.status(500).json({
                                        success: false,
                                        message: 'Ошибка добавления товара в заказ'
                                    });
                                }
                                
                                itemsProcessed++;
                                console.log(`✅ Товар ${item.productId} добавлен (${itemsProcessed}/${items.length})`);
                                
                                if (itemsProcessed === items.length && !hasError) {
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            console.error('❌ ОШИБКА коммита транзакции:', err.message);
                                            return res.status(500).json({
                                                success: false,
                                                message: 'Ошибка фиксации заказа'
                                            });
                                        }
                                        
                                        console.log(`🎉 ===== ПОЛНЫЙ ЗАКАЗ #${orderId} УСПЕШНО ОФОРМЛЕН! =====`);
                                        
                                        res.json({
                                            success: true,
                                            message: 'Заказ успешно оформлен!',
                                            orderId: orderId,
                                            orderData: {
                                                id: orderId,
                                                number: `ORD-${String(orderId).padStart(6, '0')}`,
                                                totalAmount: totalAmount,
                                                itemsCount: items.length,
                                                shippingAddress: shippingAddress,
                                                paymentMethod: paymentMethod,
                                                customerName: orderData.customerName,
                                                customerPhone: orderData.customerPhone,
                                                status: orderData.status,
                                                createdAt: new Date().toISOString()
                                            }
                                        });
                                    });
                                }
                            }
                        );
                    });
                }
            );
        });
        
    } catch (error) {
        console.error('💥 НЕОБРАБОТАННАЯ ОШИБКА при создании заказа:');
        console.error(error);
        
        res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера при создании заказа'
        });
    }
});

app.get('/api/admin/orders-detailed', authenticateToken, requireAdmin, (req, res) => {
    console.log('📋 Запрос детализированного списка заказов (админ)');
    
    const query = `
        SELECT 
            o.id,
            o.user_id,
            u.username as customer_username,
            u.email as customer_email,
            o.total_amount,
            o.status,
            o.shipping_address,
            o.payment_method,
            o.notes,
            o.created_at,
            o.updated_at,
            (
                SELECT COUNT(*) 
                FROM order_items oi 
                WHERE oi.order_id = o.id
            ) as items_count,
            (
                SELECT SUM(oi.quantity) 
                FROM order_items oi 
                WHERE oi.order_id = o.id
            ) as total_items
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
    `;
    
    db.all(query, [], (err, orders) => {
        if (err) {
            console.error('❌ Ошибка получения детализированных заказов:', err.message);
            return res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        }
        
        console.log(`✅ Получено ${orders.length} детализированных заказов для админ-панели`);
        
        orders.forEach(order => {
            order.order_number = `ORD-${String(order.id).padStart(6, '0')}`;
        });
        
        res.json({
            success: true,
            orders: orders,
            count: orders.length,
            stats: {
                total: orders.length,
                pending: orders.filter(o => o.status === 'pending').length,
                processing: orders.filter(o => o.status === 'processing').length,
                delivered: orders.filter(o => o.status === 'delivered').length,
                cancelled: orders.filter(o => o.status === 'cancelled').length,
                totalRevenue: orders
                    .filter(o => o.status === 'delivered')
                    .reduce((sum, o) => sum + o.total_amount, 0)
                    .toFixed(2)
            }
        });
    });
});

app.get('/api/admin/orders/:id/full', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log(`📦 Запрос полной информации о заказе ID: ${id} (админ)`);
    
    const orderQuery = `
        SELECT 
            o.*,
            u.username as customer_username,
            u.email as customer_email,
            u.phone as customer_phone
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
    `;
    
    db.get(orderQuery, [id], (err, order) => {
        if (err) {
            console.error('❌ Ошибка получения заказа:', err.message);
            return res.status(500).json({ 
                success: false,
                error: 'Ошибка сервера'
            });
        }
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Заказ не найден'
            });
        }
        
        const itemsQuery = `
            SELECT 
                oi.*,
                p.name as product_name,
                p.image_url as product_image,
                p.sku as product_sku,
                c.name as category_name
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE oi.order_id = ?
            ORDER BY oi.id
        `;
        
        db.all(itemsQuery, [id], (err, items) => {
            if (err) {
                console.error('❌ Ошибка получения товаров заказа:', err.message);
                return res.status(500).json({ 
                    success: false,
                    error: 'Ошибка сервера'
                });
            }
            
            const fullOrder = {
                ...order,
                order_number: `ORD-${String(order.id).padStart(6, '0')}`,
                items: items.map(item => ({
                    ...item,
                    total: item.price * item.quantity
                })),
                summary: {
                    items_count: items.length,
                    total_items: items.reduce((sum, item) => sum + item.quantity, 0),
                    subtotal: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                    shipping: 0,
                    total: order.total_amount
                },
                status_history: [
                    {
                        status: 'created',
                        date: order.created_at,
                        description: 'Заказ создан'
                    },
                    {
                        status: order.status,
                        date: order.updated_at || order.created_at,
                        description: getStatusDescription(order.status)
                    }
                ]
            };
            
            console.log(`✅ Полная информация о заказе получена: #${order.id}, товаров: ${items.length}`);
            
            res.json({
                success: true,
                order: fullOrder
            });
        });
    });
});

function getStatusDescription(status) {
    const descriptions = {
        'pending': 'Ожидает обработки',
        'processing': 'В обработке',
        'shipped': 'Отправлен',
        'delivered': 'Доставлен',
        'cancelled': 'Отменен'
    };
    return descriptions[status] || status;
}

// ========== ОБРАБОТКА 404 ДЛЯ API ==========
app.use('/api/*', (req, res) => {
    console.log(`❌ Запрос к несуществующему API: ${req.url}`);
    
    res.status(404).json({ 
        success: false,
        error: 'API endpoint не найден',
        path: req.url,
        method: req.method,
        message: 'Проверьте правильность URL или обратитесь к документации API'
    });
});

// Отдаем статические файлы из frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Middleware для обработки ошибок
app.use((err, req, res, next) => {
    console.error('💥 Необработанная ошибка сервера:', err);
    
    res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
===================================================
🚀 Сервер успешно запущен!
===================================================
📍 URL: http://localhost:${PORT}
🗃️  База данных: ${dbPath}
📁 Логи будут сохранены в: ${logger.logDir}
🔐 JWT авторизация: ВКЛЮЧЕНА
🔑 Токены: БЕССРОЧНЫЕ (НИКОГДА НЕ ИСТЕКАЮТ)
💾 Данные сохраняются между перезапусками

📡 Основные API эндпоинты:
   • Тест сервера:        http://localhost:${PORT}/api/test
   • Регистрация:         POST http://localhost:${PORT}/api/register
   • Вход:                POST http://localhost:${PORT}/api/login

👤 Тестовые аккаунты (создаются только при первом запуске):
   Администратор: admin@pcstore.ru / admin123
   Пользователь:  user@pcstore.ru / user123

💡 Подсказка:
   • Данные сохраняются в database.db
   • Для сброса базы удалите database.db и .initialized
   • Для повторного добавления тестовых товаров удалите .initialized
===================================================
`);
    
    setTimeout(() => {
        logger.info(`Сервер запущен на порту ${PORT}`, {
            port: PORT,
            nodeVersion: process.version,
            platform: process.platform,
            timestamp: new Date().toISOString()
        });
    }, 2000);
});

module.exports = { app, db, initDatabase, addMissingColumns };