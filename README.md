# PC Store - Интернет-магазин компьютерных комплектующих

Современный интернет-магазин для сборки и покупки ПК.

## Быстрый старт

cd backend
npm install
cp .env.example .env
npm start

Сайт http://localhost:3000

## Команды

npm start - запуск
npm run dev - запуск с nodemon

## Docker

docker-compose up -d

API http://localhost:5000
Adminer http://localhost:8080

## Учётные записи

admin@pcstore.ru / admin123
user1@example.com / password123

## API

GET /api/products
GET /api/products/:slug
GET /api/categories
POST /api/register
POST /api/login
POST /api/orders
GET /api/orders/my

## Структура

backend/ - сервер
frontend/ - клиент
admin/ - админка
database/ - SQL
config/ - конфиги
utils/ - утилиты
forms/ - PHP формы