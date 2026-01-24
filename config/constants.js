// Константы проекта

module.exports = {
    // Статусы заказов
    ORDER_STATUS: {
        PENDING: 'pending',
        PROCESSING: 'processing',
        SHIPPED: 'shipped',
        DELIVERED: 'delivered',
        CANCELLED: 'cancelled'
    },
    
    // Категории товаров
    PRODUCT_CATEGORIES: {
        CPU: 'cpu',
        GPU: 'gpu',
        MOTHERBOARD: 'motherboard',
        RAM: 'ram',
        STORAGE: 'storage',
        PSU: 'psu',
        COOLING: 'cooling',
        CASE: 'case'
    },
    
    // Роли пользователей
    USER_ROLES: {
        CUSTOMER: 'customer',
        ADMIN: 'admin',
        MODERATOR: 'moderator'
    },
    
    // Настройки пагинации
    PAGINATION: {
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100
    },
    
    // Настройки корзины
    CART: {
        MAX_ITEMS: 50,
        SESSION_TIMEOUT: 24 * 60 * 60 * 1000 // 24 часа
    },
    
    // Настройки изображений
    IMAGES: {
        ALLOWED_FORMATS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        MAX_SIZE: 5 * 1024 * 1024, // 5MB
        UPLOAD_PATH: 'uploads/products/'
    },
    
    // Настройки email
    EMAIL: {
        FROM: 'noreply@pcstore.ru',
        SUPPORT: 'support@pcstore.ru',
        ORDER_CONFIRMATION_SUBJECT: 'Подтверждение заказа PC Store'
    },
    
    // Настройки платежей
    PAYMENT: {
        CURRENCY: 'RUB',
        TAX_RATE: 0.20, // 20% НДС
        SHIPPING_COST: 500 // Стоимость доставки
    },
    
    // Настройки SEO
    SEO: {
        SITE_NAME: 'PC Store',
        DEFAULT_TITLE: 'PC Store - Интернет-магазин компьютерных комплектующих',
        DEFAULT_DESCRIPTION: 'Собери свой идеальный ПК. Большой выбор компьютерных комплектующих, аксессуаров и готовых сборок.',
        KEYWORDS: 'компьютерные комплектующие, сборка пк, видеокарты, процессоры, купить компьютер'
    },
    
    // API версия
    API_VERSION: 'v1',
    
    // Пути
    PATHS: {
        UPLOADS: 'public/uploads/',
        LOGS: 'logs/'
    }
};