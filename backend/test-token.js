// test-token.js - Тестовый скрипт для проверки токена
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-secret-key-change-in-production';

// Создаем тестовый токен
const testUser = {
    id: 1,
    username: 'admin',
    email: 'admin@pcstore.ru',
    role: 'admin'
};

const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '24h' });

console.log('🔐 Тестовый токен создан:');
console.log('Токен:', token);
console.log('Длина токена:', token.length);
console.log('\n📋 Пример заголовка Authorization для curl:');
console.log(`Authorization: Bearer ${token}`);

console.log('\n📋 Пример запроса curl:');
console.log(`curl -X POST http://localhost:3001/api/test-token \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json"`);

console.log('\n📋 Пример запроса на создание заказа:');
console.log(`curl -X POST http://localhost:3001/api/orders \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      {"productId": 1, "quantity": 2, "price": 59999}
    ],
    "totalAmount": 119998,
    "shippingAddress": "Тестовый адрес",
    "paymentMethod": "card"
  }'`);