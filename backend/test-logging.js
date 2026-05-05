// test-logging.js - Тестирование логирования
const logger = require('./logger');

console.log('🧪 Начинаем тестирование логирования...');

// Тест 1: Простое сообщение
console.log('\n1. Тест простого сообщения:');
logger.info('Тестовое информационное сообщение');

// Тест 2: Заказ
console.log('\n2. Тест логирования заказа:');
const testOrder = {
    orderId: 'TEST-' + Date.now(),
    userId: 'test-user-123',
    totalAmount: 14999,
    itemsCount: 3,
    shippingAddress: 'Москва, ул. Тестовая, 123',
    paymentMethod: 'card',
    items: [
        { productId: 1, quantity: 2, price: 5000 },
        { productId: 2, quantity: 1, price: 4999 }
    ]
};

logger.logOrder(testOrder);

// Тест 3: Ошибка
console.log('\n3. Тест логирования ошибки:');
logger.error('Тестовая ошибка', { code: 'TEST_ERROR', details: 'Это тестовая ошибка' });

// Проверка содержимого папки
console.log('\n4. Проверяем содержимое папки logs:');
const files = logger.checkLogs();

console.log('\n✅ Тестирование завершено!');
console.log('📁 Проверьте папку logs:');
console.log(`   ${logger.logDir}`);

// Если файлов нет, покажем ошибку
if (files.length === 0) {
    console.error('\n❌ Файлы логов не созданы! Проверьте права на запись.');
    console.log('Возможные решения:');
    console.log('1. Запустите от имени администратора');
    console.log('2. Проверьте права на папку');
    console.log('3. Создайте папку logs вручную');
}