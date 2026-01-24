const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
    console.log('🚀 Инициализация базы данных PC Store...');
    
    const dbPath = path.join(__dirname, 'database.sqlite');
    
    // Удаляем старую базу если есть
    try {
        await fs.unlink(dbPath);
        console.log('🗑️  Удалена старая база данных');
    } catch (err) {
        console.log('📁 Создаем новую базу данных');
    }
    
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath);
    
    // Создаем таблицы
    console.log('🔧 Создаем таблицы...');
    
    const createTables = `
        PRAGMA foreign_keys = ON;
        
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT
        );
        
        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            category_id INTEGER,
            stock INTEGER DEFAULT 0,
            specifications TEXT,
            rating REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        );
        
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            order_number TEXT UNIQUE,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            shipping_address TEXT,
            payment_method TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        
        CREATE TABLE order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            product_id INTEGER,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
        
        CREATE TABLE cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            product_id INTEGER,
            quantity INTEGER DEFAULT 1,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    `;
    
    // Разбиваем на отдельные запросы
    const statements = createTables.split(';').filter(stmt => stmt.trim());
    
    for (const stmt of statements) {
        await new Promise((resolve, reject) => {
            db.run(stmt, (err) => {
                if (err) {
                    console.error(`❌ Ошибка: ${err.message}`);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    
    console.log('✅ Таблицы созданы');
    
    // Добавляем категории
    console.log('📝 Добавляем категории...');
    const categories = [
        ['Процессоры', 'processors', 'Центральные процессоры для настольных компьютеров'],
        ['Видеокарты', 'video-cards', 'Графические процессоры для игр и работы'],
        ['Материнские платы', 'motherboards', 'Основные платы для сборки ПК'],
        ['Оперативная память', 'ram', 'Оперативная память DDR4 и DDR5'],
        ['Накопители', 'storage', 'SSD и HDD накопители'],
        ['Блоки питания', 'power-supplies', 'Источники питания для ПК'],
        ['Корпуса', 'cases', 'Корпуса для системных блоков'],
        ['Охлаждение', 'cooling', 'Системы охлаждения для процессоров']
    ];
    
    for (const category of categories) {
        await new Promise((resolve, reject) => {
            db.run('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)', category, (err) => {
                if (err) reject(err);
                else {
                    console.log(`✅ Категория: ${category[0]}`);
                    resolve();
                }
            });
        });
    }
    
    // Добавляем товары
    console.log('📝 Добавляем товары...');
    const products = [
        // Процессоры
        ['Intel Core i5-12400F', 'intel-core-i5-12400f', 'Процессор Intel Core i5-12400F, 6 ядер, 12 потоков', 18990, 1, 15],
        ['AMD Ryzen 5 5600X', 'amd-ryzen-5-5600x', 'Процессор AMD Ryzen 5 5600X, 6 ядер, 12 потоков', 19990, 1, 10],
        ['Intel Core i7-13700K', 'intel-core-i7-13700k', 'Процессор Intel Core i7-13700K, 16 ядер, 24 потока', 34990, 1, 7],
        ['AMD Ryzen 7 7800X3D', 'amd-ryzen-7-7800x3d', 'Процессор AMD Ryzen 7 7800X3D, 8 ядер, 16 потоков', 42990, 1, 5],

        // Видеокарты
        ['NVIDIA RTX 4060 Ti', 'nvidia-rtx-4060-ti', 'Видеокарта NVIDIA GeForce RTX 4060 Ti 8GB', 45990, 2, 8],
        ['AMD RX 7800 XT', 'amd-rx-7800-xt', 'Видеокарта AMD Radeon RX 7800 XT 16GB', 52990, 2, 6],
        ['NVIDIA RTX 4070', 'nvidia-rtx-4070', 'Видеокарта NVIDIA GeForce RTX 4070 12GB', 59990, 2, 4],
        ['NVIDIA RTX 4090', 'nvidia-rtx-4090', 'Видеокарта NVIDIA GeForce RTX 4090 24GB', 159990, 2, 2],

        // Материнские платы
        ['ASUS ROG Strix B550-F', 'asus-rog-strix-b550-f', 'Материнская плата ASUS ROG Strix B550-F Gaming', 15990, 3, 12],
        ['MSI MAG B760 TOMAHAWK', 'msi-mag-b760-tomahawk', 'Материнская плата MSI MAG B760 TOMAHAWK WIFI', 18990, 3, 9],
        ['Gigabyte B650 AORUS ELITE', 'gigabyte-b650-aorus-elite', 'Материнская плата Gigabyte B650 AORUS ELITE AX', 21990, 3, 7],

        // Оперативная память
        ['Kingston Fury 16GB DDR4', 'kingston-fury-16gb-ddr4', 'Оперативная память Kingston Fury Beast 16GB DDR4 3200MHz', 4990, 4, 25],
        ['Corsair Vengeance 32GB DDR5', 'corsair-vengeance-32gb-ddr5', 'Оперативная память Corsair Vengeance 32GB DDR5 5600MHz', 12990, 4, 14],
        ['G.Skill Trident Z5 64GB', 'gskill-trident-z5-64gb', 'Оперативная память G.Skill Trident Z5 64GB DDR5 6000MHz', 28990, 4, 6],

        // Накопители
        ['Samsung 980 Pro 1TB', 'samsung-980-pro-1tb', 'SSD накопитель Samsung 980 Pro 1TB NVMe M.2', 8990, 5, 18],
        ['Crucial P5 Plus 2TB', 'crucial-p5-plus-2tb', 'SSD накопитель Crucial P5 Plus 2TB NVMe M.2', 12990, 5, 15],
        ['WD Black SN850X 4TB', 'wd-black-sn850x-4tb', 'SSD накопитель WD Black SN850X 4TB NVMe M.2', 35990, 5, 4],

        // Блоки питания
        ['Be Quiet! Pure Power 12 850W', 'be-quiet-pure-power-12-850w', 'Блок питания Be Quiet! Pure Power 12 850W 80+ Gold', 10990, 6, 9],
        ['Corsair RM850x', 'corsair-rm850x', 'Блок питания Corsair RM850x 850W 80+ Gold', 13990, 6, 8],
        ['Seasonic Focus GX-750', 'seasonic-focus-gx-750', 'Блок питания Seasonic Focus GX-750 750W 80+ Gold', 9990, 6, 11],

        // Корпуса
        ['NZXT H5 Flow', 'nzxt-h5-flow', 'Корпус NZXT H5 Flow Black', 8990, 7, 11],
        ['Lian Li Lancool 216', 'lian-li-lancool-216', 'Корпус Lian Li Lancool 216 Black', 7990, 7, 8],
        ['Fractal Design North', 'fractal-design-north', 'Корпус Fractal Design North Charcoal Black', 14990, 7, 5],

        // Охлаждение
        ['Noctua NH-D15', 'noctua-nh-d15', 'Кулер для процессора Noctua NH-D15', 8990, 8, 7],
        ['Arctic Liquid Freezer II 360', 'arctic-liquid-freezer-ii-360', 'СЖО Arctic Liquid Freezer II 360', 11990, 8, 6],
        ['be quiet! Dark Rock Pro 4', 'be-quiet-dark-rock-pro-4', 'Кулер для процессора be quiet! Dark Rock Pro 4', 9990, 8, 9]
    ];
    
    for (const product of products) {
        await new Promise((resolve, reject) => {
            db.run('INSERT INTO products (name, slug, description, price, category_id, stock) VALUES (?, ?, ?, ?, ?, ?)', product, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    console.log(`✅ Добавлено ${products.length} товаров`);
    
    // Создаем пользователей
    console.log('👤 Создаем пользователей...');
    
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const userPasswordHash = await bcrypt.hash('user123', 10);
    
    await new Promise((resolve, reject) => {
        db.run('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)', 
            ['admin', 'admin@pcstore.ru', adminPasswordHash, 'admin'], (err) => {
                if (err) reject(err);
                else {
                    console.log('✅ Администратор: admin@pcstore.ru (пароль: admin123)');
                    resolve();
                }
            });
    });
    
    await new Promise((resolve, reject) => {
        db.run('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)', 
            ['user', 'user@pcstore.ru', userPasswordHash, 'user'], (err) => {
                if (err) reject(err);
                else {
                    console.log('✅ Пользователь: user@pcstore.ru (пароль: user123)');
                    resolve();
                }
            });
    });
    
    // Закрываем базу
    db.close();
    
    console.log('\n🎉 База данных успешно инициализирована!');
    console.log('📂 Файл базы: database.sqlite');
    console.log('\n👤 Данные для входа:');
    console.log('   Администратор: admin@pcstore.ru / admin123');
    console.log('   Пользователь: user@pcstore.ru / user123');
    console.log('\n🚀 Запустите сервер командой: npm run dev');
}

initializeDatabase().catch(console.error);