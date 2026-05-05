# 🖥️ PC Store — Интернет-магазин компьютерных комплектующих

<<<<<<< HEAD
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-blue.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-lightgrey.svg)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Современный интернет-магазин по продаже компьютерных комплектующих с возможностью сборки ПК через конфигуратор. Включает каталог товаров с фильтрацией и поиском, корзину, систему заказов с логированием, админ-панель для управления магазином и переключение светлой/тёмной темы.

---

## 📋 Содержание

- [Быстрый старт](#-быстрый-старт)
- [Команды](#-команды)
- [Docker](#-docker)
- [Учётные записи](#-учётные-записи)
- [API Endpoints](#-api-endpoints)
- [Структура проекта](#-структура-проекта)
- [Переменные окружения](#-переменные-окружения)
- [База данных](#-база-данных)
- [Технологии](#-технологии)
- [Лицензия](#-лицензия)

---

## 🚀 Быстрый старт

### Требования

- Node.js 18 или выше
- npm 9 или выше

### Установка и запуск

```bash
# 1. Клонирование репозитория
git clone https://github.com/myn-bit/my.git pc-store
cd pc-store

# 2. Переход в папку backend
cd backend

# 3. Установка зависимостей
npm install

# 4. Настройка переменных окружения
cp .env.example .env

# 5. Запуск сервера
npm start