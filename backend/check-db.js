const db = require('./config/database');

async function checkDatabase() {
    console.log('🔍 Проверка базы данных...\n');
    
    try {
        // Проверяем таблицы
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        console.log('📋 Таблицы в базе:');
        tables.forEach(table => console.log(`  - ${table.name}`));
        
        console.log('\n📊 Содержимое таблиц:');
        
        // Категории
        const categories = await db.all("SELECT * FROM categories");
        console.log(`\n📁 Категории (${categories.length}):`);
        categories.forEach(cat => {
            console.log(`  ${cat.id}. ${cat.name} (${cat.slug}) - ${cat.description}`);
        });
        
        // Товары
        const products = await db.all("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id");
        console.log(`\n🛒 Товары (${products.length}):`);
        products.forEach(product => {
            console.log(`  ${product.id}. ${product.name} - ${product.price} руб. (${product.category_name})`);
        });
        
        // Пользователи
        const users = await db.all("SELECT id, username, email, role FROM users");
        console.log(`\n👥 Пользователи (${users.length}):`);
        users.forEach(user => {
            console.log(`  ${user.id}. ${user.username} (${user.email}) - ${user.role}`);
        });
        
        console.log('\n✅ Проверка завершена');
        
    } catch (error) {
        console.error('❌ Ошибка при проверке базы:', error);
    }
    
    // Не закрываем базу, так как сервер использует её
    console.log('\n🚀 База данных готова к использованию!');
}

checkDatabase();