-- Создание базы данных
CREATE DATABASE IF NOT EXISTS pc_store;
USE pc_store;

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Категории товаров
CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    parent_id INT NULL
);

-- Товары
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    old_price DECIMAL(10,2),
    category_id INT,
    stock INT DEFAULT 0,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Тестовые данные
INSERT IGNORE INTO categories (id, name, slug) VALUES
(1, 'Процессоры', 'processors'),
(2, 'Видеокарты', 'video-cards'),
(3, 'Материнские платы', 'motherboards'),
(4, 'Оперативная память', 'ram'),
(5, 'Накопители', 'storage');

INSERT IGNORE INTO products (name, slug, description, price, category_id, stock, image_url) VALUES
('Intel Core i5-12400F', 'intel-core-i5-12400f', 'Процессор Intel Core i5-12400F', 18990.00, 1, 15, 'cpu1.jpg'),
('AMD Ryzen 5 5600X', 'amd-ryzen-5-5600x', 'Процессор AMD Ryzen 5 5600X', 19990.00, 1, 10, 'cpu2.jpg'),
('NVIDIA RTX 4060 Ti', 'nvidia-rtx-4060-ti', 'Видеокарта NVIDIA GeForce RTX 4060 Ti', 45990.00, 2, 8, 'gpu1.jpg'),
('Kingston Fury 16GB DDR4', 'kingston-fury-16gb-ddr4', 'Оперативная память Kingston Fury 16GB DDR4', 4990.00, 4, 25, 'ram1.jpg');

-- Администратор (пароль: admin123)
INSERT IGNORE INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@pcstore.com', '$2b$10$YourHashedPasswordHere', 'admin');