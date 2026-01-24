// JavaScript для админ панели

// Проверка авторизации
function checkAuth() {
    const token = localStorage.getItem('adminToken');
    if (!token && !window.location.href.includes('index.html')) {
        window.location.href = 'index.html';
    }
}

// Выход из системы
function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'index.html';
}

// Загрузка статистики для дашборда
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        const stats = await response.json();
        
        document.getElementById('total-orders').textContent = stats.totalOrders;
        document.getElementById('total-products').textContent = stats.totalProducts;
        document.getElementById('total-revenue').textContent = stats.totalRevenue + ' руб.';
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка товаров для управления
async function loadAdminProducts() {
    try {
        const response = await fetch('/api/products', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        const products = await response.json();
        
        const tbody = document.querySelector('#products-table tbody');
        tbody.innerHTML = '';
        
        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>${product.price} руб.</td>
                <td>${product.stock}</td>
                <td>
                    <button onclick="editProduct(${product.id})">Изменить</button>
                    <button onclick="deleteProduct(${product.id})">Удалить</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
    }
}

// Загрузка заказов
async function loadAdminOrders() {
    try {
        const response = await fetch('/api/orders', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        const orders = await response.json();
        
        const tbody = document.querySelector('#orders-table tbody');
        tbody.innerHTML = '';
        
        orders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.id}</td>
                <td>${order.customer_name || 'Гость'}</td>
                <td>${order.total} руб.</td>
                <td>${order.status}</td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td>
                    <button onclick="viewOrder(${order.id})">Просмотр</button>
                    <select onchange="updateOrderStatus(${order.id}, this.value)">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Ожидание</option>
                        <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>В обработке</option>
                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Отправлен</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Доставлен</option>
                    </select>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
    }
}

// Инициализация страницы
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    
    if (window.location.pathname.includes('dashboard.html')) {
        loadDashboardStats();
    } else if (window.location.pathname.includes('products.html')) {
        loadAdminProducts();
    } else if (window.location.pathname.includes('orders.html')) {
        loadAdminOrders();
    }
});