-- Тестовые данные для базы данных
USE pc_store;

-- Категории товаров
INSERT INTO categories (name, slug, description) VALUES
('Процессоры', 'cpu', 'Центральные процессоры Intel и AMD'),
('Видеокарты', 'gpu', 'Видеокарты NVIDIA и AMD'),
('Материнские платы', 'motherboards', 'Материнские платы для сборки ПК'),
('Оперативная память', 'ram', 'Модули оперативной памяти DDR4 и DDR5'),
('Накопители', 'storage', 'SSD и HDD накопители');

-- Товары
INSERT INTO products (name, description, price, category_id, stock, image_url, is_featured) VALUES
('Intel Core i5-12400F', '6 ядер, 12 потоков, 4.4 ГГц', 15999, 1, 25, 'cpu_intel_i5.jpg', TRUE),
('AMD Ryzen 5 5600X', '6 ядер, 12 потоков, 4.6 ГГц', 17999, 1, 18, 'cpu_amd_5600x.jpg', TRUE),
('NVIDIA GeForce RTX 4060', '8GB GDDR6, DLSS 3', 35999, 2, 12, 'gpu_rtx4060.jpg', TRUE),
('AMD Radeon RX 7600', '8GB GDDR6, 32 вычислительных ядер', 29999, 2, 15, 'gpu_rx7600.jpg', TRUE),
('ASUS PRIME B660M-A', 'LGA 1700, DDR4, PCIe 4.0', 8999, 3, 30, 'mb_asus_prime.jpg', FALSE),
('Kingston Fury 16GB DDR4', '3200 МГц, CL16', 3999, 4, 50, 'ram_kingston.jpg', TRUE),
('Samsung 980 Pro 1TB', 'NVMe PCIe 4.0, чтение 7000 МБ/с', 8999, 5, 40, 'ssd_samsung.jpg', TRUE),
('Seagate Barracuda 2TB', 'HDD, 7200 об/мин, SATA III', 4999, 5, 60, 'hdd_seagate.jpg', FALSE);

-- Тестовый пользователь
INSERT INTO users (email, password, name) VALUES
('test@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye3sY7a5J2QVqL1QcJQJ4Fpz6v5V5j5W2', 'Тестовый Пользователь');

-- Тестовый заказ
INSERT INTO orders (user_id, total, status, shipping_address, customer_name, customer_email, customer_phone) VALUES
(1, 60996, 'pending', 'ул. Примерная, д. 1, г. Москва', 'Тестовый Пользователь', 'test@example.com', '+79991234567');

-- Товары в тестовом заказе
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
(1, 1, 1, 15999),
(1, 3, 1, 35999),
(1, 6, 2, 7998);