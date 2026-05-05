// logMiddleware.js - Middleware для логирования запросов
const logger = require('./logger');

const logMiddleware = {
    // Логирование всех запросов
    logRequests: (req, res, next) => {
        const startTime = Date.now();
        const originalSend = res.send;
        const originalJson = res.json;
        
        // Перехватываем отправку ответа
        res.send = function(body) {
            const duration = Date.now() - startTime;
            logRequest(req, res.statusCode, duration);
            return originalSend.call(this, body);
        };
        
        res.json = function(body) {
            const duration = Date.now() - startTime;
            logRequest(req, res.statusCode, duration);
            return originalJson.call(this, body);
        };
        
        next();
    },
    
    // Логирование ошибок
    logErrors: (err, req, res, next) => {
        logger.error('Ошибка при обработке запроса', {
            error: err.message,
            stack: err.stack,
            url: req.url,
            method: req.method,
            ip: req.ip
        });
        
        next(err);
    }
};

// Функция для логирования запросов
function logRequest(req, statusCode, duration) {
    try {
        const logData = {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.headers['user-agent'] || 'неизвестно',
            statusCode: statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        };
        
        // Добавляем информацию о поиске, если есть
        if (req.url.includes('/api/products') && req.query.search) {
            logData.hasSearch = true;
            logData.searchQuery = req.query.search;
        }
        
        // Логируем в зависимости от статуса
        if (statusCode >= 500) {
            logger.error(`Запрос ${req.method} ${req.url} - ${statusCode}`, logData);
        } else if (statusCode >= 400) {
            logger.warn(`Запрос ${req.method} ${req.url} - ${statusCode}`, logData);
        } else {
            logger.info(`Запрос ${req.method} ${req.url}`, logData);
        }
    } catch (error) {
        console.error('❌ Ошибка при логировании запроса:', error.message);
    }
}

module.exports = logMiddleware;