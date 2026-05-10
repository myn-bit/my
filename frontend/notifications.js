/**
 * NOTIFICATIONS.JS - Система уведомлений
 */

class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.maxNotifications = 5;
        this.defaultDuration = 5000;
        this.init();
    }

    /**
     * Инициализация системы уведомлений
     */
    init() {
        // Создаем контейнер для уведомлений
        this.container = document.createElement('div');
        this.container.className = 'notifications-container';
        document.body.appendChild(this.container);

        // Слушаем события уведомлений
        document.addEventListener('notification', (event) => {
            if (event.detail) {
                this.show(event.detail);
            }
        });

        console.log('🔔 Система уведомлений инициализирована');
    }

    /**
     * Показать уведомление
     * @param {Object} options - Опции уведомления
     */
    show(options) {
        const {
            title,
            message,
            type = 'info',
            duration = this.defaultDuration,
            icon = null,
            action = null,
            dismissible = true
        } = options;

        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Иконка в зависимости от типа
        let iconHtml = '';
        if (icon) {
            iconHtml = `<i class="${icon}"></i>`;
        } else {
            const icons = {
                success: 'fas fa-check-circle',
                error: 'fas fa-exclamation-circle',
                warning: 'fas fa-exclamation-triangle',
                info: 'fas fa-info-circle',
                purchase: 'fas fa-shopping-cart'
            };
            iconHtml = `<i class="${icons[type] || icons.info}"></i>`;
        }

        // Создаем HTML уведомления
        notification.innerHTML = `
            <div class="notification-icon">
                ${iconHtml}
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
                ${action ? `<div class="notification-action" style="margin-top: 8px;">${action}</div>` : ''}
            </div>
            ${dismissible ? '<button class="notification-close"><i class="fas fa-times"></i></button>' : ''}
            ${duration > 0 ? '<div class="notification-progress"><div class="notification-progress-bar" style="animation-duration: ' + duration + 'ms"></div></div>' : ''}
        `;

        // Добавляем в DOM
        this.container.appendChild(notification);
        this.notifications.push(notification);

        // Ограничиваем количество уведомлений
        if (this.notifications.length > this.maxNotifications) {
            const oldest = this.notifications.shift();
            this.remove(oldest);
        }

        // Кнопка закрытия
        if (dismissible) {
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => this.remove(notification));
        }

        // Автоматическое закрытие
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    this.remove(notification);
                }
            }, duration);
        }

        // Анимация появления
        notification.style.animation = 'notificationSlideIn 0.4s ease-out';

        // Возвращаем элемент для управления
        return notification;
    }

    /**
     * Удалить уведомление
     * @param {HTMLElement} notification - Элемент уведомления
     */
    remove(notification) {
        if (!notification.parentNode) return;

        // Анимация исчезновения
        notification.classList.add('fade-out');
        
        setTimeout(() => {
            if (notification.parentNode) {
                this.container.removeChild(notification);
                this.notifications = this.notifications.filter(n => n !== notification);
            }
        }, 400);
    }

    /**
     * Удалить все уведомления
     */
    clearAll() {
        this.notifications.forEach(notification => this.remove(notification));
        this.notifications = [];
    }

    /**
     * Быстрые методы для типов уведомлений
     */
    success(title, message, options = {}) {
        return this.show({
            title,
            message,
            type: 'success',
            ...options
        });
    }

    error(title, message, options = {}) {
        return this.show({
            title,
            message,
            type: 'error',
            ...options
        });
    }

    warning(title, message, options = {}) {
        return this.show({
            title,
            message,
            type: 'warning',
            ...options
        });
    }

    info(title, message, options = {}) {
        return this.show({
            title,
            message,
            type: 'info',
            ...options
        });
    }

    purchase(title, message, options = {}) {
        return this.show({
            title,
            message,
            type: 'purchase',
            ...options
        });
    }
}

// Создаем глобальный экземпляр
window.Notifications = new NotificationSystem();

// Упрощенный API для быстрого использования
window.showNotification = (title, message, type = 'info', duration = 5000) => {
    return window.Notifications.show({ title, message, type, duration });
};

// Событие для кастомных уведомлений
window.dispatchNotification = (options) => {
    const event = new CustomEvent('notification', { detail: options });
    document.dispatchEvent(event);
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Уже инициализировано в конструкторе
});

// Простое уведомление
showNotification('Заголовок', 'Сообщение', 'success');

// Или через API
Notifications.success('Успех!', 'Операция выполнена');

// Или через событие
dispatchNotification({
    title: 'Новое сообщение',
    message: 'У вас новое уведомление',
    type: 'info',
    duration: 5000
});
