// Конфигурация
const API_URL = 'http://localhost:5000/api';

// Глобальное состояние
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentFilter = 'all';

// Иконки для категорий
const categoryIcons = {
    'cpu': 'microchip',
    'gpu': 'gamepad',
    'motherboard': 'microchip',
    'ram': 'memory',
    'ssd': 'hdd',
    'hdd': 'hdd',
    'psu': 'bolt',
    'case': 'box',
    'cooling': 'fan',
    'default': 'microchip'
};

// Иконки для брендов
const brandIcons = {
    'Intel': 'microchip',
    'AMD': 'microchip',
    'NVIDIA': 'gamepad',
    'ASUS': 'desktop',
    'MSI': 'desktop',
    'Gigabyte': 'desktop',
    'Kingston': 'memory',
    'Corsair': 'memory',
    'Samsung': 'hdd',
    'WD': 'hdd',
    'Seagate': 'hdd',
    'be quiet!': 'fan',
    'NZXT': 'box',
    'Cooler Master': 'fan'
};

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

// Основная инициализация
function initApp() {
    updateCartCount();
    loadCategories();
    loadProducts();
    setupEventListeners();
    
    console.log('✅ Приложение запущено');
}

// Категории товаров
const categories = [
    {
        name: 'Процессоры',
        slug: 'cpu',
        icon: 'microchip',
        color: '#3b82f6',
        count: 8
    },
    {
        name: 'Видеокарты',
        slug: 'gpu',
        icon: 'gamepad',
        color: '#8b5cf6',
        count: 6
    },
    {
        name: 'Материнские платы',
        slug: 'motherboard',
        icon: 'microchip',
        color: '#10b981',
        count: 12
    },
    {
        name: 'Оперативная память',
        slug: 'ram',
        icon: 'memory',
        color: '#f59e0b',
        count: 15
    },
    {
        name: 'SSD накопители',
        slug: 'ssd',
        icon: 'hdd',
        color: '#ef4444',
        count: 10
    },
    {
        name: 'Блоки питания',
        slug: 'psu',
        icon: 'bolt',
        color: '#6366f1',
        count: 7
    },
    {
        name: 'Корпуса',
        slug: 'case',
        icon: 'box',
        color: '#ec4899',
        count: 9
    },
    {
        name: 'Охлаждение',
        slug: 'cooling',
        icon: 'fan',
        color: '#14b8a6',
        count: 5
    }
];

// Загрузка категорий
function loadCategories() {
    const container = document.getElementById('categoriesList');
    if (!container) return;
    
    const categoriesHtml = categories.map(category => `
        <a href="catalog.html?category=${category.slug}" class="category-card">
            <div class="category-icon" style="background: ${category.color}">
                <i class="fas fa-${category.icon}"></i>
            </div>
            <h3>${category.name}</h3>
            <p class="category-count">${category.count} товаров</p>
        </a>
    `).join('');
    
    container.innerHTML = categoriesHtml;
}

// Демо-товары (20+ товаров)
const demoProducts = [
    // Процессоры
    {
        id: 1,
        name: 'Intel Core i5-12400F',
        slug: 'intel-core-i5-12400f',
        description: 'Процессор для игр и работы',
        specs: {
            'Ядра': '6 ядер',
            'Потоки': '12 потоков',
            'Частота': '2.5-4.4 ГГц',
            'Сокет': 'LGA 1700',
            'TDP': '65W'
        },
        price: 18990,
        old_price: 21990,
        category: 'Процессоры',
        category_slug: 'cpu',
        stock: 15,
        brand: 'Intel',
        icon: 'microchip'
    },
    {
        id: 2,
        name: 'AMD Ryzen 5 5600X',
        slug: 'amd-ryzen-5-5600x',
        description: 'Игровой процессор AMD',
        specs: {
            'Ядра': '6 ядер',
            'Потоки': '12 потоков',
            'Частота': '3.7-4.6 ГГц',
            'Сокет': 'AM4',
            'TDP': '65W'
        },
        price: 19990,
        category: 'Процессоры',
        category_slug: 'cpu',
        stock: 10,
        brand: 'AMD',
        icon: 'microchip'
    },
    {
        id: 3,
        name: 'Intel Core i7-13700K',
        slug: 'intel-core-i7-13700k',
        description: 'Мощный процессор для творчества',
        specs: {
            'Ядра': '16 ядер',
            'Потоки': '24 потока',
            'Частота': '3.4-5.4 ГГц',
            'Сокет': 'LGA 1700',
            'TDP': '125W'
        },
        price: 42990,
        category: 'Процессоры',
        category_slug: 'cpu',
        stock: 5,
        brand: 'Intel',
        icon: 'microchip'
    },
    {
        id: 4,
        name: 'AMD Ryzen 7 7800X3D',
        slug: 'amd-ryzen-7-7800x3d',
        description: 'Игровой процессор с 3D V-Cache',
        specs: {
            'Ядра': '8 ядер',
            'Потоки': '16 потоков',
            'Частота': '4.2-5.0 ГГц',
            'Сокет': 'AM5',
            'Кэш': '96 МБ'
        },
        price: 39990,
        category: 'Процессоры',
        category_slug: 'cpu',
        stock: 4,
        brand: 'AMD',
        icon: 'microchip'
    },
    
    // Видеокарты
    {
        id: 5,
        name: 'NVIDIA RTX 4060 Ti',
        slug: 'nvidia-rtx-4060-ti',
        description: 'Видеокарта для игр в 1440p',
        specs: {
            'Память': '8GB GDDR6',
            'Шина': '128-bit',
            'Порты': '3x DP, 1x HDMI',
            'Рекомендуемый БП': '550W'
        },
        price: 45990,
        old_price: 49990,
        category: 'Видеокарты',
        category_slug: 'gpu',
        stock: 8,
        brand: 'NVIDIA',
        icon: 'gamepad'
    },
    {
        id: 6,
        name: 'AMD Radeon RX 7800 XT',
        slug: 'amd-radeon-rx-7800-xt',
        description: 'Видеокарта AMD для 1440p игр',
        specs: {
            'Память': '16GB GDDR6',
            'Шина': '256-bit',
            'Порты': '2x DP, 2x HDMI',
            'Рекомендуемый БП': '700W'
        },
        price: 51990,
        category: 'Видеокарты',
        category_slug: 'gpu',
        stock: 6,
        brand: 'AMD',
        icon: 'gamepad'
    },
    {
        id: 7,
        name: 'ASUS TUF RTX 4070',
        slug: 'asus-tuf-rtx-4070',
        description: 'Надежная видеокарта от ASUS',
        specs: {
            'Память': '12GB GDDR6X',
            'Шина': '192-bit',
            'Порты': '3x DP, 1x HDMI',
            'Охлаждение': '3 вентилятора'
        },
        price: 69990,
        category: 'Видеокарты',
        category_slug: 'gpu',
        stock: 4,
        brand: 'ASUS',
        icon: 'gamepad'
    },
    {
        id: 8,
        name: 'Gigabyte RX 7600',
        slug: 'gigabyte-rx-7600',
        description: 'Бюджетная видеокарта для 1080p',
        specs: {
            'Память': '8GB GDDR6',
            'Шина': '128-bit',
            'Порты': '2x DP, 2x HDMI',
            'Длина': '282мм'
        },
        price: 28990,
        category: 'Видеокарты',
        category_slug: 'gpu',
        stock: 12,
        brand: 'Gigabyte',
        icon: 'gamepad'
    },
    
    // Оперативная память
    {
        id: 9,
        name: 'Kingston Fury 32GB DDR5',
        slug: 'kingston-fury-32gb-ddr5',
        description: 'Высокоскоростная память DDR5',
        specs: {
            'Объем': '32GB (2x16GB)',
            'Частота': '6000MHz',
            'Тайминги': 'CL36',
            'Напряжение': '1.35V'
        },
        price: 12990,
        category: 'Оперативная память',
        category_slug: 'ram',
        stock: 15,
        brand: 'Kingston',
        icon: 'memory'
    },
    {
        id: 10,
        name: 'Corsair Vengeance 64GB DDR4',
        slug: 'corsair-vengeance-64gb-ddr4',
        description: 'Память для профессиональной работы',
        specs: {
            'Объем': '64GB (2x32GB)',
            'Частота': '3600MHz',
            'Тайминги': 'CL18',
            'RGB': 'Да'
        },
        price: 18990,
        category: 'Оперативная память',
        category_slug: 'ram',
        stock: 7,
        brand: 'Corsair',
        icon: 'memory'
    },
    {
        id: 11,
        name: 'G.Skill Trident Z5 32GB DDR5',
        slug: 'gskill-trident-z5-32gb-ddr5',
        description: 'RGB память для геймеров',
        specs: {
            'Объем': '32GB (2x16GB)',
            'Частота': '6400MHz',
            'Тайминги': 'CL32',
            'RGB': 'ARGB'
        },
        price: 16990,
        category: 'Оперативная память',
        category_slug: 'ram',
        stock: 3,
        brand: 'G.Skill',
        icon: 'memory'
    },
    
    // SSD накопители
    {
        id: 12,
        name: 'Samsung 990 Pro 2TB',
        slug: 'samsung-990-pro-2tb',
        description: 'Высокоскоростной SSD NVMe',
        specs: {
            'Объем': '2TB',
            'Интерфейс': 'PCIe 4.0',
            'Чтение': '7450 МБ/с',
            'Запись': '6900 МБ/с'
        },
        price: 15990,
        category: 'SSD накопители',
        category_slug: 'ssd',
        stock: 8,
        brand: 'Samsung',
        icon: 'hdd'
    },
    {
        id: 13,
        name: 'WD Black SN850X 1TB',
        slug: 'wd-black-sn850x-1tb',
        description: 'Игровой SSD с кэшем',
        specs: {
            'Объем': '1TB',
            'Интерфейс': 'PCIe 4.0',
            'Чтение': '7300 МБ/с',
            'Гарантия': '5 лет'
        },
        price: 8990,
        category: 'SSD накопители',
        category_slug: 'ssd',
        stock: 15,
        brand: 'WD',
        icon: 'hdd'
    },
    {
        id: 14,
        name: 'Crucial P5 Plus 2TB',
        slug: 'crucial-p5-plus-2tb',
        description: 'Надежный SSD для ПК',
        specs: {
            'Объем': '2TB',
            'Интерфейс': 'PCIe 4.0',
            'Чтение': '6600 МБ/с',
            'MTBF': '1.8 млн часов'
        },
        price: 12990,
        category: 'SSD накопители',
        category_slug: 'ssd',
        stock: 10,
        brand: 'Crucial',
        icon: 'hdd'
    },
    
    // Материнские платы
    {
        id: 15,
        name: 'ASUS ROG Strix B760-F',
        slug: 'asus-rog-strix-b760-f',
        description: 'Игровая материнская плата',
        specs: {
            'Сокет': 'LGA 1700',
            'Чипсет': 'B760',
            'Память': '4 слота DDR5',
            'M.2': '3 слота'
        },
        price: 22990,
        category: 'Материнские платы',
        category_slug: 'motherboard',
        stock: 9,
        brand: 'ASUS',
        icon: 'microchip'
    },
    {
        id: 16,
        name: 'MSI MAG B650 Tomahawk',
        slug: 'msi-mag-b650-tomahawk',
        description: 'Плата для процессоров AMD',
        specs: {
            'Сокет': 'AM5',
            'Чипсет': 'B650',
            'Память': '4 слота DDR5',
            'Wi-Fi': 'Wi-Fi 6E'
        },
        price: 21990,
        category: 'Материнские платы',
        category_slug: 'motherboard',
        stock: 6,
        brand: 'MSI',
        icon: 'microchip'
    },
    {
        id: 17,
        name: 'Gigabyte Z790 AORUS Elite',
        slug: 'gigabyte-z790-aorus-elite',
        description: 'Плата для разгона',
        specs: {
            'Сокет': 'LGA 1700',
            'Чипсет': 'Z790',
            'Память': '4 слота DDR5',
            'VRM': '16+1+2 фаз'
        },
        price: 28990,
        category: 'Материнские платы',
        category_slug: 'motherboard',
        stock: 4,
        brand: 'Gigabyte',
        icon: 'microchip'
    },
    
    // Блоки питания
    {
        id: 18,
        name: 'Corsair RM1000x',
        slug: 'corsair-rm1000x',
        description: 'Модульный блок питания 1000W',
        specs: {
            'Мощность': '1000W',
            'Сертификат': '80+ Gold',
            'Модульный': 'Полностью',
            'Вентилятор': '140мм'
        },
        price: 16990,
        category: 'Блоки питания',
        category_slug: 'psu',
        stock: 11,
        brand: 'Corsair',
        icon: 'bolt'
    },
    {
        id: 19,
        name: 'be quiet! Straight Power 12',
        slug: 'be-quiet-straight-power-12',
        description: 'Тихий блок питания 850W',
        specs: {
            'Мощность': '850W',
            'Сертификат': '80+ Platinum',
            'Модульный': 'Полностью',
            'Гарантия': '10 лет'
        },
        price: 14990,
        category: 'Блоки питания',
        category_slug: 'psu',
        stock: 4,
        brand: 'be quiet!',
        icon: 'bolt'
    },
    
    // Корпуса
    {
        id: 20,
        name: 'NZXT H9 Flow',
        slug: 'nzxt-h9-flow',
        description: 'Корпус с панорамным стеклом',
        specs: {
            'Форм-фактор': 'Mid-Tower',
            'Материал': 'Сталь, стекло',
            'Вентиляторы': '3 в комплекте',
            'Поддержка': 'ATX, E-ATX'
        },
        price: 14990,
        category: 'Корпуса',
        category_slug: 'case',
        stock: 8,
        brand: 'NZXT',
        icon: 'box'
    },
    {
        id: 21,
        name: 'Lian Li O11 Dynamic',
        slug: 'lian-li-o11-dynamic',
        description: 'Корпус для сборок с водяным охлаждением',
        specs: {
            'Форм-фактор': 'Mid-Tower',
            'Материал': 'Алюминий, стекло',
            'Слоты': '8 слотов расширения',
            'Охлаждение': 'До 9 вентиляторов'
        },
        price: 17990,
        category: 'Корпуса',
        category_slug: 'case',
        stock: 5,
        brand: 'Lian Li',
        icon: 'box'
    },
    
    // Охлаждение
    {
        id: 22,
        name: 'Noctua NH-D15',
        slug: 'noctua-nh-d15',
        description: 'Легендарный башенный кулер',
        specs: {
            'Тип': 'Воздушное',
            'Высота': '165мм',
            'Вентиляторы': '2x 140мм',
            'TDP': '220W'
        },
        price: 8990,
        category: 'Охлаждение',
        category_slug: 'cooling',
        stock: 12,
        brand: 'Noctua',
        icon: 'fan'
    },
    {
        id: 23,
        name: 'Corsair iCUE H150i',
        slug: 'corsair-icue-h150i',
        description: 'Система водяного охлаждения',
        specs: {
            'Тип': 'Жидкостное AIO',
            'Радиатор': '360мм',
            'Вентиляторы': '3x 120мм',
            'RGB': 'ARGB'
        },
        price: 15990,
        category: 'Охлаждение',
        category_slug: 'cooling',
        stock: 6,
        brand: 'Corsair',
        icon: 'fan'
    }
];

// Загрузка товаров
function loadProducts() {
    const container = document.getElementById('productsList');
    if (!container) return;
    
    const filteredProducts = filterProducts(demoProducts);
    displayProducts(filteredProducts);
}

// Фильтрация товаров по категориям
function filterProducts(products) {
    if (currentFilter === 'all') return products.slice(0, 12);
    if (currentFilter === 'cpu') return products.filter(p => p.category_slug === 'cpu').slice(0, 12);
    if (currentFilter === 'gpu') return products.filter(p => p.category_slug === 'gpu').slice(0, 12);
    if (currentFilter === 'ram') return products.filter(p => p.category_slug === 'ram').slice(0, 12);
    if (currentFilter === 'ssd') return products.filter(p => p.category_slug === 'ssd').slice(0, 12);
    return products.slice(0, 12);
}

// Отображение товаров
function displayProducts(products) {
    const container = document.getElementById('productsList');
    if (!container) return;
    
    const productsHtml = products.map(product => `
        <div class="product-card">
            <div class="product-icon">
                <i class="fas fa-${product.icon || 'microchip'}"></i>
            </div>
            <div class="product-info">
                <div class="product-brand">
                    ${product.brand}
                </div>
                <h3 class="product-title">${product.name}</h3>
                <div class="product-specs">
                    ${Object.entries(product.specs || {}).map(([key, value]) => `
                        <div class="spec-item">
                            <span class="spec-label">${key}:</span>
                            <span class="spec-value">${value}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="product-price">
                    <span class="current-price">${formatPrice(product.price)} ₽</span>
                    ${product.old_price ? `<span class="old-price">${formatPrice(product.old_price)} ₽</span>` : ''}
                </div>
                <div class="product-meta">
                    <span><i class="fas fa-box"></i> ${product.stock} шт.</span>
                    <span><i class="fas fa-tag"></i> ${product.category}</span>
                </div>
                <button class="btn btn-primary" style="width: 100%; margin-top: 15px;" 
                        onclick="addToCart(${product.id}, '${product.name}', ${product.price}, '${product.brand}')">
                    <i class="fas fa-cart-plus"></i> В корзину
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = productsHtml;
}

// Вспомогательные функции
function formatPrice(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Корзина
function addToCart(productId, productName, productPrice, productBrand) {
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: productId,
            name: productName,
            brand: productBrand,
            price: productPrice,
            quantity: 1,
            icon: demoProducts.find(p => p.id === productId)?.icon || 'microchip'
        });
    }
    
    saveCart();
    updateCartCount();
    showNotification(`<strong>${productName}</strong> добавлен в корзину!`, 'success');
}

function updateCartCount() {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        const total = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = total;
        cartCount.style.display = total > 0 ? 'block' : 'none';
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Уведомления
function showNotification(message, type = 'info') {
    // Проверяем, есть ли уже уведомление
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <div>${message}</div>
    `;
    
    document.body.appendChild(notification);
    
    // Убираем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Обработчики событий
function setupEventListeners() {
    // Фильтры товаров
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadProducts();
        });
    });
    
    // Поиск
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch(this.value);
            }
        });
        
        const searchBtn = document.querySelector('.search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', function() {
                performSearch(searchInput.value);
            });
        }
    }
    
    // Мобильное меню
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', function() {
            const menu = document.querySelector('.nav-menu');
            const searchContainer = document.querySelector('.nav-actions .search-container');
            
            if (menu.style.display === 'flex') {
                menu.style.display = 'none';
                if (searchContainer) searchContainer.style.display = 'none';
            } else {
                menu.style.display = 'flex';
                menu.style.flexDirection = 'column';
                menu.style.position = 'absolute';
                menu.style.top = '100%';
                menu.style.left = '0';
                menu.style.right = '0';
                menu.style.background = 'white';
                menu.style.padding = '20px';
                menu.style.boxShadow = 'var(--shadow-lg)';
                
                if (searchContainer) {
                    searchContainer.style.display = 'block';
                    searchContainer.style.marginTop = '20px';
                }
            }
        });
    }
}

function performSearch(query) {
    if (query.trim()) {
        // Фильтруем товары по поисковому запросу
        const filtered = demoProducts.filter(product => 
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            product.description.toLowerCase().includes(query.toLowerCase()) ||
            product.brand.toLowerCase().includes(query.toLowerCase()) ||
            product.category.toLowerCase().includes(query.toLowerCase())
        );
        
        if (filtered.length > 0) {
            currentFilter = 'all';
            displayProducts(filtered.slice(0, 12));
            showNotification(`Найдено ${filtered.length} товаров по запросу "${query}"`, 'info');
        } else {
            showNotification(`По запросу "${query}" ничего не найдено`, 'error');
        }
    }
}

// Экспорт для использования в консоли
window.addToCart = addToCart;
window.showNotification = showNotification;
window.demoProducts = demoProducts; // Для отладки