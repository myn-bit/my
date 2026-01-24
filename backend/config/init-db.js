const database = require('./database');
const bcrypt = require('bcryptjs');

async function initDatabase() {
    try {
        // Таблица пользователей
        await database.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                is_banned INTEGER DEFAULT 0,
                ban_reason TEXT,
                banned_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Таблица категорий
        await database.exec(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                slug TEXT NOT NULL UNIQUE,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Таблица товаров
        await database.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                description TEXT,
                price REAL NOT NULL,
                category_id INTEGER,
                stock INTEGER DEFAULT 0,
                specifications TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
            )
        `);
        
        // Таблица заказов
        await database.exec(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                total_amount REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                shipping_address TEXT,
                shipping_city TEXT,
                shipping_postal_code TEXT,
                shipping_country TEXT,
                payment_method TEXT,
                payment_status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            )
        `);
        
        // Таблица элементов заказа
        await database.exec(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                total REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
            )
        `);
        
        // Добавляем тестовые данные
        await addTestData();
        
        console.log('База данных инициализирована успешно!');
    } catch (error) {
        console.error('Ошибка инициализации базы данных:', error);
    }
}

async function addTestData() {
    try {
        // Проверяем, есть ли уже администратор
        const adminExists = await database.get('SELECT id FROM users WHERE username = ?', ['admin']);
        
        if (!adminExists) {
            // Добавляем администратора
            const salt = bcrypt.genSaltSync(10);
            const adminPasswordHash = bcrypt.hashSync('admin123', salt);
            
            await database.run(
                `INSERT INTO users (username, email, password_hash, role) 
                VALUES (?, ?, ?, ?)`,
                ['admin', 'admin@pcstore.ru', adminPasswordHash, 'admin']
            );
        }
        
        // Добавляем тестовые категории
        const categories = [
            ['Процессоры', 'processors', 'Процессоры Intel Core и AMD Ryzen'],
            ['Видеокарты', 'video-cards', 'Видеокарты NVIDIA и AMD'],
            ['Материнские платы', 'motherboards', 'Материнские платы'],
            ['Оперативная память', 'ram', 'Оперативная память DDR4/DDR5'],
            ['Накопители', 'storage', 'SSD и HDD накопители'],
            ['Блоки питания', 'power-supplies', 'Блоки питания'],
            ['Корпуса', 'cases', 'Корпуса для ПК'],
            ['Охлаждение', 'cooling', 'Системы охлаждения']
        ];
        
        for (const [name, slug, description] of categories) {
            const exists = await database.get('SELECT id FROM categories WHERE slug = ?', [slug]);
            if (!exists) {
                await database.run(
                    `INSERT INTO categories (name, slug, description) 
                    VALUES (?, ?, ?)`,
                    [name, slug, description]
                );
            }
        }
        
        // Добавляем тестовые товары
        const products = [
            ['Intel Core i7-14700K', 'intel-core-i7-14700k', 'Процессор Intel Core i7-14700K', 39990, 1, 15],
            ['AMD Ryzen 7 7800X3D', 'amd-ryzen-7-7800x3d', 'Процессор AMD Ryzen 7 7800X3D', 44990, 1, 12],
            ['NVIDIA RTX 4090', 'nvidia-rtx-4090', 'Видеокарта NVIDIA GeForce RTX 4090', 189990, 2, 8],
            ['AMD Radeon RX 7900 XTX', 'amd-radeon-rx-7900-xtx', 'Видеокарта AMD Radeon RX 7900 XTX', 119990, 2, 10],
            ['ASUS ROG Strix Z790', 'asus-rog-strix-z790', 'Материнская плата ASUS ROG Strix Z790', 34990, 3, 20],
            ['G.Skill Trident Z5 RGB', 'gskill-trident-z5-rgb', 'Оперативная память G.Skill Trident Z5 RGB 32GB', 12990, 4, 25],
            ['Samsung 980 Pro 2TB', 'samsung-980-pro-2tb', 'SSD накопитель Samsung 980 Pro 2TB', 15990, 5, 30],
            ['Corsair RM850x', 'corsair-rm850x', 'Блок питания Corsair RM850x 850W', 12990, 6, 18],
            ['NZXT H9 Elite', 'nzxt-h9-elite', 'Корпус NZXT H9 Elite', 24990, 7, 12],
            ['NZXT Kraken 360', 'nzxt-kraken-360', 'Система охлаждения NZXT Kraken 360', 15990, 8, 15]
        ];
        
        for (const [name, slug, description, price, category_id, stock] of products) {
            const exists = await database.get('SELECT id FROM products WHERE slug = ?', [slug]);
            if (!exists) {
                await database.run(
                    `INSERT INTO products (name, slug, description, price, category_id, stock) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [name, slug, description, price, category_id, stock]
                );
            }
        }
        
        console.log('Тестовые данные добавлены успешно!');
    } catch (error) {
        console.log('Ошибка при добавлении тестовых данных:', error.message);
    }
}

module.exports = initDatabase;