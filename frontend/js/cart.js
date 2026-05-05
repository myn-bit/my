// cart.js - Общие функции для работы с корзиной

// Добавление товара в корзину
function addToCart(productId, quantity = 1) {
    try {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        
        // Проверяем, есть ли товар уже в корзине
        const existingItemIndex = cart.findIndex(item => item.productId === productId);
        
        if (existingItemIndex !== -1) {
            // Увеличиваем количество существующего товара
            cart[existingItemIndex].quantity += quantity;
        } else {
            // Добавляем новый товар
            cart.push({
                productId: productId,
                quantity: quantity,
                addedAt: new Date().toISOString()
            });
        }
        
        // Сохраняем обновленную корзину
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Обновляем счетчик
        updateCartCounter();
        
        // Показываем уведомление
        showNotification('Товар добавлен в корзину!', 'success');
        
        return true;
    } catch (error) {
        console.error('Ошибка при добавлении в корзину:', error);
        showNotification('Ошибка при добавлении в корзину', 'error');
        return false;
    }
}

// Удаление товара из корзины
function removeFromCart(productId) {
    try {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        cart = cart.filter(item => item.productId !== productId);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCounter();
        return true;
    } catch (error) {
        console.error('Ошибка при удалении из корзины:', error);
        return false;
    }
}

// Обновление количества товара
function updateCartQuantity(productId, newQuantity) {
    try {
        if (newQuantity < 1) {
            return removeFromCart(productId);
        }
        
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        const itemIndex = cart.findIndex(item => item.productId === productId);
        
        if (itemIndex !== -1) {
            cart[itemIndex].quantity = newQuantity;
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCounter();
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Ошибка при обновлении количества:', error);
        return false;
    }
}

// Получение содержимого корзины
function getCart() {
    try {
        return JSON.parse(localStorage.getItem('cart')) || [];
    } catch (error) {
        console.error('Ошибка при получении корзины:', error);
        return [];
    }
}

// Получение количества товаров в корзине
function getCartCount() {
    const cart = getCart();
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

// Очистка корзины
function clearCart() {
    try {
        localStorage.removeItem('cart');
        updateCartCounter();
        return true;
    } catch (error) {
        console.error('Ошибка при очистке корзины:', error);
        return false;
    }
}

// Обновление счетчика корзины на всех страницах
function updateCartCounter() {
    const count = getCartCount();
    
    // Обновляем все элементы с классом cart-count и id cartCount
    document.querySelectorAll('#cartCount, .cart-badge, .cart-count').forEach(element => {
        element.textContent = count;
    });
    
    return count;
}

// Показать уведомление
function showNotification(message, type = 'info') {
    // Создаем контейнер если его нет
    let container = document.querySelector('.notifications-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notifications-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
        padding: 15px;
        margin-bottom: 10px;
        border-radius: 5px;
        border-left: 5px solid ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        display: flex;
        justify-content: space-between;
        align-items: center;
        animation: slideIn 0.3s ease;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; color: #666;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Автоудаление через 3 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Инициализация корзины при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    updateCartCounter();
});

// Добавляем стиль для анимации
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);