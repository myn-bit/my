const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Убедимся, что папка backend существует
const backendDir = path.join(__dirname);
if (!fs.existsSync(backendDir)) {
    fs.mkdirSync(backendDir, { recursive: true });
    console.log(`📁 Создана папка: ${backendDir}`);
}

// Путь к базе данных
const dbPath = path.join(backendDir, 'database.db');
console.log(`🗃️  Путь к базе данных: ${dbPath}`);

// Подключение к SQLite
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err.message);
        console.log('🛠️  Пробую создать файл базы данных...');
        
        // Пробуем создать файл вручную
        try {
            fs.writeFileSync(dbPath, '');
            console.log(`✅ Файл базы данных создан: ${dbPath}`);
            
            // Переподключаемся
            const db = new sqlite3.Database(dbPath, (err2) => {
                if (err2) {
                    console.error('❌ Вторая попытка подключения:', err2.message);
                } else {
                    console.log('✅ Подключено к SQLite базе данных');
                    initDatabase();
                }
            });
        } catch (fileErr) {
            console.error('❌ Не удалось создать файл БД:', fileErr.message);
            
            // Пробуем альтернативный путь
            const altPath = path.join(__dirname, '..', 'database.db');
            console.log(`🔄 Пробую альтернативный путь: ${altPath}`);
            const db = new sqlite3.Database(altPath);
            console.log('✅ Подключено к альтернативной базе данных');
            initDatabase();
        }
    } else {
        console.log('✅ Подключено к SQLite базе данных');
        console.log(`📊 Файл БД: ${dbPath}`);
        initDatabase();
    }
});

// Инициализация базы данных
function initDatabase() {
    console.log('🔄 Инициализация базы данных...');
    
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы users:', err.message);
        } else {
            console.log('✅ Таблица users создана/проверена');
            
            // Добавляем администратора по умолчанию
            const adminPassword = bcrypt.hashSync('admin123', 10);
            db.run(`INSERT OR IGNORE INTO users (username, email, password, role) 
                    VALUES ('admin', 'admin@pcstore.ru', ?, 'admin')`, 
                [adminPassword],
                function(err) {
                    if (err) {
                        console.error('❌ Ошибка добавления администратора:', err.message);
                    }
                }
            );
        }
    });
    
    // Таблица категорий
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы categories:', err.message);
        } else {
            console.log('✅ Таблица categories создана/проверена');
            
            // Добавляем тестовые категории
            const categories = [
                ['Процессоры', 'processors', 'Процессоры Intel и AMD'],
                ['Видеокарты', 'video-cards', 'Видеокарты NVIDIA и AMD'],
                ['Материнские платы', 'motherboards', 'Материнские платы для ПК'],
                ['Оперативная память', 'ram', 'Оперативная память DDR4/DDR5'],
                ['Накопители', 'storage', 'SSD и HDD накопители']
            ];
            
            categories.forEach(([name, slug, description]) => {
                db.run(`INSERT OR IGNORE INTO categories (name, slug, description) 
                        VALUES (?, ?, ?)`, 
                    [name, slug, description]
                );
            });
        }
    });
    
    // Таблица товаров
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category_id INTEGER,
        stock INTEGER DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы products:', err.message);
        } else {
            console.log('✅ Таблица products создана/проверена');
            
            // Добавляем тестовые товары
            setTimeout(() => {
                db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
                    if (!err && row.count === 0) {
                        console.log('🛒 Добавляем тестовые товары...');
                        
                        const products = [
                            ['Intel Core i7-14700K', 'Процессор Intel Core i7-14700K', 39990, 1],
                            ['AMD Ryzen 7 7800X3D', 'Процессор AMD Ryzen 7 7800X3D', 44990, 1],
                            ['NVIDIA RTX 4090', 'Видеокарта NVIDIA GeForce RTX 4090', 189990, 2],
                            ['AMD Radeon RX 7900 XTX', 'Видеокарта AMD Radeon RX 7900 XTX', 119990, 2],
                            ['ASUS ROG Strix Z790', 'Материнская плата ASUS ROG Strix Z790', 34990, 3],
                            ['G.Skill Trident Z5 RGB', 'Оперативная память G.Skill Trident Z5 RGB', 12990, 4],
                            ['Samsung 980 Pro 2TB', 'SSD накопитель Samsung 980 Pro 2TB', 15990, 5]
                        ];
                        
                        products.forEach(([name, description, price, category_id]) => {
                            db.run(`INSERT INTO products (name, description, price, category_id) 
                                    VALUES (?, ?, ?, ?)`, 
                                [name, description, price, category_id]
                            );
                        });
                        console.log('✅ Тестовые товары добавлены');
                    }
                });
            }, 1000);
        }
    });
}

// ========== API ЭНДПОИНТЫ ==========

// Тестовый endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: '✅ Сервер работает!', 
        timestamp: new Date().toISOString(),
        database: 'SQLite',
        port: PORT
    });
});

// Проверка базы данных
app.get('/api/test-db', (req, res) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('❌ Ошибка проверки БД:', err.message);
            res.status(500).json({ 
                success: false, 
                error: err.message,
                path: dbPath 
            });
        } else {
            res.json({ 
                success: true, 
                tables: tables.map(t => t.name),
                database_path: dbPath,
                count: tables.length
            });
        }
    });
});

// Получить все категории
app.get('/api/categories', (req, res) => {
    const query = `
        SELECT c.*, 
               (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
        FROM categories c
        ORDER BY c.name
    `;
    
    db.all(query, [], (err, categories) => {
        if (err) {
            console.error('❌ Ошибка получения категорий:', err.message);
            res.status(500).json({ error: 'Ошибка сервера' });
        } else {
            res.json(categories);
        }
    });
});

// Получить товары
app.get('/api/products', (req, res) => {
    const { category = 'all', search = '' } = req.query;
    
    let query = `
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1
    `;
    
    const params = [];
    
    if (category && category !== 'all') {
        query += ' AND c.slug = ?';
        params.push(category);
    }
    
    if (search) {
        query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    db.all(query, params, (err, products) => {
        if (err) {
            console.error('❌ Ошибка получения товаров:', err.message);
            res.status(500).json({ error: 'Ошибка сервера' });
        } else {
            res.json({
                products: products,
                total: products.length
            });
        }
    });
});

// Регистрация
app.post('/api/register', (req, res) => {
    console.log('📝 Запрос на регистрацию');
    
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Все поля обязательны' 
        });
    }
    
    // Хешируем пароль
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Сохраняем в SQLite
    db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, 
        [username, email, hashedPassword], 
        function(err) {
            if (err) {
                console.error('❌ Ошибка регистрации:', err.message);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Пользователь уже существует' 
                    });
                }
                return res.status(500).json({ 
                    success: false, 
                    message: 'Ошибка базы данных' 
                });
            }
            
            console.log(`✅ Пользователь зарегистрирован: ${email}`);
            
            res.json({
                success: true,
                message: 'Регистрация успешна!',
                user: {
                    id: this.lastID,
                    username: username,
                    email: email,
                    role: 'user'
                }
            });
        }
    );
});

// Вход
app.post('/api/login', (req, res) => {
    console.log('🔐 Запрос на вход');
    
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email и пароль обязательны' 
        });
    }
    
    // Ищем в SQLite
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) {
            console.error('❌ Ошибка при входе:', err.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Ошибка сервера' 
            });
        }
        
        if (!user) {
            console.log('❌ Пользователь не найден');
            return res.status(401).json({ 
                success: false, 
                message: 'Неверный email или пароль' 
            });
        }
        
        // Проверяем пароль
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            console.log('❌ Неверный пароль');
            return res.status(401).json({ 
                success: false, 
                message: 'Неверный email или пароль' 
            });
        }
        
        console.log(`✅ Успешный вход: ${user.username}`);
        
        res.json({
            success: true,
            message: 'Вход выполнен!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    });
});

// Обработка 404
app.use((req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'Страница не найдена' 
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
===================================================
🚀 Сервер успешно запущен!
===================================================
📍 URL: http://localhost:${PORT}
🗃️  База данных: ${dbPath}

📡 API эндпоинты:
   • Тест сервера:    http://localhost:${PORT}/api/test
   • Проверка БД:     http://localhost:${PORT}/api/test-db
   • Категории:       http://localhost:${PORT}/api/categories
   • Товары:          http://localhost:${PORT}/api/products
   • Регистрация:     POST http://localhost:${PORT}/api/register
   • Вход:            POST http://localhost:${PORT}/api/login

📁 Страницы:
   • Главная:        http://localhost:${PORT}/index.html
   • Каталог:        http://localhost:${PORT}/catalog.html
   • Админ-панель:   http://localhost:${PORT}/admin.html
   • Вход:           http://localhost:${PORT}/login.html
   • Регистрация:    http://localhost:${PORT}/register.html
===================================================
`);
});