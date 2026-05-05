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
    // Добавляем уникальную соль чтобы каждый раз был разный токен
    const salt = crypto.randomBytes(16).toString('hex');
    
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            email: user.email, 
            role: user.role,
            salt: salt, // Уникальная соль для каждого токена
            createdAt: Date.now() // Просто для информации, но не для истечения
        },
        JWT_SECRET
        // Убрали expiresIn - токен БЕССРОЧНЫЙ!
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
        // ВАЖНО: verify без указания срока - токен НИКОГДА НЕ ИСТЕКАЕТ!
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

// ========== ЭНДПОИНТЫ ДЛЯ АВАТАРА (ИСПРАВЛЕННАЯ ВЕРСИЯ) ==========

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

// ИСПРАВЛЕННЫЙ ЭНДПОИНТ ДЛЯ ЗАГРУЗКИ АВАТАРА
app.post('/api/profile/avatar', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    console.log(`🖼️ Загрузка аватара для пользователя ID: ${userId}`);
    console.log('📦 Тело запроса:', JSON.stringify(req.body, null, 2));
    
    // Проверяем разные возможные форматы данных
    let avatarValue = null;
    let avatarType = 'image';
    
    // Формат 1: { type: 'image', value: 'base64...' }
    if (req.body.value) {
        avatarValue = req.body.value;
        avatarType = req.body.type || 'image';
    }
    // Формат 2: { avatar: 'base64...' }
    else if (req.body.avatar) {
        avatarValue = req.body.avatar;
        avatarType = req.body.avatar_type || 'image';
    }
    // Формат 3: { data: 'base64...' }
    else if (req.body.data) {
        avatarValue = req.body.data;
        avatarType = req.body.type || 'image';
    }
    // Формат 4: прямая строка base64
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
    
    // Сохраняем информацию о аватаре в БД
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
    
    // Очищаем поле аватара в БД
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
                'POST /api/profile/avatar - загрузить аватар (JSON с type и value)',
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
    
    // Проверка сложности пароля
    const hasLetters = /[a-zA-Zа-яА-Я]/.test(new_password);
    const hasNumbers = /\d/.test(new_password);
    
    if (!hasLetters || !hasNumbers) {
        return res.status(400).json({
            success: false,
            message: 'Пароль должен содержать буквы и цифры'
        });
    }
    
    // Получаем пользователя из БД
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
        
        // Проверяем текущий пароль
        const isCurrentPasswordValid = bcrypt.compareSync(current_password, user.password);
        
        if (!isCurrentPasswordValid) {
            console.log(`❌ Неверный текущий пароль для пользователя ID: ${userId}`);
            return res.status(401).json({
                success: false,
                message: 'Неверный текущий пароль'
            });
        }
        
        // Хэшируем новый пароль
        const hashedNewPassword = bcrypt.hashSync(new_password, 10);
        
        // Обновляем пароль в БД
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
    
    // Получаем пользователя из БД
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
        
        // Проверяем пароль
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        
        if (!isPasswordValid) {
            console.log(`❌ Неверный пароль для удаления аккаунта пользователя ID: ${userId}`);
            return res.status(401).json({
                success: false,
                message: 'Неверный пароль'
            });
        }
        
        // Начинаем транзакцию для удаления всех данных пользователя
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Удаляем избранное пользователя
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
                
                // Удаляем заказы пользователя
                db.all('SELECT id FROM orders WHERE user_id = ?', [userId], (err, orders) => {
                    if (err) {
                        console.error('❌ Ошибка получения заказов:', err.message);
                        db.run('ROLLBACK');
                        return res.status(500).json({
                            success: false,
                            message: 'Ошибка удаления данных пользователя'
                        });
                    }
                    
                    // Удаляем товары из заказов
                    orders.forEach(order => {
                        db.run('DELETE FROM order_items WHERE order_id = ?', [order.id], (err) => {
                            if (err) console.error('Ошибка удаления товаров заказа:', err.message);
                        });
                    });
                    
                    // Удаляем заказы
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
                        
                        // Удаляем самого пользователя
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
    
    // Попробуем расшифровать токен
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
        
        // Попробуем верифицировать
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
                        
                        if (col.name === 'slug') {
                            db.all('SELECT id, name FROM products WHERE slug IS NULL OR slug = ""', [], (err, products) => {
                                if (!err && products.length > 0) {
                                    products.forEach(product => {
                                        const slug = product.name.toLowerCase()
                                            .replace(/[^a-z0-9а-яё\s]/g, '-')
                                            .replace(/\s+/g, '-')
                                            .replace(/-+/g, '-')
                                            .replace(/^-|-$/g, '');
                                        
                                        db.run('UPDATE products SET slug = ? WHERE id = ?', [slug, product.id], (err) => {
                                            if (err) {
                                                console.error(`❌ Ошибка обновления slug для товара ${product.id}:`, err.message);
                                            }
                                        });
                                    });
                                }
                            });
                        }
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
    
    // Добавляем проверку для таблицы orders
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
        if (err) {
            console.error('❌ Ошибка создания таблицы users:', err.message);
        } else {
            console.log('✅ Таблица users создана/проверена');
            
            addMissingColumns();
            
            // Добавляем тестовых пользователей
const adminPassword = bcrypt.hashSync('admin123', 10);
db.get('SELECT * FROM users WHERE email = ?', ['admin@pcstore.ru'], (err, row) => {
    if (!err && !row) {
        db.run(`INSERT INTO users (username, email, password, role) 
                VALUES (?, ?, ?, ?)`, 
            ['admin', 'admin@pcstore.ru', adminPassword, 'admin'],
            function(err) {
                if (err) {
                    console.error('❌ Ошибка добавления администратора:', err.message);
                } else {
                    console.log('👑 Администратор создан (admin@pcstore.ru / admin123)');
                }
            }
        );
    }
});

            // Добавляем ВТОРОГО администратора
            const admin2Password = bcrypt.hashSync('admin456', 10);
            db.get('SELECT * FROM users WHERE email = ?', ['admin2@pcstore.ru'], (err, row) => {
                if (!err && !row) {
                    db.run(`INSERT INTO users (username, email, password, role) 
                            VALUES (?, ?, ?, ?)`, 
                        ['admin2', 'admin2@pcstore.ru', admin2Password, 'admin'],
                        function(err) {
                            if (err) {
                                console.error('❌ Ошибка добавления второго администратора:', err.message);
                            } else {
                                console.log('👑 Второй администратор создан (admin2@pcstore.ru / admin456)');
                            }
                        }
                    );
                }
            });

            const userPassword = bcrypt.hashSync('user123', 10);
            db.get('SELECT * FROM users WHERE email = ?', ['user@pcstore.ru'], (err, row) => {
                if (!err && !row) {
                    db.run(`INSERT INTO users (username, email, password, role) 
                            VALUES (?, ?, ?, ?)`, 
                        ['user', 'user@pcstore.ru', userPassword, 'user'],
                        function(err) {
                            if (err) {
                                console.error('❌ Ошибка добавления тестового пользователя:', err.message);
                            } else {
                                console.log('👤 Тестовый пользователь создан (user@pcstore.ru / user123)');
                            }
                        }
                    );
                }
            });

            const modPassword = bcrypt.hashSync('mod123', 10);
            db.get('SELECT * FROM users WHERE email = ?', ['moderator@pcstore.ru'], (err, row) => {
                if (!err && !row) {
                    db.run(`INSERT INTO users (username, email, password, role) 
                            VALUES (?, ?, ?, ?)`, 
                        ['moderator', 'moderator@pcstore.ru', modPassword, 'moderator'],
                        function(err) {
                            if (err) {
                                console.error('❌ Ошибка добавления модератора:', err.message);
                            } else {
                                console.log('👤 Модератор создан (moderator@pcstore.ru / mod123)');
                            }
                        }
                    );
                }
            });
        }
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
        if (err) {
            console.error('❌ Ошибка создания таблицы categories:', err.message);
        } else {
            console.log('✅ Таблица categories создана/проверена');
            
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
            
            db.get('SELECT COUNT(*) as count FROM categories', [], (err, row) => {
                if (!err && row.count === 0) {
                    console.log('📂 Добавляем категории...');
                    const stmt = db.prepare(`INSERT INTO categories (name, slug, description, icon, color) 
                                            VALUES (?, ?, ?, ?, ?)`);
                    
                    categories.forEach(([name, slug, description, icon, color]) => {
                        stmt.run([name, slug, description, icon, color], (err) => {
                            if (err) console.error(`Ошибка добавления категории ${name}:`, err.message);
                        });
                    });
                    
                    stmt.finalize();
                    console.log('✅ Категории добавлены');
                }
            });
        }
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
        if (err) {
            console.error('❌ Ошибка создания таблицы products:', err.message);
        } else {
            console.log('✅ Таблица products создана/проверена');
            
            db.get('SELECT COUNT(*) as count FROM products', [], (err, row) => {
                if (!err && row.count === 0) {
                    console.log('🛒 Добавляем тестовые товары...');
                    
                    db.all('SELECT id, slug FROM categories', [], (err, categories) => {
                        if (err) {
                            console.error('Ошибка получения категорий:', err.message);
                            return;
                        }
                        
                        const categoryMap = {};
                        categories.forEach(cat => {
                            categoryMap[cat.slug] = cat.id;
                        });
                        
                        const products = [
                            // Процессоры (category_id: 1) - 35 товаров
                            ['Intel Core i9-14900K', 'Процессор Intel Core i9-14900K, 24 ядра (8P+16E), до 6.0 ГГц, LGA 1700', 59990, 64990, 1, 5, 4.8, 124, 1, 1],
                            ['AMD Ryzen 9 7950X3D', 'Процессор AMD Ryzen 9 7950X3D, 16 ядер, 32 потока, до 5.7 ГГц, AM5', 54990, 59990, 1, 8, 4.9, 89, 1, 1],
                            ['Intel Core i7-14700K', 'Процессор Intel Core i7-14700K, 20 ядер (8P+12E), до 5.6 ГГц, LGA 1700', 39990, 44990, 1, 10, 4.7, 78, 0, 0],
                            ['AMD Ryzen 7 7800X3D', 'Процессор AMD Ryzen 7 7800X3D, 8 ядер, 16 потоков, до 5.0 ГГц, AM5', 36990, 39990, 1, 6, 4.8, 45, 0, 1],
                            ['Intel Core i5-14600K', 'Процессор Intel Core i5-14600K, 14 ядер (6P+8E), до 5.3 ГГц, LGA 1700', 28990, 31990, 1, 15, 4.6, 67, 0, 0],
                            ['AMD Ryzen 5 7600X', 'Процессор AMD Ryzen 5 7600X, 6 ядер, 12 потоков, до 5.3 ГГц, AM5', 21990, 24990, 1, 18, 4.5, 92, 0, 0],
                            ['Intel Core i3-14100', 'Процессор Intel Core i3-14100, 4 ядра, 8 потоков, до 4.7 ГГц, LGA 1700', 14990, 16990, 1, 25, 4.4, 56, 0, 1],
                            ['AMD Ryzen 9 7900X', 'Процессор AMD Ryzen 9 7900X, 12 ядер, 24 потока, до 5.6 ГГц, AM5', 45990, 49990, 1, 7, 4.7, 41, 0, 0],
                            ['Intel Core i9-13900KS', 'Процессор Intel Core i9-13900KS, 24 ядра, до 6.0 ГГц, LGA 1700', 64990, 69990, 1, 3, 4.9, 67, 1, 0],
                            ['AMD Ryzen 7 7700X', 'Процессор AMD Ryzen 7 7700X, 8 ядер, 16 потоков, до 5.4 ГГц, AM5', 29990, 32990, 1, 12, 4.6, 78, 0, 1],
                            ['Intel Core i5-13600KF', 'Процессор Intel Core i5-13600KF, 14 ядер, до 5.1 ГГц, без видеоядра', 25990, 28990, 1, 14, 4.5, 89, 0, 0],
                            ['AMD Ryzen 5 5600X', 'Процессор AMD Ryzen 5 5600X, 6 ядер, 12 потоков, до 4.6 ГГц, AM4', 16990, 19990, 1, 20, 4.7, 156, 1, 0],
                            ['Intel Core i7-13700K', 'Процессор Intel Core i7-13700K, 16 ядер, до 5.4 ГГц, LGA 1700', 37990, 42990, 1, 9, 4.8, 67, 0, 0],
                            ['AMD Ryzen 9 5950X', 'Процессор AMD Ryzen 9 5950X, 16 ядер, 32 потока, до 4.9 ГГц, AM4', 54990, 59990, 1, 5, 4.9, 89, 1, 0],
                            ['Intel Core i9-12900K', 'Процессор Intel Core i9-12900K, 16 ядер, до 5.2 ГГц, LGA 1700', 44990, 49990, 1, 8, 4.7, 112, 0, 0],
                            ['AMD Ryzen 7 5800X3D', 'Процессор AMD Ryzen 7 5800X3D, 8 ядер, 16 потоков, 3D V-Cache', 32990, 37990, 1, 11, 4.8, 134, 1, 0],
                            ['Intel Core i5-12600K', 'Процессор Intel Core i5-12600K, 10 ядер, до 4.9 ГГц, LGA 1700', 23990, 27990, 1, 16, 4.6, 98, 0, 0],
                            ['AMD Ryzen 5 5600G', 'Процессор AMD Ryzen 5 5600G, 6 ядер, с видеоядером Vega 7', 18990, 21990, 1, 22, 4.4, 76, 0, 1],
                            ['Intel Core i3-13100', 'Процессор Intel Core i3-13100, 4 ядра, 8 потоков, до 4.5 ГГц', 12990, 14990, 1, 30, 4.3, 45, 0, 0],
                            ['AMD Ryzen 3 4100', 'Процессор AMD Ryzen 3 4100, 4 ядра, 8 потоков, до 4.0 ГГц', 7990, 9990, 1, 35, 4.2, 67, 0, 0],
                            ['Intel Core i9-11900K', 'Процессор Intel Core i9-11900K, 8 ядер, до 5.3 ГГц, LGA 1200', 37990, 42990, 1, 6, 4.5, 89, 0, 0],
                            ['AMD Ryzen 9 3950X', 'Процессор AMD Ryzen 9 3950X, 16 ядер, 32 потока, до 4.7 ГГц', 49990, 54990, 1, 4, 4.8, 56, 0, 0],
                            ['Intel Core i7-12700K', 'Процессор Intel Core i7-12700K, 12 ядер, до 5.0 ГГц', 34990, 39990, 1, 8, 4.7, 78, 0, 0],
                            ['AMD Ryzen Threadripper 3960X', 'Процессор AMD Threadripper 3960X, 24 ядра, sTRX4', 119990, 129990, 1, 2, 4.9, 23, 1, 0],
                            ['Intel Xeon W-3375', 'Серверный процессор Intel Xeon W-3375, 38 ядер', 459990, 499990, 1, 1, 5.0, 12, 0, 0],
                            ['AMD Ryzen 5 5500', 'Процессор AMD Ryzen 5 5500, 6 ядер, до 4.2 ГГц', 14990, 17990, 1, 25, 4.3, 89, 0, 1],
                            ['Intel Core i5-12400F', 'Процессор Intel Core i5-12400F, 6 ядер, без видеоядра', 15990, 18990, 1, 18, 4.4, 112, 0, 0],
                            ['AMD Ryzen 9 5900X', 'Процессор AMD Ryzen 9 5900X, 12 ядер, 24 потока', 38990, 44990, 1, 7, 4.8, 156, 1, 0],
                            ['Intel Core i7-11700K', 'Процессор Intel Core i7-11700K, 8 ядер, до 5.0 ГГц', 28990, 33990, 1, 9, 4.5, 78, 0, 0],
                            ['AMD Ryzen 7 5700X', 'Процессор AMD Ryzen 7 5700X, 8 ядер, 16 потоков', 24990, 28990, 1, 14, 4.6, 98, 0, 0],
                            ['Intel Core i3-12100', 'Процессор Intel Core i3-12100, 4 ядра, 8 потоков', 11990, 13990, 1, 28, 4.3, 67, 0, 0],
                            ['AMD Ryzen 3 5300G', 'Процессор AMD Ryzen 3 5300G, 4 ядра, с видеоядером', 10990, 12990, 1, 32, 4.2, 45, 0, 0],
                            ['Intel Core i9-10900K', 'Процессор Intel Core i9-10900K, 10 ядер, до 5.3 ГГц', 32990, 37990, 1, 5, 4.6, 89, 0, 0],
                            ['AMD Ryzen 5 4500', 'Процессор AMD Ryzen 5 4500, 6 ядер, до 4.1 ГГц', 12990, 15990, 1, 20, 4.3, 67, 0, 0],
                            ['Intel Core i7-10700K', 'Процессор Intel Core i7-10700K, 8 ядер, до 5.1 ГГц', 24990, 29990, 1, 11, 4.5, 78, 0, 0],
                            
                            // Видеокарты (category_id: 2) - 35 товаров
                            ['NVIDIA RTX 4090', 'Видеокарта NVIDIA GeForce RTX 4090, 24 ГБ GDDR6X, 16384 ядер', 189990, 209990, 2, 3, 4.7, 56, 1, 0],
                            ['AMD Radeon RX 7900 XTX', 'Видеокарта AMD Radeon RX 7900 XTX, 24 ГБ GDDR6, Navi 31', 119990, 129990, 2, 7, 4.6, 42, 0, 1],
                            ['NVIDIA RTX 4080 Super', 'Видеокарта NVIDIA GeForce RTX 4080 Super, 16 ГБ GDDR6X', 119990, 129990, 2, 5, 4.6, 33, 1, 0],
                            ['AMD Radeon RX 7800 XT', 'Видеокарта AMD Radeon RX 7800 XT, 16 ГБ GDDR6, Navi 32', 59990, 64990, 2, 12, 4.5, 28, 0, 1],
                            ['NVIDIA RTX 4070 Ti Super', 'Видеокарта NVIDIA GeForce RTX 4070 Ti Super, 16 ГБ GDDR6X', 84990, 89990, 2, 8, 4.5, 31, 1, 0],
                            ['AMD Radeon RX 7700 XT', 'Видеокарта AMD Radeon RX 7700 XT, 12 ГБ GDDR6, Navi 32', 48990, 52990, 2, 15, 4.4, 19, 0, 1],
                            ['NVIDIA RTX 4070 Super', 'Видеокарта NVIDIA GeForce RTX 4070 Super, 12 ГБ GDDR6X', 63990, 68990, 2, 10, 4.5, 27, 1, 0],
                            ['AMD Radeon RX 7600', 'Видеокарта AMD Radeon RX 7600, 8 ГБ GDDR6, Navi 33', 29990, 32990, 2, 18, 4.3, 42, 0, 0],
                            ['NVIDIA RTX 4060 Ti', 'Видеокарта NVIDIA GeForce RTX 4060 Ti, 16 ГБ GDDR6', 45990, 49990, 2, 14, 4.2, 38, 0, 0],
                            ['AMD Radeon RX 6750 XT', 'Видеокарта AMD Radeon RX 6750 XT, 12 ГБ GDDR6, RDNA 2', 37990, 42990, 2, 9, 4.5, 56, 0, 0],
                            ['NVIDIA RTX 3090 Ti', 'Видеокарта NVIDIA GeForce RTX 3090 Ti, 24 ГБ GDDR6X', 149990, 169990, 2, 4, 4.8, 23, 0, 0],
                            ['AMD Radeon RX 6800 XT', 'Видеокарта AMD Radeon RX 6800 XT, 16 ГБ GDDR6, RDNA 2', 64990, 74990, 2, 6, 4.6, 34, 0, 0],
                            ['NVIDIA RTX 3080 Ti', 'Видеокарта NVIDIA GeForce RTX 3080 Ti, 12 ГБ GDDR6X', 89990, 99990, 2, 5, 4.7, 45, 0, 0],
                            ['AMD Radeon RX 6700 XT', 'Видеокарта AMD Radeon RX 6700 XT, 12 ГБ GDDR6', 42990, 47990, 2, 11, 4.4, 67, 0, 0],
                            ['NVIDIA RTX 3070 Ti', 'Видеокарта NVIDIA GeForce RTX 3070 Ti, 8 ГБ GDDR6X', 55990, 61990, 2, 8, 4.5, 89, 0, 0],
                            ['AMD Radeon RX 6600 XT', 'Видеокарта AMD Radeon RX 6600 XT, 8 ГБ GDDR6', 32990, 37990, 2, 13, 4.3, 78, 0, 0],
                            ['NVIDIA RTX 3060 Ti', 'Видеокарта NVIDIA GeForce RTX 3060 Ti, 8 ГБ GDDR6', 38990, 44990, 2, 16, 4.4, 112, 0, 0],
                            ['AMD Radeon RX 6650 XT', 'Видеокарта AMD Radeon RX 6650 XT, 8 ГБ GDDR6', 34990, 39990, 2, 12, 4.3, 56, 0, 0],
                            ['NVIDIA RTX 3050', 'Видеокарта NVIDIA GeForce RTX 3050, 8 ГБ GDDR6', 28990, 32990, 2, 20, 4.2, 98, 0, 0],
                            ['AMD Radeon RX 6400', 'Видеокарта AMD Radeon RX 6400, 4 ГБ GDDR6', 14990, 17990, 2, 25, 4.1, 45, 0, 0],
                            ['NVIDIA GTX 1660 Super', 'Видеокарта NVIDIA GeForce GTX 1660 Super, 6 ГБ GDDR6', 23990, 27990, 2, 18, 4.3, 156, 0, 0],
                            ['AMD Radeon RX 6500 XT', 'Видеокарта AMD Radeon RX 6500 XT, 4 ГБ GDDR6', 18990, 21990, 2, 22, 4.2, 67, 0, 0],
                            ['NVIDIA RTX 2080 Ti', 'Видеокарта NVIDIA GeForce RTX 2080 Ti, 11 ГБ GDDR6', 79990, 89990, 2, 3, 4.6, 89, 0, 0],
                            ['AMD Radeon VII', 'Видеокарта AMD Radeon VII, 16 ГБ HBM2', 89990, 99990, 2, 2, 4.5, 23, 0, 0],
                            ['NVIDIA Titan RTX', 'Видеокарта NVIDIA Titan RTX, 24 ГБ GDDR6', 299990, 329990, 2, 1, 4.8, 12, 0, 0],
                            ['AMD Radeon RX 5700 XT', 'Видеокарта AMD Radeon RX 5700 XT, 8 ГБ GDDR6', 45990, 51990, 2, 7, 4.4, 78, 0, 0],
                            ['NVIDIA GTX 1080 Ti', 'Видеокарта NVIDIA GeForce GTX 1080 Ti, 11 ГБ GDDR5X', 54990, 59990, 2, 5, 4.6, 134, 0, 0],
                            ['AMD Radeon RX 5600 XT', 'Видеокарта AMD Radeon RX 5600 XT, 6 ГБ GDDR6', 32990, 37990, 2, 9, 4.3, 89, 0, 0],
                            ['NVIDIA RTX 2060 Super', 'Видеокарта NVIDIA GeForce RTX 2060 Super, 8 ГБ GDDR6', 37990, 42990, 2, 11, 4.4, 98, 0, 0],
                            ['AMD Radeon RX 5500 XT', 'Видеокарта AMD Radeon RX 5500 XT, 8 ГБ GDDR6', 25990, 29990, 2, 14, 4.2, 67, 0, 0],
                            ['NVIDIA GTX 1650 Super', 'Видеокарта NVIDIA GeForce GTX 1650 Super, 4 ГБ GDDR6', 19990, 22990, 2, 19, 4.1, 89, 0, 0],
                            ['AMD Radeon RX 590', 'Видеокарта AMD Radeon RX 590, 8 ГБ GDDR5', 27990, 32990, 2, 8, 4.3, 112, 0, 0],
                            ['NVIDIA GTX 1070 Ti', 'Видеокарта NVIDIA GeForce GTX 1070 Ti, 8 ГБ GDDR5', 39990, 45990, 2, 6, 4.5, 78, 0, 0],
                            ['AMD Radeon RX 580', 'Видеокарта AMD Radeon RX 580, 8 ГБ GDDR5', 22990, 27990, 2, 12, 4.2, 156, 0, 0],
                            ['NVIDIA GTX 1060 6GB', 'Видеокарта NVIDIA GeForce GTX 1060, 6 ГБ GDDR5', 24990, 29990, 2, 15, 4.3, 189, 0, 0],
                            
                            // Материнские платы (category_id: 3) - 35 товаров
                            ['ASUS ROG Strix Z790-E', 'Материнская плата ASUS ROG Strix Z790-E Gaming WiFi, LGA 1700', 34990, 39990, 3, 12, 4.5, 31, 0, 0],
                            ['ASUS TUF Gaming B650-Plus', 'Материнская плата ASUS TUF Gaming B650-Plus WiFi, AM5', 19990, 21990, 3, 8, 4.4, 22, 0, 1],
                            ['Gigabyte B760M Aorus Elite', 'Материнская плата Gigabyte B760M Aorus Elite AX, LGA 1700', 15990, 17990, 3, 15, 4.3, 19, 0, 0],
                            ['MSI MAG B650 Tomahawk', 'Материнская плата MSI MAG B650 Tomahawk WiFi, AM5', 18990, 20990, 3, 10, 4.5, 24, 0, 1],
                            ['ASRock B550 Steel Legend', 'Материнская плата ASRock B550 Steel Legend, AM4', 12990, 14990, 3, 18, 4.4, 56, 0, 0],
                            ['ASUS PRIME Z790-P', 'Материнская плата ASUS PRIME Z790-P, LGA 1700', 18990, 21990, 3, 14, 4.3, 34, 0, 0],
                            ['Gigabyte X670E Aorus Master', 'Материнская плата Gigabyte X670E Aorus Master, AM5', 44990, 49990, 3, 5, 4.7, 18, 1, 0],
                            ['MSI MPG Z690 Carbon WiFi', 'Материнская плата MSI MPG Z690 Carbon WiFi, LGA 1700', 29990, 34990, 3, 9, 4.6, 27, 0, 0],
                            ['ASUS ROG Crosshair X670E Hero', 'Материнская плата ASUS ROG Crosshair X670E Hero, AM5', 54990, 59990, 3, 3, 4.8, 15, 1, 0],
                            ['Gigabyte B660M DS3H', 'Материнская плата Gigabyte B660M DS3H, LGA 1700', 11990, 13990, 3, 22, 4.2, 78, 0, 0],
                            ['MSI B550-A PRO', 'Материнская плата MSI B550-A PRO, AM4', 13990, 15990, 3, 16, 4.3, 89, 0, 0],
                            ['ASRock Z690 Phantom Gaming', 'Материнская плата ASRock Z690 Phantom Gaming, LGA 1700', 23990, 27990, 3, 11, 4.4, 45, 0, 0],
                            ['ASUS ProArt Z790-Creator', 'Материнская плата ASUS ProArt Z790-Creator, LGA 1700', 49990, 54990, 3, 4, 4.7, 23, 1, 0],
                            ['Gigabyte B550 Aorus Elite', 'Материнская плата Gigabyte B550 Aorus Elite, AM4', 14990, 17990, 3, 13, 4.3, 67, 0, 0],
                            ['MSI MAG Z790 Tomahawk', 'Материнская плата MSI MAG Z790 Tomahawk WiFi, LGA 1700', 27990, 31990, 3, 8, 4.5, 38, 0, 1],
                            ['ASUS ROG Strix B550-F', 'Материнская плата ASUS ROG Strix B550-F Gaming, AM4', 17990, 20990, 3, 12, 4.4, 56, 0, 0],
                            ['Gigabyte Z690 UD', 'Материнская плата Gigabyte Z690 UD, LGA 1700', 16990, 19990, 3, 15, 4.3, 42, 0, 0],
                            ['MSI B760M Mortar WiFi', 'Материнская плата MSI B760M Mortar WiFi, LGA 1700', 19990, 22990, 3, 10, 4.4, 34, 0, 1],
                            ['ASRock B760M Steel Legend', 'Материнская плата ASRock B760M Steel Legend, LGA 1700', 15990, 18990, 3, 14, 4.3, 29, 0, 0],
                            ['ASUS Prime B660M-A', 'Материнская плата ASUS Prime B660M-A, LGA 1700', 13990, 16990, 3, 18, 4.2, 67, 0, 0],
                            ['Gigabyte X570 Aorus Ultra', 'Материнская плата Gigabyte X570 Aorus Ultra, AM4', 23990, 27990, 3, 7, 4.5, 45, 0, 0],
                            ['MSI MPG X570S Carbon Max', 'Материнская плата MSI MPG X570S Carbon Max WiFi, AM4', 26990, 30990, 3, 6, 4.6, 38, 0, 0],
                            ['ASUS TUF Gaming X570-Plus', 'Материнская плата ASUS TUF Gaming X570-Plus, AM4', 18990, 22990, 3, 11, 4.4, 78, 0, 0],
                            ['Gigabyte B650M Gaming X AX', 'Материнская плата Gigabyte B650M Gaming X AX, AM5', 16990, 19990, 3, 13, 4.3, 45, 0, 1],
                            ['MSI PRO Z790-A WiFi', 'Материнская плата MSI PRO Z790-A WiFi, LGA 1700', 24990, 28990, 3, 9, 4.4, 56, 0, 0],
                            ['ASRock X670E Taichi', 'Материнская плата ASRock X670E Taichi, AM5', 59990, 64990, 3, 2, 4.8, 12, 1, 0],
                            ['ASUS ROG Maximus Z790 Hero', 'Материнская плата ASUS ROG Maximus Z790 Hero, LGA 1700', 69990, 74990, 3, 3, 4.9, 18, 1, 0],
                            ['Gigabyte Z790 Aorus Elite AX', 'Материнская плата Gigabyte Z790 Aorus Elite AX, LGA 1700', 29990, 34990, 3, 7, 4.6, 34, 0, 0],
                            ['MSI B450 Tomahawk Max', 'Материнская плата MSI B450 Tomahawk Max, AM4', 11990, 14990, 3, 20, 4.3, 112, 0, 0],
                            ['ASRock B450M Pro4', 'Материнская плата ASRock B450M Pro4, AM4', 8990, 11990, 3, 25, 4.2, 156, 0, 0],
                            ['ASUS Prime H610M-K', 'Материнская плата ASUS Prime H610M-K, LGA 1700', 7990, 9990, 3, 30, 4.1, 89, 0, 0],
                            ['Gigabyte H610M H', 'Материнская плата Gigabyte H610M H, LGA 1700', 8490, 10990, 3, 28, 4.1, 67, 0, 0],
                            ['MSI H510M-A PRO', 'Материнская плата MSI H510M-A PRO, LGA 1200', 7490, 9990, 3, 32, 4.0, 78, 0, 0],
                            ['ASRock H670 Steel Legend', 'Материнская плата ASRock H670 Steel Legend, LGA 1700', 14990, 18990, 3, 16, 4.3, 45, 0, 0],
                            ['ASUS ROG Strix Z690-F', 'Материнская плата ASUS ROG Strix Z690-F Gaming, LGA 1700', 32990, 37990, 3, 6, 4.7, 29, 0, 0],
                            
                            // Оперативная память (category_id: 4) - 35 товаров
                            ['G.Skill Trident Z5 RGB', 'Оперативная память G.Skill Trident Z5 RGB 32GB (2x16GB) DDR5-6000 CL36', 12990, 14990, 4, 15, 4.8, 67, 1, 1],
                            ['Kingston Fury Beast', 'Оперативная память Kingston Fury Beast 32GB (2x16GB) DDR5-5600 CL36', 8990, 9990, 4, 18, 4.7, 41, 0, 0],
                            ['Corsair Vengeance RGB', 'Оперативная память Corsair Vengeance RGB 32GB (2x16GB) DDR5-6000 CL30', 14990, 16990, 4, 9, 4.8, 52, 1, 0],
                            ['Team Group T-Force Delta', 'Оперативная память Team Group T-Force Delta RGB 32GB DDR5-6000', 10990, 12990, 4, 20, 4.6, 38, 0, 1],
                            ['Crucial Pro DDR5', 'Оперативная память Crucial Pro 32GB (2x16GB) DDR5-5600', 7990, 9990, 4, 25, 4.5, 78, 0, 0],
                            ['G.Skill Ripjaws S5', 'Оперативная память G.Skill Ripjaws S5 32GB DDR5-6000', 11990, 13990, 4, 16, 4.6, 45, 0, 0],
                            ['Kingston Fury Renegade', 'Оперативная память Kingston Fury Renegade 32GB DDR5-6400', 16990, 18990, 4, 7, 4.8, 29, 1, 0],
                            ['Corsair Dominator Platinum', 'Оперативная память Corsair Dominator Platinum 32GB DDR5-6600', 24990, 27990, 4, 4, 4.9, 23, 1, 0],
                            ['Team Group Xtreem ARGB', 'Оперативная память Team Group Xtreem ARGB 32GB DDR5-6200', 13990, 15990, 4, 12, 4.7, 34, 0, 1],
                            ['G.Skill Trident Z Neo', 'Оперативная память G.Skill Trident Z Neo 32GB DDR4-3600', 10990, 12990, 4, 14, 4.6, 89, 0, 0],
                            ['Kingston HyperX Predator', 'Оперативная память Kingston HyperX Predator 32GB DDR4-3200', 9990, 11990, 4, 19, 4.5, 112, 0, 0],
                            ['Corsair Vengeance LPX', 'Оперативная память Corsair Vengeance LPX 32GB DDR4-3200', 9490, 11490, 4, 22, 4.5, 156, 0, 0],
                            ['Crucial Ballistix RGB', 'Оперативная память Crucial Ballistix RGB 32GB DDR4-3600', 11990, 13990, 4, 11, 4.6, 78, 0, 0],
                            ['Team Group Dark Za', 'Оперативная память Team Group Dark Za 32GB DDR4-3200', 8990, 10990, 4, 21, 4.4, 56, 0, 0],
                            ['G.Skill Ripjaws V', 'Оперативная память G.Skill Ripjaws V 32GB DDR4-3600', 10490, 12490, 4, 17, 4.5, 98, 0, 0],
                            ['Kingston Fury Impact', 'Оперативная память Kingston Fury Impact 32GB DDR4-3200 (ноутбучная)', 12990, 14990, 4, 8, 4.6, 45, 0, 0],
                            ['Corsair Vengeance Pro SL', 'Оперативная память Corsair Vengeance Pro SL 32GB DDR4-3600 RGB', 13490, 15490, 4, 10, 4.7, 67, 0, 0],
                            ['G.Skill Trident Z Royal', 'Оперативная память G.Skill Trident Z Royal 32GB DDR4-4000', 19990, 22990, 4, 5, 4.8, 38, 1, 0],
                            ['Team Group Night Hawk', 'Оперативная память Team Group Night Hawk 32GB DDR4-3200', 9490, 11490, 4, 20, 4.4, 56, 0, 0],
                            ['Crucial CT2K16G4DFRA32A', 'Оперативная память Crucial 32GB DDR4-3200', 8490, 10490, 4, 26, 4.3, 89, 0, 0],
                            ['G.Skill Aegis', 'Оперативная память G.Skill Aegis 32GB DDR4-3000', 7990, 9990, 4, 30, 4.2, 112, 0, 0],
                            ['Kingston ValueRAM', 'Оперативная память Kingston ValueRAM 32GB DDR4-2666', 7490, 9490, 4, 35, 4.1, 78, 0, 0],
                            ['Corsair Vengeance RGB Pro', 'Оперативная память Corsair Vengeance RGB Pro 64GB DDR4-3600', 24990, 28990, 4, 6, 4.8, 45, 1, 0],
                            ['G.Skill Trident Z5 RGB 64GB', 'Оперативная память G.Skill Trident Z5 RGB 64GB DDR5-6000', 24990, 27990, 4, 4, 4.9, 23, 1, 0],
                            ['Kingston Fury Beast 64GB', 'Оперативная память Kingston Fury Beast 64GB DDR5-5600', 17990, 20990, 4, 8, 4.7, 34, 0, 0],
                            ['Corsair Dominator Platinum 64GB', 'Оперативная память Corsair Dominator Platinum 64GB DDR5-6400', 44990, 49990, 4, 2, 4.9, 12, 1, 0],
                            ['Team Group T-Force Delta 64GB', 'Оперативная память Team Group T-Force Delta 64GB DDR5-6000', 19990, 22990, 4, 7, 4.8, 29, 0, 0],
                            ['G.Skill Ripjaws S5 64GB', 'Оперативная память G.Skill Ripjaws S5 64GB DDR5-5600', 16990, 19990, 4, 9, 4.7, 38, 0, 0],
                            ['Crucial Pro 64GB DDR5', 'Оперативная память Crucial Pro 64GB DDR5-5200', 15990, 18990, 4, 11, 4.6, 45, 0, 0],
                            ['G.Skill Trident Z Neo 64GB', 'Оперативная память G.Skill Trident Z Neo 64GB DDR4-3600', 18990, 21990, 4, 6, 4.8, 34, 0, 0],
                            ['Corsair Vengeance RGB 64GB', 'Оперативная память Corsair Vengeance RGB 64GB DDR4-3200', 17990, 20990, 4, 8, 4.7, 45, 0, 0],
                            ['Kingston Fury Renegade 64GB', 'Оперативная память Kingston Fury Renegade 64GB DDR4-3600', 19990, 22990, 4, 5, 4.8, 29, 0, 0],
                            ['Team Group Xtreem ARGB 64GB', 'Оперативная память Team Group Xtreem ARGB 64GB DDR4-4000', 22990, 25990, 4, 3, 4.9, 18, 1, 0],
                            ['G.Skill Ripjaws V 64GB', 'Оперативная память G.Skill Ripjaws V 64GB DDR4-3200', 16990, 19990, 4, 10, 4.7, 56, 0, 0],
                            ['Crucial Ballistix 64GB', 'Оперативная память Crucial Ballistix 64GB DDR4-3600', 17490, 20490, 4, 9, 4.7, 45, 0, 0],
                            
                            // Накопители (category_id: 5) - 35 товаров
                            ['Samsung 990 Pro 2TB', 'SSD накопитель Samsung 990 Pro 2TB NVMe M.2, PCIe 4.0', 15990, 17990, 5, 20, 4.9, 94, 1, 0],
                            ['WD Black SN850X', 'SSD накопитель WD Black SN850X 2TB NVMe M.2, PCIe 4.0', 14990, 16990, 5, 25, 4.8, 67, 1, 0],
                            ['Crucial P5 Plus', 'SSD накопитель Crucial P5 Plus 1TB NVMe M.2, PCIe 4.0', 6990, 7990, 5, 30, 4.7, 89, 0, 0],
                            ['Kingston KC3000', 'SSD накопитель Kingston KC3000 2TB NVMe M.2, PCIe 4.0', 13990, 15990, 5, 12, 4.7, 45, 0, 1],
                            ['Samsung 980 Pro', 'SSD накопитель Samsung 980 Pro 1TB NVMe M.2, PCIe 4.0', 8990, 10990, 5, 28, 4.8, 156, 0, 0],
                            ['WD Blue SN570', 'SSD накопитель WD Blue SN570 1TB NVMe M.2, PCIe 3.0', 5990, 7990, 5, 35, 4.6, 189, 0, 0],
                            ['Crucial P3', 'SSD накопитель Crucial P3 1TB NVMe M.2, PCIe 3.0', 5490, 7490, 5, 40, 4.5, 134, 0, 0],
                            ['Kingston NV2', 'SSD накопитель Kingston NV2 1TB NVMe M.2, PCIe 4.0', 6490, 8490, 5, 38, 4.6, 98, 0, 0],
                            ['Samsung 970 Evo Plus', 'SSD накопитель Samsung 970 Evo Plus 1TB NVMe M.2, PCIe 3.0', 7990, 9990, 5, 25, 4.7, 112, 0, 0],
                            ['WD Green SN350', 'SSD накопитель WD Green SN350 1TB NVMe M.2, PCIe 3.0', 5490, 7490, 5, 42, 4.4, 89, 0, 0],
                            ['Crucial MX500', 'SSD накопитель Crucial MX500 1TB SATA 2.5"', 6990, 8990, 5, 32, 4.6, 156, 0, 0],
                            ['Samsung 870 Evo', 'SSD накопитель Samsung 870 Evo 1TB SATA 2.5"', 7990, 9990, 5, 29, 4.7, 134, 0, 0],
                            ['WD Blue 3D NAND', 'SSD накопитель WD Blue 3D NAND 1TB SATA 2.5"', 7490, 9490, 5, 31, 4.6, 98, 0, 0],
                            ['Kingston A400', 'SSD накопитель Kingston A400 960GB SATA 2.5"', 4990, 6990, 5, 45, 4.3, 189, 0, 0],
                            ['Samsung 990 Pro 4TB', 'SSD накопитель Samsung 990 Pro 4TB NVMe M.2, PCIe 4.0', 34990, 39990, 5, 8, 4.9, 45, 1, 0],
                            ['WD Black SN850X 4TB', 'SSD накопитель WD Black SN850X 4TB NVMe M.2, PCIe 4.0', 32990, 37990, 5, 10, 4.8, 38, 0, 0],
                            ['Crucial P5 Plus 4TB', 'SSD накопитель Crucial P5 Plus 4TB NVMe M.2, PCIe 4.0', 29990, 34990, 5, 12, 4.7, 29, 0, 0],
                            ['Kingston KC3000 4TB', 'SSD накопитель Kingston KC3000 4TB NVMe M.2, PCIe 4.0', 31990, 36990, 5, 9, 4.8, 34, 0, 0],
                            ['Samsung 980 Pro 2TB', 'SSD накопитель Samsung 980 Pro 2TB NVMe M.2, PCIe 4.0', 14990, 17990, 5, 18, 4.8, 78, 0, 0],
                            ['WD Black SN770', 'SSD накопитель WD Black SN770 2TB NVMe M.2, PCIe 4.0', 12990, 14990, 5, 22, 4.7, 67, 0, 0],
                            ['Crucial P3 Plus 2TB', 'SSD накопитель Crucial P3 Plus 2TB NVMe M.2, PCIe 4.0', 11990, 13990, 5, 24, 4.6, 56, 0, 0],
                            ['Kingston NV2 2TB', 'SSD накопитель Kingston NV2 2TB NVMe M.2, PCIe 4.0', 10990, 12990, 5, 26, 4.5, 45, 0, 0],
                            ['WD Blue HDD 4TB', 'HDD накопитель WD Blue 4TB 5400 RPM 256MB', 8990, 11990, 5, 15, 4.4, 89, 0, 0],
                            ['Seagate BarraCuda 4TB', 'HDD накопитель Seagate BarraCuda 4TB 5400 RPM 256MB', 8490, 11490, 5, 17, 4.3, 78, 0, 0],
                            ['Toshiba P300 3TB', 'HDD накопитель Toshiba P300 3TB 7200 RPM 64MB', 7990, 10990, 5, 20, 4.4, 67, 0, 0],
                            ['WD Black HDD 6TB', 'HDD накопитель WD Black 6TB 7200 RPM 256MB', 16990, 19990, 5, 8, 4.6, 45, 0, 0],
                            ['Seagate IronWolf 8TB', 'HDD накопитель Seagate IronWolf 8TB 7200 RPM 256MB', 21990, 24990, 5, 6, 4.7, 34, 0, 0],
                            ['WD Red Plus 4TB', 'HDD накопитель WD Red Plus 4TB 5400 RPM 256MB', 12990, 15990, 5, 11, 4.5, 56, 0, 0],
                            ['Samsung 990 Pro 1TB', 'SSD накопитель Samsung 990 Pro 1TB NVMe M.2, PCIe 4.0', 10990, 12990, 5, 30, 4.8, 112, 0, 0],
                            ['WD Black SN850X 1TB', 'SSD накопитель WD Black SN850X 1TB NVMe M.2, PCIe 4.0', 10490, 12490, 5, 32, 4.7, 98, 0, 0],
                            ['Crucial P5 Plus 512GB', 'SSD накопитель Crucial P5 Plus 512GB NVMe M.2, PCIe 4.0', 4990, 6990, 5, 45, 4.5, 134, 0, 0],
                            ['Kingston KC3000 1TB', 'SSD накопитель Kingston KC3000 1TB NVMe M.2, PCIe 4.0', 9990, 11990, 5, 35, 4.7, 89, 0, 0],
                            ['Samsung 980 500GB', 'SSD накопитель Samsung 980 500GB NVMe M.2, PCIe 3.0', 4990, 6990, 5, 42, 4.4, 156, 0, 0],
                            ['WD Blue SN570 500GB', 'SSD накопитель WD Blue SN570 500GB NVMe M.2, PCIe 3.0', 3990, 5990, 5, 48, 4.3, 189, 0, 0],
                            ['Crucial P3 2TB', 'SSD накопитель Crucial P3 2TB NVMe M.2, PCIe 3.0', 10990, 12990, 5, 28, 4.6, 78, 0, 0],
                            
                            // Блоки питания (category_id: 6) - 35 товаров
                            ['Corsair RM1000x', 'Блок питания Corsair RM1000x 1000W 80+ Gold, fully modular', 18990, 21990, 6, 9, 4.7, 28, 0, 1],
                            ['Seasonic Focus GX-850', 'Блок питания Seasonic Focus GX-850 850W 80+ Gold', 12990, 14990, 6, 15, 4.8, 42, 0, 0],
                            ['be quiet! Straight Power 11', 'Блок питания be quiet! Straight Power 11 750W 80+ Platinum', 15990, 17990, 6, 7, 4.9, 37, 1, 0],
                            ['ASUS ROG Thor 1200P', 'Блок питания ASUS ROG Thor 1200P 1200W 80+ Platinum', 29990, 34990, 6, 4, 4.6, 19, 1, 1],
                            ['Corsair RM850x', 'Блок питания Corsair RM850x 850W 80+ Gold', 13990, 16990, 6, 12, 4.7, 56, 0, 0],
                            ['Seasonic Prime TX-1000', 'Блок питания Seasonic Prime TX-1000 1000W 80+ Titanium', 24990, 28990, 6, 5, 4.9, 23, 1, 0],
                            ['be quiet! Dark Power 13', 'Блок питания be quiet! Dark Power 13 1000W 80+ Titanium', 27990, 31990, 6, 3, 4.8, 18, 1, 0],
                            ['ASUS TUF Gaming 750W', 'Блок питания ASUS TUF Gaming 750W 80+ Bronze', 8990, 11990, 6, 18, 4.4, 67, 0, 0],
                            ['Cooler Master MWE Gold 850', 'Блок питания Cooler Master MWE Gold 850W 80+ Gold', 10990, 13990, 6, 14, 4.6, 45, 0, 0],
                            ['FSP Hydro G Pro 1000W', 'Блок питания FSP Hydro G Pro 1000W 80+ Gold', 17990, 20990, 6, 8, 4.7, 34, 0, 0],
                            ['NZXT C850', 'Блок питания NZXT C850 850W 80+ Gold', 14990, 17990, 6, 10, 4.7, 38, 0, 0],
                            ['Gigabyte UD850GM', 'Блок питания Gigabyte UD850GM 850W 80+ Gold', 11990, 14990, 6, 16, 4.5, 56, 0, 0],
                            ['EVGA SuperNOVA 1000 G6', 'Блок питания EVGA SuperNOVA 1000 G6 1000W 80+ Gold', 19990, 22990, 6, 7, 4.8, 29, 0, 0],
                            ['Thermaltake Toughpower GF3', 'Блок питания Thermaltake Toughpower GF3 1200W 80+ Gold', 21990, 24990, 6, 5, 4.7, 34, 0, 0],
                            ['Deepcool PQ850M', 'Блок питания Deepcool PQ850M 850W 80+ Gold', 10490, 13490, 6, 17, 4.6, 45, 0, 0],
                            ['Corsair CX650M', 'Блок питания Corsair CX650M 650W 80+ Bronze', 6990, 8990, 6, 25, 4.3, 89, 0, 0],
                            ['Seasonic S12III 650W', 'Блок питания Seasonic S12III 650W 80+ Bronze', 6490, 8490, 6, 28, 4.2, 78, 0, 0],
                            ['be quiet! System Power 9 600W', 'Блок питания be quiet! System Power 9 600W 80+ Bronze', 7490, 9490, 6, 22, 4.4, 67, 0, 0],
                            ['ASUS Prime 750W', 'Блок питания ASUS Prime 750W 80+ Bronze', 8490, 10990, 6, 20, 4.3, 56, 0, 0],
                            ['Cooler Master Elite V3 600W', 'Блок питания Cooler Master Elite V3 600W 80+', 4990, 6990, 6, 35, 4.1, 112, 0, 0],
                            ['FSP Hexa 85+ 550W', 'Блок питания FSP Hexa 85+ 550W 80+ Bronze', 5490, 7490, 6, 32, 4.2, 89, 0, 0],
                            ['Gigabyte P550B', 'Блок питания Gigabyte P550B 550W 80+ Bronze', 5990, 7990, 6, 30, 4.3, 78, 0, 0],
                            ['Corsair RM750x', 'Блок питания Corsair RM750x 750W 80+ Gold', 12990, 15990, 6, 13, 4.7, 67, 0, 0],
                            ['Seasonic Focus GX-750', 'Блок питания Seasonic Focus GX-750 750W 80+ Gold', 11990, 14990, 6, 15, 4.6, 56, 0, 0],
                            ['be quiet! Pure Power 11 700W', 'Блок питания be quiet! Pure Power 11 700W 80+ Gold', 13990, 16990, 6, 11, 4.7, 45, 0, 0],
                            ['ASUS ROG Strix 850W', 'Блок питания ASUS ROG Strix 850W 80+ Gold', 16990, 19990, 6, 9, 4.8, 38, 0, 0],
                            ['Cooler Master V850 Gold', 'Блок питания Cooler Master V850 Gold 850W 80+ Gold', 14990, 17990, 6, 12, 4.7, 34, 0, 0],
                            ['FSP Hydro GE 850W', 'Блок питания FSP Hydro GE 850W 80+ Gold', 13490, 16490, 6, 14, 4.6, 45, 0, 0],
                            ['NZXT C750', 'Блок питания NZXT C750 750W 80+ Gold', 13990, 16990, 6, 13, 4.7, 56, 0, 0],
                            ['Gigabyte AORUS P850W', 'Блок питания Gigabyte AORUS P850W 850W 80+ Gold', 15990, 18990, 6, 10, 4.8, 29, 0, 0],
                            ['EVGA 600 W1', 'Блок питания EVGA 600 W1 600W 80+', 5990, 7990, 6, 31, 4.2, 98, 0, 0],
                            ['Thermaltake Smart BX1 650W', 'Блок питания Thermaltake Smart BX1 650W 80+ Bronze', 6990, 8990, 6, 27, 4.3, 78, 0, 0],
                            ['Deepcool DQ850-M-V2L', 'Блок питания Deepcool DQ850-M-V2L 850W 80+ Gold', 12490, 15490, 6, 16, 4.6, 45, 0, 0],
                            ['Corsair HX1500i', 'Блок питания Corsair HX1500i 1500W 80+ Platinum', 34990, 39990, 6, 2, 4.9, 15, 1, 0],
                            ['Seasonic Prime PX-1600', 'Блок питания Seasonic Prime PX-1600 1600W 80+ Platinum', 44990, 49990, 6, 1, 4.9, 12, 1, 0],
                            
                            // Корпуса (category_id: 7) - 35 товаров
                            ['NZXT H9 Flow', 'Корпус NZXT H9 Flow Black, Mid-Tower, стеклянные панели', 15990, 17990, 7, 14, 4.6, 19, 1, 1],
                            ['Lian Li O11 Dynamic EVO', 'Корпус Lian Li O11 Dynamic EVO, Mid-Tower, двустороннее стекло', 17990, 19990, 7, 8, 4.8, 27, 1, 0],
                            ['Fractal Design North', 'Корпус Fractal Design North, Mid-Tower, деревянная отделка', 14990, 16990, 7, 11, 4.7, 33, 0, 1],
                            ['Phanteks Eclipse G360A', 'Корпус Phanteks Eclipse G360A, Mid-Tower, ARGB вентиляторы', 8990, 10990, 7, 22, 4.5, 41, 0, 0],
                            ['Corsair 4000D Airflow', 'Корпус Corsair 4000D Airflow, Mid-Tower, меш-фасад', 11990, 13990, 7, 18, 4.7, 78, 0, 0],
                            ['be quiet! Silent Base 802', 'Корпус be quiet! Silent Base 802, Mid-Tower, звукоизоляция', 16990, 19990, 7, 9, 4.8, 45, 0, 0],
                            ['Cooler Master MasterBox TD500', 'Корпус Cooler Master MasterBox TD500 Mesh, ARGB вентиляторы', 10990, 12990, 7, 16, 4.6, 56, 0, 0],
                            ['Fractal Design Meshify 2', 'Корпус Fractal Design Meshify 2, Mid-Tower, меш-фасад', 13990, 16990, 7, 13, 4.7, 67, 0, 0],
                            ['NZXT H510 Flow', 'Корпус NZXT H510 Flow, Mid-Tower, меш-фасад', 9990, 11990, 7, 20, 4.5, 89, 0, 0],
                            ['Lian Li Lancool 216', 'Корпус Lian Li Lancool 216, Mid-Tower, два 160мм вентилятора', 12990, 14990, 7, 15, 4.7, 45, 0, 0],
                            ['Phanteks Enthoo Pro 2', 'Корпус Phanteks Enthoo Pro 2, Full-Tower, поддержка серверных плат', 19990, 22990, 7, 7, 4.8, 34, 0, 0],
                            ['Corsair iCUE 5000D', 'Корпус Corsair iCUE 5000D Airflow, Mid-Tower, RGB освещение', 18990, 21990, 7, 8, 4.8, 38, 0, 0],
                            ['be quiet! Pure Base 500DX', 'Корпус be quiet! Pure Base 500DX, Mid-Tower, ARGB подсветка', 13490, 15490, 7, 14, 4.7, 56, 0, 0],
                            ['Cooler Master HAF 700 EVO', 'Корпус Cooler Master HAF 700 EVO, Full-Tower, экстремальное охлаждение', 29990, 34990, 7, 3, 4.9, 23, 1, 0],
                            ['Fractal Design Torrent', 'Корпус Fractal Design Torrent, Mid-Tower, два 180мм вентилятора', 17990, 20990, 7, 9, 4.8, 45, 0, 0],
                            ['NZXT H7 Flow', 'Корпус NZXT H7 Flow, Mid-Tower, улучшенная вентиляция', 13990, 16990, 7, 12, 4.7, 56, 0, 0],
                            ['Lian Li PC-O11 Dynamic', 'Корпус Lian Li PC-O11 Dynamic, Mid-Tower, стеклянные панели', 16990, 19990, 7, 10, 4.8, 67, 0, 0],
                            ['Phanteks P600S', 'Корпус Phanteks P600S, Mid-Tower, звукоизоляция', 15990, 18990, 7, 11, 4.7, 45, 0, 0],
                            ['Corsair 7000D Airflow', 'Корпус Corsair 7000D Airflow, Full-Tower, максимальная расширяемость', 24990, 28990, 7, 5, 4.9, 29, 1, 0],
                            ['be quiet! Dark Base Pro 901', 'Корпус be quiet! Dark Base Pro 901, Full-Tower, модульная конструкция', 27990, 31990, 7, 4, 4.9, 23, 1, 0],
                            ['Cooler Master Cosmos C700M', 'Корпус Cooler Master Cosmos C700M, Full-Tower, премиум-дизайн', 34990, 39990, 7, 2, 4.9, 18, 1, 0],
                            ['Fractal Design Define 7', 'Корпус Fractal Design Define 7, Mid-Tower, звукоизоляция', 14990, 17990, 7, 13, 4.7, 56, 0, 0],
                            ['NZXT H510 Elite', 'Корпус NZXT H510 Elite, Mid-Tower, RGB подсветка', 12990, 15990, 7, 15, 4.6, 78, 0, 0],
                            ['Lian Li Lancool III', 'Корпус Lian Li Lancool III, Mid-Tower, меш-фасад', 16990, 19990, 7, 10, 4.8, 45, 0, 0],
                            ['Phanteks Eclipse P500A', 'Корпус Phanteks Eclipse P500A, Mid-Tower, RGB вентиляторы', 14990, 17990, 7, 12, 4.7, 56, 0, 0],
                            ['Corsair Carbide Series 275R', 'Корпус Corsair Carbide Series 275R, Mid-Tower, минимализм', 9990, 12990, 7, 19, 4.5, 89, 0, 0],
                            ['be quiet! Shadow Base 800', 'Корпус be quiet! Shadow Base 800, Mid-Tower, затемненное стекло', 17990, 20990, 7, 9, 4.7, 38, 0, 0],
                            ['Cooler Master MasterCase H500', 'Корпус Cooler Master MasterCase H500, Mid-Tower, два 200мм вентилятора', 13990, 16990, 7, 14, 4.7, 67, 0, 0],
                            ['Fractal Design Pop Air', 'Корпус Fractal Design Pop Air, Mid-Tower, цветные варианты', 10990, 13990, 7, 17, 4.6, 56, 0, 0],
                            ['NZXT H5 Flow', 'Корпус NZXT H5 Flow, Mid-Tower, компактный', 8990, 11990, 7, 21, 4.5, 78, 0, 0],
                            ['Lian Li Lancool 205 Mesh', 'Корпус Lian Li Lancool 205 Mesh, Mid-Tower, меш-фасад', 9490, 12490, 7, 20, 4.5, 67, 0, 0],
                            ['Phanteks Enthoo 719', 'Корпус Phanteks Enthoo 719, Full-Tower, поддержка двойной системы', 21990, 25990, 7, 6, 4.8, 34, 0, 0],
                            ['Corsair Obsidian Series 1000D', 'Корпус Corsair Obsidian Series 1000D, Super-Tower, экстремальная сборка', 49990, 54990, 7, 1, 4.9, 12, 1, 0],
                            ['be quiet! Silent Base 601', 'Корпус be quiet! Silent Base 601, Mid-Tower, звукоизоляция', 14990, 17990, 7, 13, 4.7, 45, 0, 0],
                            ['Cooler Master NR200', 'Корпус Cooler Master NR200, Mini-ITX, для компактных сборок', 8990, 11990, 7, 22, 4.6, 89, 0, 0],
                            
                            // Охлаждение (category_id: 8) - 35 товаров
                            ['Noctua NH-D15', 'Кулер для процессора Noctua NH-D15, 2 вентилятора NF-A15', 9990, 11990, 8, 15, 4.9, 156, 1, 0],
                            ['be quiet! Dark Rock Pro 4', 'Кулер для процессора be quiet! Dark Rock Pro 4', 8990, 10990, 8, 18, 4.8, 134, 1, 0],
                            ['Cooler Master Hyper 212', 'Кулер для процессора Cooler Master Hyper 212 EVO V2', 2990, 3990, 8, 35, 4.5, 189, 0, 0],
                            ['Arctic Liquid Freezer II 360', 'СЖО Arctic Liquid Freezer II 360, 360мм радиатор', 10990, 12990, 8, 12, 4.8, 89, 0, 1],
                            ['Corsair iCUE H150i Elite', 'СЖО Corsair iCUE H150i Elite CAPELLIX, 360мм, RGB', 14990, 17990, 8, 10, 4.7, 78, 1, 0],
                            ['NZXT Kraken Z73', 'СЖО NZXT Kraken Z73, 360мм, LCD дисплей', 19990, 22990, 8, 8, 4.8, 56, 1, 0],
                            ['Deepcool AK620', 'Кулер для процессора Deepcool AK620, 2 вентилятора', 6990, 8990, 8, 22, 4.7, 67, 0, 0],
                            ['Noctua NH-U12A', 'Кулер для процессора Noctua NH-U12A, 2 вентилятора NF-A12x25', 8990, 10990, 8, 16, 4.8, 98, 0, 0],
                            ['be quiet! Pure Rock 2', 'Кулер для процессора be quiet! Pure Rock 2', 4490, 5990, 8, 28, 4.6, 112, 0, 0],
                            ['Cooler Master MasterLiquid ML240L', 'СЖО Cooler Master MasterLiquid ML240L V2 RGB, 240мм', 6990, 8990, 8, 20, 4.6, 89, 0, 0],
                            ['Arctic Cooling P12 PWM PST', 'Вентилятор корпусный Arctic Cooling P12 PWM PST 5-pack', 3990, 5990, 8, 30, 4.7, 156, 0, 0],
                            ['Corsair LL120 RGB 3-pack', 'Вентилятор Corsair LL120 RGB 120mm 3-pack с контроллером', 9990, 11990, 8, 15, 4.6, 78, 0, 0],
                            ['Noctua NF-A14 PWM', 'Вентилятор Noctua NF-A14 PWM 140mm', 1990, 2990, 8, 40, 4.8, 189, 0, 0],
                            ['be quiet! Silent Wings 3', 'Вентилятор be quiet! Silent Wings 3 140mm PWM', 2490, 3490, 8, 35, 4.7, 134, 0, 0],
                            ['Lian Li UNI FAN SL-Infinity', 'Вентилятор Lian Li UNI FAN SL-Infinity 120mm 3-pack', 12990, 14990, 8, 12, 4.8, 56, 0, 1],
                            ['Thermalright Peerless Assassin', 'Кулер для процессора Thermalright Peerless Assassin 120 SE', 5990, 7990, 8, 24, 4.7, 89, 0, 0],
                            ['Deepcool LT720', 'СЖО Deepcool LT720, 360мм, LCD дисплей', 12990, 15990, 8, 9, 4.8, 45, 0, 1],
                            ['NZXT Kraken X63', 'СЖО NZXT Kraken X63, 280мм, RGB', 12990, 14990, 8, 11, 4.7, 67, 0, 0],
                            ['Corsair H100i Elite', 'СЖО Corsair H100i Elite CAPELLIX, 240мм, RGB', 11990, 13990, 8, 13, 4.7, 78, 0, 0],
                            ['Arctic Liquid Freezer II 280', 'СЖО Arctic Liquid Freezer II 280, 280мм радиатор', 9990, 11990, 8, 14, 4.8, 56, 0, 0],
                            ['Noctua NH-L9i', 'Низкопрофильный кулер Noctua NH-L9i для Mini-ITX', 4990, 6990, 8, 25, 4.7, 89, 0, 0],
                            ['be quiet! Dark Rock TF 2', 'Низкопрофильный кулер be quiet! Dark Rock TF 2', 7990, 9990, 8, 18, 4.7, 45, 0, 0],
                            ['Cooler Master MASTERFAN MF120', 'Вентилятор Cooler Master MASTERFAN MF120 Halo 3-pack', 6990, 8990, 8, 22, 4.6, 67, 0, 0],
                            ['Deepcool FC120', 'Вентилятор Deepcool FC120 120mm 3-pack RGB', 4990, 6990, 8, 28, 4.5, 89, 0, 0],
                            ['Lian Li UNI FAN AL120', 'Вентилятор Lian Li UNI FAN AL120 120mm 3-pack', 10990, 12990, 8, 14, 4.7, 56, 0, 0],
                            ['Thermalright Phantom Spirit', 'Кулер для процессора Thermalright Phantom Spirit 120 SE', 6490, 8490, 8, 21, 4.7, 78, 0, 0],
                            ['EK-AIO Basic 360', 'СЖО EK-AIO Basic 360, 360мм радиатор', 11990, 13990, 8, 10, 4.8, 45, 0, 0],
                            ['Fractal Design Celsius+ S36', 'СЖО Fractal Design Celsius+ S36 Dynamic, 360мм', 13990, 16990, 8, 8, 4.7, 34, 0, 0],
                            ['ID-COOLING SE-224-XTS', 'Кулер для процессора ID-COOLING SE-224-XTS', 2990, 4990, 8, 32, 4.5, 112, 0, 0],
                            ['Scythe Fuma 2', 'Кулер для процессора Scythe Fuma 2', 6990, 8990, 8, 19, 4.7, 89, 0, 0],
                            ['Vetroo V5', 'Кулер для процессора Vetroo V5 с RGB подсветкой', 3990, 5990, 8, 26, 4.6, 134, 0, 0],
                            ['Cooler Master Hyper 212 Black', 'Кулер для процессора Cooler Master Hyper 212 Black Edition', 3490, 5490, 8, 30, 4.5, 156, 0, 0],
                            ['Arctic Freezer 34 eSports DUO', 'Кулер для процессора Arctic Freezer 34 eSports DUO', 4990, 6990, 8, 24, 4.6, 98, 0, 0],
                            ['Noctua NH-D15S', 'Кулер для процессора Noctua NH-D15S (одновентиляторная версия)', 8490, 10490, 8, 17, 4.8, 78, 0, 0],
                            ['be quiet! Shadow Rock 3', 'Кулер для процессора be quiet! Shadow Rock 3', 6990, 8990, 8, 20, 4.7, 67, 0, 0]
                        ];
                        
                        const stmt = db.prepare(`INSERT INTO products 
                            (name, description, price, old_price, category_id, stock, image_url, rating, reviews_count, is_featured, is_new) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                        
                        products.forEach(product => {
                            stmt.run(product, (err) => {
                                if (err) console.error('Ошибка добавления товара:', err.message);
                            });
                        });
                        
                        stmt.finalize();
                        console.log('✅ Тестовые товары добавлены');
                    });
                }
            });
        }
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
        if (err) {
            console.error('❌ Ошибка создания таблицы orders:', err.message);
        } else {
            console.log('✅ Таблица orders создана/проверена');
        }
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
        if (err) {
            console.error('❌ Ошибка создания таблицы order_items:', err.message);
        } else {
            console.log('✅ Таблица order_items создана/проверена');
        }
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
        if (err) {
            console.error('❌ Ошибка создания таблицы favorites:', err.message);
        } else {
            console.log('✅ Таблица favorites создана/проверена');
        }
    });
    
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
        
        // РАСЧИТЫВАЕМ СУММУ ПРАВИЛЬНО
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
        
        // Проверяем разницу (допускаем 1 рубль из-за округления)
        const difference = Math.abs(calculatedTotal - receivedTotal);
        
        if (difference > 1) {
            console.log(`⚠️  РАСХОЖДЕНИЕ В СУММАХ! Разница: ${difference} ₽`);
            console.log('🔍 Принимаю расчетную сумму как правильную');
            orderData.total_amount = calculatedTotal;
        } else {
            console.log('✅ Суммы совпадают (разница < 1 рубля)');
        }
        
        // Проверяем обязательные поля
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
        
        // Используем расчетную сумму
        const finalTotal = orderData.total_amount || calculatedTotal;
        
        // Начинаем транзакцию
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Генерируем номер заказа
            const orderNumber = 'ORD-' + Date.now().toString().slice(-8);
            
            // Определяем, какие колонки есть в таблице orders
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
                    // Если ошибка из-за структуры таблицы, пробуем альтернативный запрос
                    if (err.message.includes('no such column') || err.message.includes('has no column')) {
                        console.log('⚠️  Проблема со структурой таблицы, пробую альтернативный запрос...');
                        
                        // Альтернативный запрос с минимальным набором полей
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
            
            // Функция для добавления товаров заказа
            function processOrderItems(orderId, totalAmount, orderNumber) {
                let itemsProcessed = 0;
                let hasError = false;
                
                orderData.items.forEach((item, index) => {
                    // Проверяем структуру таблицы order_items
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
                            // Если ошибка из-за структуры, пробуем альтернативный запрос
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
                            
                            // Логируем успешный заказ
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
                                clearCart: true // Флаг для фронтенда
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
    
    const query = `
        INSERT INTO products (name, slug, description, price, category_id, stock, image_url, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [name, slug, description || '', parseFloat(price), category_id || null, parseInt(stock), image_url || 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', is_active ? 1 : 0], function(err) {
        if (err) {
            console.error('❌ Ошибка создания товара:', err.message);
            return res.status(500).json({ 
                success: false,
                message: 'Ошибка базы данных'
            });
        }
        
        const productId = this.lastID;
        console.log(`✅ Товар создан: ${name} (ID: ${productId})`);
        
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
            
            // Получаем данные пользователя
            db.get('SELECT id, username, email, role FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Ошибка получения данных пользователя' });
                }
                
                // Генерируем БЕССРОЧНЫЙ токен
                const token = generateToken(user);
                
                console.log(`🔐 Сгенерирован БЕССРОЧНЫЙ токен длиной ${token.length} символов`);
                console.log(`🔐 Токен НИКОГДА НЕ ИСТЕЧЕТ!`);
                
                // Сохраняем токен внутри объекта пользователя
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
        
        // Генерируем БЕССРОЧНЫЙ токен
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
        
        // Сохраняем токен внутри объекта пользователя
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

// ========== ИСПРАВЛЕННЫЙ ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ ЗАКАЗОВ ПОЛЬЗОВАТЕЛЯ ==========
app.get('/api/orders/my', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    console.log(`📋 Запрос заказов пользователя ID: ${userId}`);
    
    // Универсальный запрос - генерирует номер заказа на лету
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
🎲 Каждый вход генерирует УНИКАЛЬНЫЙ токен

📡 Основные API эндпоинты:
   • Тест сервера:        http://localhost:${PORT}/api/test
   • Регистрация:         POST http://localhost:${PORT}/api/register
   • Вход:                POST http://localhost:${PORT}/api/login
   • Проверка токена:     GET http://localhost:${PORT}/api/verify
   • Профиль:             GET http://localhost:${PORT}/api/profile
   • Аватар:              POST http://localhost:${PORT}/api/profile/avatar
   • Мои заказы:          GET http://localhost:${PORT}/api/orders/my

🔍 Диагностические эндпоинты:
   • Получить токен:      GET http://localhost:${PORT}/api/get-token/1
   • Диагностика:         POST http://localhost:${PORT}/api/debug-token
   • Проверить токен:     GET http://localhost:${PORT}/api/verify

👑 Админ эндпоинты (требуют токен администратора):
   • Пользователи:        GET http://localhost:${PORT}/api/admin/users
   • Товары:              GET http://localhost:${PORT}/api/admin/products
   • Категории:           GET http://localhost:${PORT}/api/admin/categories
   • Заказы:              GET http://localhost:${PORT}/api/admin/orders
   • Статистика:          GET http://localhost:${PORT}/api/admin/stats

👤 Тестовые аккаунты:
   Администратор:
     Email: admin@pcstore.ru
     Пароль: admin123
   
   Пользователь:
     Email: user@pcstore.ru
     Пароль: user123
   
   Модератор:
     Email: moderator@pcstore.ru
     Пароль: mod123

🎯 ОСОБЕННОСТЬ: 
   • Токены БЕССРОЧНЫЕ - больше никогда не будет ошибки jwt expired!
   • Заказы отображаются с автоматической генерацией номеров
   • Аватары загружаются через JSON - поддерживаются разные форматы
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

// Экспортируем для тестирования
module.exports = { app, db, initDatabase, addMissingColumns };