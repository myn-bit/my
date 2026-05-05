/**
 * THEME.JS - Управление светлой/тёмной темой
 */

class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.themeToggle = null;
        this.initialized = false;
    }

    /**
     * Инициализация менеджера тем
     */
    init() {
        if (this.initialized) return;
        
        // Загружаем сохранённую тему
        this.loadTheme();
        
        // Применяем текущую тему
        this.applyTheme();
        
        // Создаем кнопку переключения темы если её нет
        this.createThemeToggle();
        
        // Слушаем системные предпочтения
        this.listenToSystemTheme();
        
        this.initialized = true;
        console.log('🎨 Менеджер темы инициализирован');
    }

    /**
     * Загружаем сохранённую тему из localStorage
     */
    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme) {
            this.currentTheme = savedTheme;
        } else if (prefersDark) {
            this.currentTheme = 'dark';
        } else {
            this.currentTheme = 'light';
        }
    }

    /**
     * Создаём кнопку переключения темы
     */
    createThemeToggle() {
        // Проверяем, не существует ли уже кнопка
        if (document.querySelector('.theme-toggle')) return;
        
        this.themeToggle = document.createElement('button');
        this.themeToggle.className = 'theme-toggle';
        this.themeToggle.innerHTML = `
            <i class="fas fa-sun"></i>
            <i class="fas fa-moon"></i>
        `;
        this.themeToggle.setAttribute('aria-label', 'Переключить тему');
        this.themeToggle.setAttribute('title', 'Переключить тему (Ctrl+Shift+T)');
        
        document.body.appendChild(this.themeToggle);
        
        // Обработчик клика
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Горячая клавиша
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    /**
     * Применяем текущую тему
     */
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
        
        // Добавляем класс для анимации
        document.body.classList.add('theme-switching');
        setTimeout(() => {
            document.body.classList.remove('theme-switching');
        }, 600);
        
        // Диспатчим событие смены темы
        this.dispatchThemeChange();
    }

    /**
     * Переключаем тему
     */
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        
        // Показываем уведомление
        if (window.Notifications) {
            const themeName = this.currentTheme === 'light' ? 'Светлая' : 'Тёмная';
            window.Notifications.info(
                'Тема изменена',
                `Переключено на ${themeName.toLowerCase()} тему`,
                { duration: 2000 }
            );
        }
    }

    /**
     * Устанавливаем конкретную тему
     * @param {string} theme - 'light' или 'dark'
     */
    setTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            this.currentTheme = theme;
            this.applyTheme();
        }
    }

    /**
     * Получаем текущую тему
     * @returns {string} Текущая тема
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * Проверяем, тёмная ли тема
     * @returns {boolean}
     */
    isDark() {
        return this.currentTheme === 'dark';
    }

    /**
     * Проверяем, светлая ли тема
     * @returns {boolean}
     */
    isLight() {
        return this.currentTheme === 'light';
    }

    /**
     * Слушаем системные предпочтения темы
     */
    listenToSystemTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const handleChange = (e) => {
            // Если пользователь не выбрал тему вручную
            if (!localStorage.getItem('theme')) {
                this.currentTheme = e.matches ? 'dark' : 'light';
                this.applyTheme();
            }
        };
        
        mediaQuery.addEventListener('change', handleChange);
    }

    /**
     * Диспатчим событие изменения темы
     */
    dispatchThemeChange() {
        const event = new CustomEvent('themechange', {
            detail: {
                theme: this.currentTheme,
                isDark: this.isDark(),
                isLight: this.isLight()
            }
        });
        document.dispatchEvent(event);
    }
}

// Создаем глобальный экземпляр (но не инициализируем сразу!)
window.ThemeManager = ThemeManager;
window.Theme = new ThemeManager();

// Упрощенный API
window.toggleTheme = () => {
    if (window.Theme) window.Theme.toggleTheme();
};
window.setTheme = (theme) => {
    if (window.Theme) window.Theme.setTheme(theme);
};
window.getTheme = () => {
    return window.Theme ? window.Theme.getTheme() : 'light';
};
window.isDarkTheme = () => {
    return window.Theme ? window.Theme.isDark() : false;
};
window.isLightTheme = () => {
    return window.Theme ? window.Theme.isLight() : true;
};

// Инициализация при загрузке каждой страницы
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем тему, если менеджер существует
    if (window.Theme && typeof window.Theme.init === 'function') {
        window.Theme.init();
    }
});