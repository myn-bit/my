// Конфигурация API
const API_BASE_URL = 'http://localhost:3001/api';
let currentUser = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Профиль: инициализация...');
    
    // Проверяем аутентификацию
    await checkAuth();
    
    // Загружаем данные профиля
    await loadProfileData();
    
    // Загружаем заказы
    await loadOrders();
    
    // Загружаем избранное
    await loadFavorites();
});

// Проверка аутентификации
async function checkAuth() {
    const token = getToken();
    
    if (!token) {
        console.log('Токен не найден, перенаправляем на страницу входа');
        window.location.href = '/login.html';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            console.log('Токен невалиден, перенаправляем на страницу входа');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
            return;
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        // Сохраняем пользователя в localStorage для быстрого доступа
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        userData.user = currentUser;
        localStorage.setItem('user', JSON.stringify(userData));
        
        console.log('Пользователь авторизован:', currentUser);
        
    } catch (error) {
        console.error('Ошибка проверки аутентификации:', error);
        showError('Ошибка проверки авторизации');
    }
}

// Получение токена из localStorage
function getToken() {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    return userData.token || userData.user?.token;
}

// Загрузка данных профиля
async function loadProfileData() {
    try {
        const token = getToken();
        
        const response = await fetch(`${API_BASE_URL}/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки профиля');
        }
        
        const data = await response.json();
        const user = data.user;
        
        // Обновляем данные на странице
        updateProfileUI(user);
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        showError('Не удалось загрузить данные профиля');
    }
}

// Обновление UI профиля
function updateProfileUI(user) {
    // Аватарки
    const firstLetter = user.username ? user.username.charAt(0).toUpperCase() : 'U';
    document.getElementById('userAvatar').textContent = firstLetter;
    document.getElementById('avatarLarge').textContent = firstLetter;
    
    // Основная информация
    document.getElementById('userName').textContent = user.username || 'Пользователь';
    document.getElementById('userEmail').textContent = user.email || 'user@example.com';
    
    // Роль пользователя
    const roleElement = document.getElementById('userRole');
    roleElement.textContent = user.role || 'user';
    roleElement.className = 'user-role ' + (user.role || 'user');
    
    // Детали профиля
    document.getElementById('detailUsername').textContent = user.username || 'user123';
    document.getElementById('detailEmail').textContent = user.email || 'user@example.com';
    document.getElementById('detailRole').textContent = getRoleName(user.role);
    document.getElementById('detailUserId').textContent = user.id || '1';
    
    // Дата регистрации
    if (user.created_at) {
        const date = new Date(user.created_at);
        document.getElementById('registrationDate').textContent = 
            date.toLocaleDateString('ru-RU');
    }
    
    // Заполняем форму редактирования
    document.getElementById('editUsername').value = user.username || '';
    document.getElementById('editEmail').value = user.email || '';
}

// Загрузка заказов
async function loadOrders() {
    try {
        const token = getToken();
        
        const response = await fetch(`${API_BASE_URL}/orders/my`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки заказов');
        }
        
        const data = await response.json();
        displayOrders(data.orders || []);
        
        // Обновляем счетчик заказов
        document.getElementById('ordersCount').textContent = data.orders?.length || 0;
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        document.getElementById('orders-content').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Ошибка загрузки заказов</h3>
                <p>Попробуйте обновить страницу</p>
            </div>
        `;
    }
}

// Отображение заказов
function displayOrders(orders) {
    const ordersContent = document.getElementById('orders-content');
    
    if (!orders || orders.length === 0) {
        ordersContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-bag"></i>
                <h3>Заказов пока нет</h3>
                <p>Совершите свою первую покупку!</p>
                <a href="/products.html" class="btn btn-primary" style="margin-top: 15px;">
                    Перейти в магазин
                </a>
            </div>
        `;
        return;
    }
    
    let html = `
        <table class="orders-table">
            <thead>
                <tr>
                    <th>Номер заказа</th>
                    <th>Дата</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    orders.forEach(order => {
        const orderDate = new Date(order.created_at).toLocaleDateString('ru-RU');
        const orderNumber = order.order_number || `ORD-${String(order.id).padStart(6, '0')}`;
        const statusText = getStatusText(order.status);
        const statusClass = getStatusClass(order.status);
        
        html += `
            <tr>
                <td>${orderNumber}</td>
                <td>${orderDate}</td>
                <td>${formatPrice(order.total_amount || 0)} ₽</td>
                <td><span class="order-status ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewOrder(${order.id})">
                        <i class="fas fa-eye"></i> Подробнее
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    ordersContent.innerHTML = html;
}

// Загрузка избранного
async function loadFavorites() {
    try {
        const token = getToken();
        
        const response = await fetch(`${API_BASE_URL}/favorites`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки избранного');
        }
        
        const data = await response.json();
        displayFavorites(data.favorites || []);
        
        // Обновляем счетчик избранного
        document.getElementById('favoritesCount').textContent = data.favorites?.length || 0;
        
    } catch (error) {
        console.error('Ошибка загрузки избранного:', error);
        document.getElementById('favorites-content').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Ошибка загрузки избранного</h3>
                <p>Попробуйте обновить страницу</p>
            </div>
        `;
    }
}

// Отображение избранного
function displayFavorites(favorites) {
    const favoritesContent = document.getElementById('favorites-content');
    
    if (!favorites || favorites.length === 0) {
        favoritesContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heart"></i>
                <h3>Избранное пусто</h3>
                <p>Добавляйте товары в избранное, чтобы не потерять</p>
                <a href="/products.html" class="btn btn-primary" style="margin-top: 15px;">
                    Перейти в магазин
                </a>
            </div>
        `;
        return;
    }
    
    let html = '<div class="favorites-grid">';
    
    favorites.forEach(product => {
        html += `
            <div class="favorite-card">
                <img src="${product.image_url || 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'}" 
                     alt="${product.name}">
                <div class="favorite-card-content">
                    <h3 class="favorite-card-title">${product.name}</h3>
                    <p class="favorite-card-price">${formatPrice(product.price)} ₽</p>
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button class="btn btn-sm btn-primary" onclick="goToProduct(${product.id})">
                            <i class="fas fa-shopping-cart"></i> Купить
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="removeFromFavorites(${product.id})">
                            <i class="fas fa-trash"></i> Удалить
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    favoritesContent.innerHTML = html;
}

// Управление вкладками
function showTab(tabName) {
    // Обновляем активную вкладку в меню
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`.sidebar-menu a[href="#${tabName}"]`).classList.add('active');
    
    // Обновляем активную вкладку в заголовке
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });
    
    // Показываем соответствующий контент
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Модальное окно редактирования профиля
function openEditModal() {
    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

// Сохранение профиля
async function saveProfile() {
    const username = document.getElementById('editUsername').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    
    if (!username || !email) {
        showError('Заполните все поля');
        return;
    }
    
    try {
        const token = getToken();
        
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Ошибка обновления профиля');
        }
        
        const data = await response.json();
        
        // Обновляем данные на странице
        await loadProfileData();
        
        // Закрываем модальное окно
        closeEditModal();
        
        // Показываем успешное сообщение
        showSuccess('Профиль успешно обновлен');
        
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        showError(error.message || 'Ошибка обновления профиля');
    }
}

// Выход из системы
function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
}

// Удаление аккаунта
function showDeleteModal() {
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    document.getElementById('confirmPassword').value = '';
}

async function deleteAccount() {
    const password = document.getElementById('confirmPassword').value.trim();
    
    if (!password) {
        showError('Введите пароль для подтверждения');
        return;
    }
    
    if (!confirm('ВНИМАНИЕ! Это действие необратимо. Все ваши данные будут удалены. Продолжить?')) {
        return;
    }
    
    try {
        const token = getToken();
        
        // В вашем API нет эндпоинта для удаления аккаунта пользователем
        // Поэтому просто показываем сообщение
        showError('Функция удаления аккаунта временно недоступна');
        closeDeleteModal();
        
        // В реальном приложении здесь будет запрос к API:
        /*
        const response = await fetch(`${API_BASE_URL}/profile/delete`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка удаления аккаунта');
        }
        
        localStorage.removeItem('user');
        window.location.href = '/';
        */
        
    } catch (error) {
        console.error('Ошибка удаления аккаунта:', error);
        showError(error.message || 'Ошибка удаления аккаунта');
    }
}

// Вспомогательные функции
function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price);
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Ожидает',
        'processing': 'В обработке',
        'shipped': 'Отправлен',
        'delivered': 'Доставлен',
        'cancelled': 'Отменен'
    };
    return statusMap[status] || status;
}

function getStatusClass(status) {
    const classMap = {
        'pending': 'status-pending',
        'processing': 'status-processing',
        'shipped': 'status-shipped',
        'delivered': 'status-delivered',
        'cancelled': 'status-cancelled'
    };
    return classMap[status] || 'status-pending';
}

function getRoleName(role) {
    const roleMap = {
        'user': 'Пользователь',
        'admin': 'Администратор',
        'moderator': 'Модератор'
    };
    return roleMap[role] || role;
}

function viewOrder(orderId) {
    alert(`Просмотр заказа #${orderId}\nВ реальном приложении здесь будет страница с деталями заказа`);
    // window.location.href = `/order.html?id=${orderId}`;
}

function goToProduct(productId) {
    window.location.href = `/product.html?id=${productId}`;
}

async function removeFromFavorites(productId) {
    try {
        const token = getToken();
        
        const response = await fetch(`${API_BASE_URL}/favorites/remove`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productId })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка удаления из избранного');
        }
        
        // Обновляем список избранного
        await loadFavorites();
        showSuccess('Товар удален из избранного');
        
    } catch (error) {
        console.error('Ошибка удаления из избранного:', error);
        showError('Ошибка удаления из избранного');
    }
}

function refreshOrders() {
    const content = document.getElementById('orders-content');
    content.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner"></i>
            <p>Загрузка заказов...</p>
        </div>
    `;
    setTimeout(() => loadOrders(), 500);
}

function refreshFavorites() {
    const content = document.getElementById('favorites-content');
    content.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner"></i>
            <p>Загрузка избранного...</p>
        </div>
    `;
    setTimeout(() => loadFavorites(), 500);
}

// Уведомления
function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: ${type === 'error' ? '#fee2e2' : type === 'success' ? '#d1fae5' : '#dbeafe'}; 
                     color: ${type === 'error' ? '#991b1b' : type === 'success' ? '#065f46' : '#1e40af'}; 
                     padding: 15px 20px; border-radius: 8px; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); 
                     display: flex; align-items: center; gap: 10px; max-width: 400px;">
            <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем уведомление через 5 секунд
    setTimeout(() => {
        notification.remove();
    }, 5000);
}