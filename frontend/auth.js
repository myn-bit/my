/**
 * AUTH.JS - Общая логика для форм аутентификации
 * Версия 3.0 - С фиксом сохранения токена
 */

// Конфигурация
const CONFIG = {
    API_BASE_URL: 'http://localhost:3001/api',
    MIN_PASSWORD_LENGTH: 6,
    PASSWORD_STRENGTH_LEVELS: {
        WEAK: 1,
        MEDIUM: 2,
        GOOD: 3,
        STRONG: 4
    }
};

// DOM элементы
let currentForm = null;
let isSubmitting = false;

/**
 * Инициализация форм аутентификации
 */
function initAuthForms() {
    console.log('🔧 Инициализация форм аутентификации...');
    
    // Находим активную форму
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
        currentForm = 'login';
        initLoginForm();
    } else if (registerForm) {
        currentForm = 'register';
        initRegisterForm();
    }
    
    // Проверяем авторизацию
    checkExistingAuth();
    
    // Проверяем сервер
    checkServerConnection();
}

/**
 * Инициализация формы входа
 */
function initLoginForm() {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePassword');
    const submitBtn = document.getElementById('submitBtn');
    
    if (!form || !emailInput || !passwordInput) {
        console.error('❌ Не найдены необходимые элементы формы входа');
        return;
    }
    
    // Настройка кнопки показа пароля
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => togglePasswordVisibility(passwordInput, toggleBtn));
    }
    
    // Обработка отправки формы
    form.addEventListener('submit', handleLoginSubmit);
    
    // Автозаполнение для теста
    setupAutoFill();
    
    console.log('✅ Форма входа инициализирована');
}

/**
 * Инициализация формы регистрации
 */
function initRegisterForm() {
    const form = document.getElementById('registerForm');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPassword');
    const submitBtn = document.getElementById('submitBtn');
    
    if (!form || !usernameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
        console.error('❌ Не найдены необходимые элементы формы регистрации');
        return;
    }
    
    // Настройка кнопок показа пароля
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => togglePasswordVisibility(passwordInput, togglePasswordBtn));
    }
    
    if (toggleConfirmPasswordBtn && confirmPasswordInput) {
        toggleConfirmPasswordBtn.addEventListener('click', () => togglePasswordVisibility(confirmPasswordInput, toggleConfirmPasswordBtn));
    }
    
    // Проверка сложности пароля в реальном времени
    if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
            checkPasswordStrength(e.target.value);
            validatePasswordMatch();
        });
    }
    
    // Проверка совпадения паролей в реальном времени
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    }
    
    // Обработка отправки формы
    form.addEventListener('submit', handleRegisterSubmit);
    
    console.log('✅ Форма регистрации инициализирована');
}

/**
 * Переключение видимости пароля
 */
function togglePasswordVisibility(passwordInput, toggleButton) {
    if (!passwordInput || !toggleButton) return;
    
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    
    // Меняем иконку
    const icon = toggleButton.querySelector('i');
    if (icon) {
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
    
    // Анимация кнопки
    toggleButton.style.transform = 'translateY(-50%) scale(1.1)';
    setTimeout(() => {
        toggleButton.style.transform = 'translateY(-50%) scale(1)';
    }, 150);
}

/**
 * Проверка сложности пароля
 */
function checkPasswordStrength(password) {
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    
    if (!strengthBar || !strengthText) return;
    
    let strength = 0;
    
    // Проверка длины
    if (password.length >= 8) strength++;
    
    // Проверка наличия заглавных букв
    if (/[A-Z]/.test(password)) strength++;
    
    // Проверка наличия цифр
    if (/[0-9]/.test(password)) strength++;
    
    // Проверка наличия специальных символов
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    // Обновление индикатора
    let width = 0;
    let level = '';
    let colorClass = '';
    
    switch(strength) {
        case 0:
            width = 0;
            level = '';
            colorClass = '';
            break;
        case 1:
            width = 25;
            level = 'Слабый';
            colorClass = 'strength-weak';
            break;
        case 2:
            width = 50;
            level = 'Средний';
            colorClass = 'strength-medium';
            break;
        case 3:
            width = 75;
            level = 'Хороший';
            colorClass = 'strength-good';
            break;
        case 4:
            width = 100;
            level = 'Отличный';
            colorClass = 'strength-strong';
            break;
    }
    
    strengthBar.style.width = `${width}%`;
    strengthBar.className = `strength-bar ${colorClass}`;
    strengthText.textContent = level;
    strengthText.className = `strength-text ${colorClass.replace('strength-', '')}`;
}

/**
 * Проверка совпадения паролей
 */
function validatePasswordMatch() {
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    if (!passwordInput || !confirmPasswordInput) return true;
    
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    if (confirmPassword === '') return true;
    
    if (password !== confirmPassword) {
        confirmPasswordInput.classList.add('error');
        showMessage('Пароли не совпадают', 'error');
        return false;
    } else {
        confirmPasswordInput.classList.remove('error');
        return true;
    }
}

/**
 * Обработка отправки формы входа - ИСПРАВЛЕНО
 */
async function handleLoginSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Валидация
    if (!email || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showMessage('Введите корректный email', 'error');
        return;
    }
    
    // Начинаем отправку
    isSubmitting = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Вход...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('✅ Вход выполнен успешно!', 'success');
            
            // ВАЖНОЕ ИСПРАВЛЕНИЕ: Сохраняем токен внутри объекта пользователя
            const userData = {
                ...data.user,
                token: data.token  // Добавляем токен к данным пользователя
            };
            
            // Проверяем что токен сохранен
            console.log('🔐 Токен сохранен:', {
                hasToken: !!data.token,
                tokenLength: data.token?.length,
                userWithToken: userData
            });
            
            // Сохраняем пользователя с токеном
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('lastLogin', new Date().toISOString());
            
            // Перенаправляем через 1.5 секунды
            setTimeout(() => {
                if (data.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'catalog.html';
                }
            }, 1500);
            
        } else {
            showMessage('❌ ' + data.message, 'error');
        }
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        showMessage('❌ Ошибка подключения к серверу', 'error');
        
    } finally {
        // Восстанавливаем кнопку
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        isSubmitting = false;
    }
}

/**
 * Обработка отправки формы регистрации - ИСПРАВЛЕНО
 */
async function handleRegisterSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    const form = e.target;
    const username = form.username.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Валидация
    if (!username || !email || !password || !confirmPassword) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showMessage('Введите корректный email', 'error');
        return;
    }
    
    if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
        showMessage(`Пароль должен содержать минимум ${CONFIG.MIN_PASSWORD_LENGTH} символов`, 'error');
        return;
    }
    
    if (!validatePasswordMatch()) {
        return;
    }
    
    // Начинаем отправку
    isSubmitting = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Регистрация...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('✅ Регистрация успешна! Вы будете перенаправлены...', 'success');
            
            // ВАЖНОЕ ИСПРАВЛЕНИЕ: Сохраняем токен внутри объекта пользователя
            const userData = {
                ...data.user,
                token: data.token  // Добавляем токен к данным пользователя
            };
            
            // Проверяем что токен сохранен
            console.log('🔐 Токен сохранен при регистрации:', {
                hasToken: !!data.token,
                tokenLength: data.token?.length,
                userWithToken: userData
            });
            
            // Сохраняем пользователя с токеном
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('registeredAt', new Date().toISOString());
            
            // Перенаправляем через 2 секунды
            setTimeout(() => {
                window.location.href = 'catalog.html';
            }, 2000);
            
        } else {
            showMessage('❌ ' + data.message, 'error');
        }
        
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        showMessage('❌ Ошибка подключения к серверу', 'error');
        
    } finally {
        // Восстанавливаем кнопку
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        isSubmitting = false;
    }
}

/**
 * Валидация email
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Показать сообщение
 */
function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('message');
    if (!messageDiv) return;
    
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Автоскрытие для успешных/ошибочных сообщений
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }
}

/**
 * Проверка существующей авторизации - ИСПРАВЛЕНО
 */
function checkExistingAuth() {
    try {
        const userJson = localStorage.getItem('user');
        if (!userJson) return;
        
        const user = JSON.parse(userJson);
        if (!user || !user.token) {
            console.warn('⚠️ Пользователь найден, но токен отсутствует');
            localStorage.removeItem('user');
            return;
        }
        
        if (user.token === 'undefined' || user.token === 'null' || user.token.length < 50) {
            console.warn('⚠️ Некорректный токен, очищаем данные');
            localStorage.removeItem('user');
            return;
        }
        
        console.log('✅ Пользователь авторизован:', {
            username: user.username,
            tokenLength: user.token?.length,
            tokenStart: user.token?.substring(0, 20) + '...'
        });
        
        showMessage(`Вы уже вошли как ${user.username}. <a href="catalog.html" style="color: #4f46e5; text-decoration: none; font-weight: 600;">Перейти в каталог</a>`, 'info');
        
    } catch (error) {
        console.error('❌ Ошибка при проверке авторизации:', error);
        localStorage.removeItem('user');
    }
}

/**
 * Проверка соединения с сервером
 */
async function checkServerConnection() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/test`);
        if (response.ok) {
            console.log('✅ Сервер доступен');
        }
    } catch (error) {
        console.warn('⚠️ Сервер не отвечает');
    }
}

/**
 * Настройка автозаполнения для теста
 */
function setupAutoFill() {
    // Автозаполнение по двойному клику на форму
    const form = document.getElementById('loginForm') || document.getElementById('registerForm');
    if (!form) return;
    
    form.addEventListener('dblclick', (e) => {
        if (e.target.tagName === 'FORM') {
            autoFillTestData();
        }
    });
}

/**
 * Автозаполнение тестовыми данными
 */
function autoFillTestData() {
    if (currentForm === 'login') {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        if (emailInput && passwordInput) {
            emailInput.value = 'admin@pcstore.ru';
            passwordInput.value = 'admin123';
            showMessage('Тестовые данные заполнены', 'info');
        }
    }
}

/**
 * Выход из системы
 */
function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('lastLogin');
    window.location.href = 'login.html';
}

/**
 * Проверить авторизацию (для других страниц)
 */
function checkAuth() {
    try {
        const userJson = localStorage.getItem('user');
        if (!userJson) {
            window.location.href = 'login.html';
            return null;
        }
        
        const user = JSON.parse(userJson);
        if (!user || !user.token) {
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return null;
        }
        
        if (user.token === 'undefined' || user.token === 'null' || user.token.length < 50) {
            console.error('❌ Некорректный токен:', {
                tokenValue: user.token,
                tokenType: typeof user.token,
                tokenLength: user.token?.length
            });
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return null;
        }
        
        return user;
        
    } catch (error) {
        console.error('❌ Ошибка при проверке авторизации:', error);
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return null;
    }
}

/**
 * Получить текущего пользователя
 */
function getCurrentUser() {
    try {
        const userJson = localStorage.getItem('user');
        return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
        console.error('❌ Ошибка при получении пользователя:', error);
        return null;
    }
}

/**
 * Проверить роль администратора
 */
function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

/**
 * Получить заголовки авторизации для запросов
 */
function getAuthHeaders() {
    const user = getCurrentUser();
    if (!user || !user.token) {
        console.error('❌ Токен не найден при попытке создать заголовки');
        return {
            'Content-Type': 'application/json'
        };
    }
    
    console.log('🔐 Используется токен для запроса:', {
        tokenStart: user.token.substring(0, 20) + '...',
        tokenLength: user.token.length
    });
    
    return {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
    };
}

/**
 * Отправить запрос с авторизацией
 */
async function fetchWithAuth(url, options = {}) {
    const authHeaders = getAuthHeaders();
    
    const mergedOptions = {
        ...options,
        headers: {
            ...authHeaders,
            ...options.headers
        }
    };
    
    console.log('📤 Отправка авторизованного запроса:', url);
    
    try {
        const response = await fetch(url, mergedOptions);
        
        // Проверка на ошибки авторизации
        if (response.status === 401 || response.status === 403) {
            console.warn('⚠️ Ошибка авторизации, очищаем данные');
            localStorage.removeItem('user');
            if (!window.location.href.includes('login.html')) {
                window.location.href = 'login.html';
            }
            throw new Error('Ошибка авторизации');
        }
        
        return response;
        
    } catch (error) {
        console.error('❌ Ошибка при отправке запроса:', error);
        throw error;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', initAuthForms);

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initAuthForms,
        togglePasswordVisibility,
        checkPasswordStrength,
        validatePasswordMatch,
        validateEmail,
        showMessage,
        logout,
        checkAuth,
        getCurrentUser,
        isAdmin,
        getAuthHeaders,
        fetchWithAuth
    };
}

// Глобальный объект для доступа из других скриптов
window.AuthUtils = {
    initAuthForms,
    togglePasswordVisibility,
    checkPasswordStrength,
    validatePasswordMatch,
    validateEmail,
    showMessage,
    logout,
    checkAuth,
    getCurrentUser,
    isAdmin,
    getAuthHeaders,
    fetchWithAuth
};

// Дополнительная диагностика при загрузке
console.log('🔍 Диагностика localStorage при загрузке:');
console.log('localStorage.getItem("user"):', localStorage.getItem('user'));
try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('Parsed user:', user);
    console.log('User token exists:', !!user.token);
    console.log('User token value:', user.token);
    console.log('User token type:', typeof user.token);
    console.log('User token length:', user.token?.length);
} catch (e) {
    console.error('Ошибка парсинга:', e);
}