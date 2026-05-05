// admin-orders.js - Интеграция заказов с админ-панелью

// Функция для обновления таблицы заказов в админ-панели
function updateOrdersTable() {
    console.log('🔄 Обновление таблицы заказов в админ-панели');
    
    // Получаем токен администратора
    const token = localStorage.getItem('admin_auth_token');
    
    if (!token) {
        console.log('❌ Токен администратора не найден');
        return;
    }
    
    // Запрашиваем список заказов с сервера
    fetch('http://localhost:3001/api/admin/orders', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.orders) {
            console.log(`✅ Получено ${data.orders.length} заказов`);
            renderOrdersTable(data.orders);
            updateOrderStats(data.orders);
        } else {
            console.error('❌ Ошибка получения заказов:', data.message);
        }
    })
    .catch(error => {
        console.error('❌ Ошибка соединения:', error);
    });
}

// Функция для отображения таблицы заказов
function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    
    if (!tbody) {
        console.log('❌ Таблица заказов не найдена в DOM');
        return;
    }
    
    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <div style="opacity: 0.5;">
                        <i class="fas fa-shopping-bag" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>Заказы не найдены</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Сортируем заказы по дате (новые сначала)
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    tbody.innerHTML = orders.map((order, index) => {
        const statusText = getOrderStatusText(order.status);
        const statusClass = getOrderStatusClass(order.status);
        const formattedDate = order.created_at ? 
            new Date(order.created_at).toLocaleDateString('ru-RU') : 
            'Не указано';
        
        return `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td style="font-weight: 600; color: var(--primary-color);">
                    #${order.id}
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="font-weight: 500;">${order.username || `ID: ${order.user_id}`}</div>
                        <div style="font-size: 0.8rem; color: #666;">${order.email || ''}</div>
                    </div>
                </td>
                <td style="font-weight: 700; color: #1e293b;">
                    ${order.total_amount ? order.total_amount.toLocaleString('ru-RU') : '0'} ₽
                </td>
                <td>
                    <span class="status-indicator ${statusClass}" style="margin-right: 6px;"></span>
                    ${statusText}
                </td>
                <td>${formattedDate}</td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-info btn-sm" onclick="viewOrderDetails(${order.id})" title="Просмотр">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-warning btn-sm" onclick="editOrderStatus(${order.id})" title="Изменить статус">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteOrder(${order.id})" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Функция для обновления статистики заказов
function updateOrderStats(orders) {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);
    
    // Обновляем счетчик заказов
    const ordersStatElement = document.getElementById('statOrders');
    if (ordersStatElement) {
        ordersStatElement.textContent = totalOrders;
    }
    
    // Обновляем статистику на главной странице админ-панели если есть
    updateAdminDashboardStats({
        totalOrders: totalOrders,
        pendingOrders: pendingOrders,
        deliveredOrders: deliveredOrders,
        totalRevenue: totalRevenue
    });
}

// Функция для обновления статистики на дашборде
function updateAdminDashboardStats(stats) {
    // Находим или создаем элементы для статистики заказов
    let dashboard = document.getElementById('adminDashboard');
    if (!dashboard) return;
    
    // Обновляем виджеты статистики
    const statsElements = dashboard.querySelectorAll('.stat-card');
    statsElements.forEach(card => {
        const title = card.querySelector('.stat-label')?.textContent;
        if (title && title.includes('Заказы')) {
            const valueElement = card.querySelector('.stat-value');
            if (valueElement) {
                valueElement.textContent = stats.totalOrders;
            }
        }
    });
}

// Вспомогательные функции для работы со статусами
function getOrderStatusText(status) {
    const statuses = {
        'pending': 'В обработке',
        'processing': 'В процессе',
        'shipped': 'Отправлен',
        'delivered': 'Доставлен',
        'cancelled': 'Отменен'
    };
    return statuses[status] || status;
}

function getOrderStatusClass(status) {
    const classes = {
        'pending': 'status-banned',
        'processing': 'status-active',
        'shipped': 'status-active',
        'delivered': 'status-active',
        'cancelled': 'status-banned'
    };
    return classes[status] || 'status-banned';
}

// Функция для просмотра деталей заказа
function viewOrderDetails(orderId) {
    const token = localStorage.getItem('admin_auth_token');
    
    fetch(`http://localhost:3001/api/admin/orders/${orderId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.order) {
            showOrderModal(data.order);
        } else {
            alert('Ошибка загрузки данных заказа: ' + (data.message || 'Неизвестная ошибка'));
        }
    })
    .catch(error => {
        console.error('Ошибка загрузки заказа:', error);
        alert('Ошибка соединения с сервером');
    });
}

// Функция для отображения модального окна с деталями заказа
function showOrderModal(order) {
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;
    
    // Определяем статус заказа
    const statusText = getOrderStatusText(order.status);
    const statusColor = order.status === 'delivered' ? '#10b981' : 
                       order.status === 'cancelled' ? '#ef4444' : 
                       order.status === 'processing' ? '#f59e0b' : '#64748b';
    
    // Создаем контент модального окна
    const itemsList = order.items ? order.items.map(item => `
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
            <div>
                <div style="font-weight: 500;">${item.name || `Товар #${item.product_id}`}</div>
                <div style="font-size: 0.85rem; color: #666;">${item.quantity} шт. × ${item.price ? item.price.toLocaleString('ru-RU') : '0'} ₽</div>
            </div>
            <div style="font-weight: 600;">
                ${item.quantity * (item.price || 0)} ₽
            </div>
        </div>
    `).join('') : '<p>Товары не найдены</p>';
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto;">
            <div style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 1.5rem;">Заказ #${order.id}</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b;">
                        &times;
                    </button>
                </div>
                <div style="margin-top: 10px; display: flex; gap: 15px; flex-wrap: wrap;">
                    <div style="display: inline-flex; align-items: center; gap: 6px; background: ${statusColor}20; color: ${statusColor}; padding: 4px 12px; border-radius: 20px; font-weight: 500;">
                        <span style="width: 8px; height: 8px; background: ${statusColor}; border-radius: 50%;"></span>
                        ${statusText}
                    </div>
                    <div style="color: #64748b;">
                        <i class="fas fa-calendar-alt" style="margin-right: 5px;"></i>
                        ${order.created_at ? new Date(order.created_at).toLocaleString('ru-RU') : 'Не указано'}
                    </div>
                </div>
            </div>
            
            <div style="padding: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div>
                        <h3 style="margin: 0 0 10px 0; font-size: 1rem; color: #64748b;">Информация о клиенте</h3>
                        <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
                            <div style="margin-bottom: 8px;">
                                <div style="font-size: 0.85rem; color: #64748b;">Имя:</div>
                                <div style="font-weight: 500;">${order.username || 'Не указано'}</div>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <div style="font-size: 0.85rem; color: #64748b;">Email:</div>
                                <div>${order.email || 'Не указан'}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.85rem; color: #64748b;">ID пользователя:</div>
                                <div>${order.user_id || 'Не указан'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h3 style="margin: 0 0 10px 0; font-size: 1rem; color: #64748b;">Доставка и оплата</h3>
                        <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
                            <div style="margin-bottom: 8px;">
                                <div style="font-size: 0.85rem; color: #64748b;">Адрес доставки:</div>
                                <div style="font-weight: 500;">${order.shipping_address || 'Самовывоз'}</div>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <div style="font-size: 0.85rem; color: #64748b;">Способ оплаты:</div>
                                <div>${order.payment_method || 'Не указан'}</div>
                            </div>
                            ${order.notes ? `
                                <div>
                                    <div style="font-size: 0.85rem; color: #64748b;">Комментарий:</div>
                                    <div>${order.notes}</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <h3 style="margin: 0 0 10px 0; font-size: 1rem; color: #64748b;">Товары в заказе</h3>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    ${itemsList}
                </div>
                
                <div style="background: #f1f5f9; padding: 15px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 1.2rem; color: #1e293b;">
                        <span>Итого:</span>
                        <span>${order.total_amount ? order.total_amount.toLocaleString('ru-RU') : '0'} ₽</span>
                    </div>
                </div>
            </div>
            
            <div style="padding: 20px; border-top: 1px solid #e2e8f0; display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="updateOrderStatus(${order.id}, 'processing')" style="padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-cogs"></i> В обработку
                </button>
                <button onclick="updateOrderStatus(${order.id}, 'delivered')" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-check"></i> Завершить
                </button>
                <button onclick="updateOrderStatus(${order.id}, 'cancelled')" style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-times"></i> Отменить
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Закрытие модального окна по клику на фон
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.remove();
        }
    });
}

// Функция для изменения статуса заказа
function updateOrderStatus(orderId, newStatus) {
    const token = localStorage.getItem('admin_auth_token');
    
    const statusTexts = {
        'processing': 'в обработку',
        'delivered': 'доставлен',
        'cancelled': 'отменен'
    };
    
    const confirmation = confirm(`Вы уверены, что хотите изменить статус заказа на "${statusTexts[newStatus] || newStatus}"?`);
    
    if (!confirmation) return;
    
    fetch(`http://localhost:3001/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Статус заказа успешно изменен');
            updateOrdersTable(); // Обновляем таблицу
            
            // Закрываем модальное окно если оно открыто
            const modal = document.querySelector('.modal');
            if (modal) modal.remove();
        } else {
            alert('Ошибка изменения статуса: ' + (data.message || 'Неизвестная ошибка'));
        }
    })
    .catch(error => {
        console.error('Ошибка изменения статуса:', error);
        alert('Ошибка соединения с сервером');
    });
}

// Функция для удаления заказа
function deleteOrder(orderId) {
    const token = localStorage.getItem('admin_auth_token');
    
    const confirmation = confirm('Вы уверены, что хотите удалить этот заказ? Это действие нельзя отменить.');
    
    if (!confirmation) return;
    
    fetch(`http://localhost:3001/api/admin/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Заказ успешно удален');
            updateOrdersTable(); // Обновляем таблицу
        } else {
            alert('Ошибка удаления заказа: ' + (data.message || 'Неизвестная ошибка'));
        }
    })
    .catch(error => {
        console.error('Ошибка удаления заказа:', error);
        alert('Ошибка соединения с сервером');
    });
}

// Автоматическое обновление таблицы заказов каждые 30 секунд
setInterval(() => {
    if (document.getElementById('ordersTableBody')) {
        updateOrdersTable();
    }
}, 30000);

// Экспортируем функции для использования в других файлах
window.updateOrdersTable = updateOrdersTable;
window.viewOrderDetails = viewOrderDetails;
window.updateOrderStatus = updateOrderStatus;
window.deleteOrder = deleteOrder;

console.log('✅ Модуль админ-панели заказов загружен');