// logger.js - Система логирования для PC Store
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

class Logger {
    constructor() {
        // Путь к директории логов
        this.logDir = path.join(__dirname, 'logs');
        
        // Создаем директорию логов если её нет
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        
        // Создаем поддиректории
        const subDirs = ['orders', 'errors', 'daily'];
        subDirs.forEach(dir => {
            const dirPath = path.join(this.logDir, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        });
        
        console.log(`📁 Система логирования инициализирована: ${this.logDir}`);
    }
    
    // Получить текущую дату в формате YYYY-MM-DD
    getCurrentDate() {
        return format(new Date(), 'yyyy-MM-dd');
    }
    
    // Получить текущее время в формате HH:mm:ss
    getCurrentTime() {
        return format(new Date(), 'HH:mm:ss');
    }
    
    // Получить полную дату и время
    getCurrentDateTime() {
        return format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    }
    
    // Запись в лог файл
    writeToLog(fileName, message, data = null) {
        try {
            const logPath = path.join(this.logDir, fileName);
            const timestamp = this.getCurrentDateTime();
            let logMessage = `[${timestamp}] ${message}`;
            
            if (data && typeof data === 'object') {
                logMessage += ' ' + JSON.stringify(data, null, 2);
            } else if (data) {
                logMessage += ' ' + String(data);
            }
            
            logMessage += '\n';
            
            // Используем appendFile с колбэком для асинхронной записи
            fs.appendFile(logPath, logMessage, (err) => {
                if (err) {
                    console.error('❌ Ошибка записи в лог файл:', err.message);
                }
            });
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка в методе writeToLog:', error.message);
            return false;
        }
    }
    
    // Запись в лог ошибок
    writeToErrorLog(message, error = null) {
        try {
            const errorLogPath = path.join(this.logDir, 'errors', `errors-${this.getCurrentDate()}.log`);
            const timestamp = this.getCurrentDateTime();
            
            let errorMessage = `[${timestamp}] ${message}`;
            
            if (error) {
                if (error instanceof Error) {
                    errorMessage += `\n  Ошибка: ${error.message}`;
                    errorMessage += `\n  Стек: ${error.stack}`;
                } else {
                    errorMessage += `\n  Данные: ${JSON.stringify(error, null, 2)}`;
                }
            }
            
            errorMessage += '\n' + '-'.repeat(80) + '\n';
            
            // Используем переменную вместо const для перезаписи
            let finalErrorMessage = errorMessage;
            
            fs.appendFile(errorLogPath, finalErrorMessage, (err) => {
                if (err) {
                    console.error('❌ Ошибка записи в лог ошибок:', err.message);
                }
            });
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка в методе writeToErrorLog:', error.message);
            return false;
        }
    }
    
    // Логирование информации
    info(message, data = null) {
        console.log(`[${this.getCurrentTime()}] [INFO] ${message}`);
        
        // Записываем в ежедневный лог
        const dailyLogFile = `app-${this.getCurrentDate()}.log`;
        this.writeToLog(dailyLogFile, `[INFO] ${message}`, data);
        
        // Также записываем в общий лог
        this.writeToLog('app.log', `[INFO] ${message}`, data);
        
        return true;
    }
    
    // Логирование предупреждений
    warn(message, data = null) {
        console.log(`[${this.getCurrentTime()}] [WARN] ${message}`);
        
        // Записываем в ежедневный лог
        const dailyLogFile = `app-${this.getCurrentDate()}.log`;
        this.writeToLog(dailyLogFile, `[WARN] ${message}`, data);
        
        // Также записываем в общий лог
        this.writeToLog('app.log', `[WARN] ${message}`, data);
        
        return true;
    }
    
    // Логирование ошибок
    error(message, error = null) {
        console.error(`[${this.getCurrentTime()}] [ERROR] ${message}`);
        if (error) {
            console.error(error);
        }
        
        // Записываем в лог ошибок
        this.writeToErrorLog(`[ERROR] ${message}`, error);
        
        // Также записываем в ежедневный лог
        const dailyLogFile = `app-${this.getCurrentDate()}.log`;
        this.writeToLog(dailyLogFile, `[ERROR] ${message}`, error);
        
        // И в общий лог
        this.writeToLog('app.log', `[ERROR] ${message}`, error);
        
        return true;
    }
    
    // Логирование заказов
    logOrder(orderData) {
        try {
            if (!orderData || !orderData.orderId) {
                console.error('❌ Некорректные данные заказа для логирования');
                return false;
            }
            
            const orderLogPath = path.join(this.logDir, 'orders', `order-${orderData.orderId}.json`);
            const orderLog = {
                ...orderData,
                loggedAt: this.getCurrentDateTime()
            };
            
            fs.writeFileSync(orderLogPath, JSON.stringify(orderLog, null, 2));
            
            console.log(`✅ Заказ #${orderData.orderId} записан в лог: ${orderLogPath}`);
            
            // Также логируем в общий лог
            this.info(`Заказ записан: #${orderData.orderId}, сумма: ${orderData.totalAmount} руб.`, {
                orderId: orderData.orderId,
                username: orderData.username,
                totalAmount: orderData.totalAmount,
                itemsCount: orderData.itemsCount || 0
            });
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка при логировании заказа:', error.message);
            this.error('Ошибка при логировании заказа', error);
            return false;
        }
    }
    
    // Получить логи за определенную дату
    getLogs(date = null) {
        try {
            const targetDate = date || this.getCurrentDate();
            const logFile = path.join(this.logDir, `app-${targetDate}.log`);
            
            if (!fs.existsSync(logFile)) {
                return [];
            }
            
            const content = fs.readFileSync(logFile, 'utf8');
            return content.split('\n').filter(line => line.trim());
        } catch (error) {
            console.error('❌ Ошибка при чтении логов:', error.message);
            return [];
        }
    }
    
    // Проверить состояние логов
    checkLogs() {
        try {
            const logs = {
                totalLogs: 0,
                errorLogs: 0,
                orderLogs: 0,
                recentLogs: [],
                diskUsage: {}
            };
            
            // Проверяем общие логи
            const appLogPath = path.join(this.logDir, 'app.log');
            if (fs.existsSync(appLogPath)) {
                const stats = fs.statSync(appLogPath);
                logs.diskUsage.appLog = `${(stats.size / 1024).toFixed(2)} KB`;
            }
            
            // Проверяем ошибки
            const errorDir = path.join(this.logDir, 'errors');
            if (fs.existsSync(errorDir)) {
                const errorFiles = fs.readdirSync(errorDir).filter(f => f.endsWith('.log'));
                logs.errorLogs = errorFiles.length;
            }
            
            // Проверяем заказы
            const ordersDir = path.join(this.logDir, 'orders');
            if (fs.existsSync(ordersDir)) {
                const orderFiles = fs.readdirSync(ordersDir).filter(f => f.endsWith('.json'));
                logs.orderLogs = orderFiles.length;
            }
            
            // Получаем последние 10 строк из сегодняшнего лога
            const todayLog = this.getLogs();
            logs.recentLogs = todayLog.slice(-10);
            logs.totalLogs = todayLog.length;
            
            return logs;
        } catch (error) {
            console.error('❌ Ошибка при проверке логов:', error.message);
            return { error: error.message };
        }
    }
    
    // Получить статистику логов
    getLogStats() {
        try {
            const stats = {
                totalDays: 0,
                totalErrors: 0,
                totalOrders: 0,
                diskUsage: {},
                lastUpdated: this.getCurrentDateTime()
            };
            
            // Считаем логи по дням
            const files = fs.readdirSync(this.logDir);
            const logFiles = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));
            stats.totalDays = logFiles.length;
            
            // Считаем ошибки
            const errorDir = path.join(this.logDir, 'errors');
            if (fs.existsSync(errorDir)) {
                const errorFiles = fs.readdirSync(errorDir).filter(f => f.endsWith('.log'));
                stats.totalErrors = errorFiles.length;
            }
            
            // Считаем заказы
            const ordersDir = path.join(this.logDir, 'orders');
            if (fs.existsSync(ordersDir)) {
                const orderFiles = fs.readdirSync(ordersDir).filter(f => f.endsWith('.json'));
                stats.totalOrders = orderFiles.length;
            }
            
            // Расчет использования диска
            let totalSize = 0;
            const calculateDirSize = (dirPath) => {
                let size = 0;
                const items = fs.readdirSync(dirPath);
                
                items.forEach(item => {
                    const itemPath = path.join(dirPath, item);
                    const stat = fs.statSync(itemPath);
                    
                    if (stat.isDirectory()) {
                        size += calculateDirSize(itemPath);
                    } else {
                        size += stat.size;
                    }
                });
                
                return size;
            };
            
            totalSize = calculateDirSize(this.logDir);
            stats.diskUsage.total = `${(totalSize / 1024 / 1024).toFixed(2)} MB`;
            stats.diskUsage.logsDir = this.logDir;
            
            return stats;
        } catch (error) {
            console.error('❌ Ошибка при получении статистики логов:', error.message);
            return { error: error.message };
        }
    }
    
    // Очистка старых логов
    cleanupOldLogs(daysToKeep = 30) {
        try {
            console.log(`🧹 Очистка логов старше ${daysToKeep} дней...`);
            
            const files = fs.readdirSync(this.logDir);
            let deletedCount = 0;
            let errorCount = 0;
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            files.forEach(file => {
                // Обрабатываем только файлы логов с датой
                if (file.startsWith('app-') && file.endsWith('.log')) {
                    try {
                        const dateStr = file.replace('app-', '').replace('.log', '');
                        const fileDate = new Date(dateStr);
                        
                        if (fileDate < cutoffDate) {
                            const filePath = path.join(this.logDir, file);
                            fs.unlinkSync(filePath);
                            deletedCount++;
                            console.log(`🗑️ Удален старый лог: ${file}`);
                        }
                    } catch (error) {
                        errorCount++;
                        console.error(`❌ Ошибка при удалении файла ${file}:`, error.message);
                    }
                }
            });
            
            // Также чистим старые логи ошибок
            const errorDir = path.join(this.logDir, 'errors');
            if (fs.existsSync(errorDir)) {
                const errorFiles = fs.readdirSync(errorDir);
                errorFiles.forEach(file => {
                    if (file.startsWith('errors-') && file.endsWith('.log')) {
                        try {
                            const dateStr = file.replace('errors-', '').replace('.log', '');
                            const fileDate = new Date(dateStr);
                            
                            if (fileDate < cutoffDate) {
                                const filePath = path.join(errorDir, file);
                                fs.unlinkSync(filePath);
                                deletedCount++;
                                console.log(`🗑️ Удален старый лог ошибок: ${file}`);
                            }
                        } catch (error) {
                            errorCount++;
                            console.error(`❌ Ошибка при удалении файла ошибок ${file}:`, error.message);
                        }
                    }
                });
            }
            
            const result = {
                deleted: deletedCount,
                errors: errorCount,
                message: `Очистка завершена. Удалено: ${deletedCount}, ошибок: ${errorCount}`
            };
            
            console.log(`✅ ${result.message}`);
            return result;
        } catch (error) {
            console.error('❌ Ошибка при очистке логов:', error.message);
            return { error: error.message };
        }
    }
}

// Создаем экземпляр логгера
const loggerInstance = new Logger();

// Экспортируем функции для удобства использования
module.exports = {
    // Основные методы логирования
    info: (message, data) => loggerInstance.info(message, data),
    warn: (message, data) => loggerInstance.warn(message, data),
    error: (message, error) => loggerInstance.error(message, error),
    
    // Специальные методы
    logOrder: (orderData) => loggerInstance.logOrder(orderData),
    
    // Методы для управления логами
    getLogs: (date) => loggerInstance.getLogs(date),
    getLogStats: () => loggerInstance.getLogStats(),
    checkLogs: () => loggerInstance.checkLogs(),
    cleanupOldLogs: (days) => loggerInstance.cleanupOldLogs(days),
    
    // Свойства
    logDir: loggerInstance.logDir
};