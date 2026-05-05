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
    description TEXT
);

-- Товары
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category_id INT,
    stock INT DEFAULT 0,
    specifications JSON,
    rating DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Заказы
CREATE TABLE IF NOT EXISTS orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    order_number VARCHAR(20) UNIQUE,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    shipping_address TEXT,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Состав заказа
CREATE TABLE IF NOT EXISTS order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT,
    product_id INT,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Корзина
CREATE TABLE IF NOT EXISTS cart (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    product_id INT,
    quantity INT DEFAULT 1,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Вставка тестовых данных
INSERT INTO categories (id, name, slug, description) VALUES
(1, 'Процессоры', 'processors', 'Центральные процессоры для настольных компьютеров'),
(2, 'Видеокарты', 'video-cards', 'Графические процессоры для игр и работы'),
(3, 'Материнские платы', 'motherboards', 'Основные платы для сборки ПК'),
(4, 'Оперативная память', 'ram', 'Оперативная память DDR4 и DDR5'),
(5, 'Накопители', 'storage', 'SSD и HDD накопители'),
(6, 'Блоки питания', 'power-supplies', 'Источники питания для ПК'),
(7, 'Корпуса', 'cases', 'Корпуса для системных блоков'),
(8, 'Охлаждение', 'cooling', 'Системы охлаждения для процессоров');

-- Вставка тестовых товаров
INSERT INTO products (name, slug, description, price, category_id, stock) VALUES
-- Процессоры
('Intel Core i5-12400F', 'intel-core-i5-12400f', 'Процессор Intel Core i5-12400F, 6 ядер, 12 потоков', 18990.00, 1, 15),
('AMD Ryzen 5 5600X', 'amd-ryzen-5-5600x', 'Процессор AMD Ryzen 5 5600X, 6 ядер, 12 потоков', 19990.00, 1, 10),
('Intel Core i7-13700K', 'intel-core-i7-13700k', 'Процессор Intel Core i7-13700K, 16 ядер, 24 потока', 34990.00, 1, 7),
('AMD Ryzen 7 7800X3D', 'amd-ryzen-7-7800x3d', 'Процессор AMD Ryzen 7 7800X3D, 8 ядер, 16 потоков', 42990.00, 1, 5),

-- Видеокарты
('NVIDIA RTX 4060 Ti', 'nvidia-rtx-4060-ti', 'Видеокарта NVIDIA GeForce RTX 4060 Ti 8GB', 45990.00, 2, 8),
('AMD RX 7800 XT', 'amd-rx-7800-xt', 'Видеокарта AMD Radeon RX 7800 XT 16GB', 52990.00, 2, 6),
('NVIDIA RTX 4070', 'nvidia-rtx-4070', 'Видеокарта NVIDIA GeForce RTX 4070 12GB', 59990.00, 2, 4),
('NVIDIA RTX 4090', 'nvidia-rtx-4090', 'Видеокарта NVIDIA GeForce RTX 4090 24GB', 159990.00, 2, 2),

-- Материнские платы
('ASUS ROG Strix B550-F', 'asus-rog-strix-b550-f', 'Материнская плата ASUS ROG Strix B550-F Gaming', 15990.00, 3, 12),
('MSI MAG B760 TOMAHAWK', 'msi-mag-b760-tomahawk', 'Материнская плата MSI MAG B760 TOMAHAWK WIFI', 18990.00, 3, 9),
('Gigabyte B650 AORUS ELITE', 'gigabyte-b650-aorus-elite', 'Материнская плата Gigabyte B650 AORUS ELITE AX', 21990.00, 3, 7),

-- Оперативная память
('Kingston Fury 16GB DDR4', 'kingston-fury-16gb-ddr4', 'Оперативная память Kingston Fury Beast 16GB DDR4 3200MHz', 4990.00, 4, 25),
('Corsair Vengeance 32GB DDR5', 'corsair-vengeance-32gb-ddr5', 'Оперативная память Corsair Vengeance 32GB DDR5 5600MHz', 12990.00, 4, 14),
('G.Skill Trident Z5 64GB', 'gskill-trident-z5-64gb', 'Оперативная память G.Skill Trident Z5 64GB DDR5 6000MHz', 28990.00, 4, 6),

-- Накопители
('Samsung 980 Pro 1TB', 'samsung-980-pro-1tb', 'SSD накопитель Samsung 980 Pro 1TB NVMe M.2', 8990.00, 5, 18),
('Crucial P5 Plus 2TB', 'crucial-p5-plus-2tb', 'SSD накопитель Crucial P5 Plus 2TB NVMe M.2', 12990.00, 5, 15),
('WD Black SN850X 4TB', 'wd-black-sn850x-4tb', 'SSD накопитель WD Black SN850X 4TB NVMe M.2', 35990.00, 5, 4),

-- Блоки питания
('Be Quiet! Pure Power 12 850W', 'be-quiet-pure-power-12-850w', 'Блок питания Be Quiet! Pure Power 12 850W 80+ Gold', 10990.00, 6, 9),
('Corsair RM850x', 'corsair-rm850x', 'Блок питания Corsair RM850x 850W 80+ Gold', 13990.00, 6, 8),
('Seasonic Focus GX-750', 'seasonic-focus-gx-750', 'Блок питания Seasonic Focus GX-750 750W 80+ Gold', 9990.00, 6, 11),

-- Корпуса
('NZXT H5 Flow', 'nzxt-h5-flow', 'Корпус NZXT H5 Flow Black', 8990.00, 7, 11),
('Lian Li Lancool 216', 'lian-li-lancool-216', 'Корпус Lian Li Lancool 216 Black', 7990.00, 7, 8),
('Fractal Design North', 'fractal-design-north', 'Корпус Fractal Design North Charcoal Black', 14990.00, 7, 5),

-- Охлаждение
('Noctua NH-D15', 'noctua-nh-d15', 'Кулер для процессора Noctua NH-D15', 8990.00, 8, 7),
('Arctic Liquid Freezer II 360', 'arctic-liquid-freezer-ii-360', 'СЖО Arctic Liquid Freezer II 360', 11990.00, 8, 6),
('be quiet! Dark Rock Pro 4', 'be-quiet-dark-rock-pro-4', 'Кулер для процессора be quiet! Dark Rock Pro 4', 9990.00, 8, 9);

-- Тестовый администратор (пароль: admin123)
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@pcstore.ru', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK3a5yE2hUhK5ZIRMh.6YVtq3Qy/G', 'admin');

-- Добавляем второго администратора (пароль: admin456)
INSERT INTO users (username, email, password_hash, role) VALUES
('admin2', 'admin2@pcstore.ru', '$2a$10$8xQrGdjKpqiHdRXlTml612OsgZMyqjfC1QVY9Y1j5Eli5H6z9qYUyH', 'admin');