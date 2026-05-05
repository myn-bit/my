/**
 * Файл для исправления проблемы с токеном "undefined" в фронтенде
 * Добавьте этот код в ваш фронтенд
 */

// ========== ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ РАБОТЫ С ТОКЕНОМ ==========

/**
 * Получает токен из localStorage с проверкой
 */
function getAuthToken() {
    try {
        const token = localStorage.getItem('token');
        
        // Проверяем, что токен не "undefined", "null" или пустой
        if (!token || token === 'undefined' || token === 'null' || token === '') {
            console.error('❌ Токен не найден или равен undefined/null:', token);
            return null;
        }
        
        // Проверяем длину (JWT токены обычно длиннее 50 символов)
        if (token.length < 50) {
            console.warn('⚠️ Токен слишком короткий:', token.length, 'символов');
            console.warn('Значение токена:', token);
        }
        
        console.log('✅ Токен получен, длина:', token.length, 'символов');
        return token;
    } catch (error) {
        console.error('❌ Ошибка при получении токена:', error);
        return null;
    }
}

/**
 * Сохраняет токен в localStorage с проверкой
 */
function saveAuthToken(token) {
    try {
        if (!token || token === 'undefined' || token === 'null' || token === '') {
            console.error('❌ Попытка сохранить некорректный токен:', token);
            return false;
        }
        
        if (token.length < 50) {
            console.warn('⚠️ Сохраняемый токен слишком короткий:', token.length, 'символов');
        }
        
        localStorage.setItem('token', token);
        console.log('✅ Токен сохранен, длина:', token.length, 'символов');
        console.log('🔐 Первые 30 символов:', token.substring(0, 30) + '...');
        return true;
    } catch (error) {
        console.error('❌ Ошибка при сохранении токена:', error);
        return false;
    }
}

/**
 * Удаляет токен из localStorage
 */
function clearAuthToken() {
    try {
        localStorage.removeItem('token');
        console.log('✅ Токен удален из localStorage');
        return true;
    } catch (error) {
        console.error('❌ Ошибка при удалении токена:', error);
        return false;
    }
}

/**
 * Проверяет наличие и валидность токена
 */
function checkAuthToken() {
    const token = getAuthToken();
    
    if (!token) {
        console.log('🔍 Токен: отсутствует или некорректен');
        return false;
    }
    
    console.log('🔍 Токен: присутствует');
    console.log('   Длина:', token.length, 'символов');
    console.log('   Формат:', token.substring(0, 30) + '...');
    
    // Простая проверка формата JWT (3 части, разделенные точками)
    const parts = token.split('.');
    if (parts.length === 3) {
        console.log('   ✅ Похож на JWT (3 части)');
    } else {
        console.warn('   ⚠️ Не похож на JWT формат');
    }
    
    return true;
}

/**
 * Обертка для fetch с автоматической добавкой токена
 */
async function authFetch(url, options = {}) {
    const token = getAuthToken();
    
    if (!token) {
        console.error('❌ Невозможно выполнить запрос: токен отсутствует');
        // Можно перенаправить на страницу входа
        // window.location.href = '/login';
        throw new Error('Требуется авторизация');
    }
    
    // Добавляем заголовок авторизации
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    
    console.log('📡 Отправка запроса:', url);
    console.log('🔐 Заголовок Authorization:', `Bearer ${token.substring(0, 30)}...`);
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: { ...headers, ...options.headers }
        });
        
        console.log('📡 Ответ от сервера:', response.status, response.statusText);
        
        // Если 401 - токен недействителен
        if (response.status === 401) {
            console.error('❌ Токен недействителен (401)');
            clearAuthToken();
            // window.location.href = '/login';
        }
        
        return response;
    } catch (error) {
        console.error('❌ Ошибка при выполнении запроса:', error);
        throw error;
    }
}

/**
 * Функция для тестирования аутентификации
 */
async function testAuthentication() {
    console.log('🧪 Тестирование аутентификации...');
    
    // Проверяем текущий токен
    const hasToken = checkAuthToken();
    
    if (!hasToken) {
        console.log('🔐 Токен отсутствует, тестируем вход...');
        
        // Тестовые данные для входа
        const testCredentials = {
            email: 'user@pcstore.ru',
            password: 'user123'
        };
        
        try {
            const response = await fetch('http://localhost:3001/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testCredentials)
            });
            
            const data = await response.json();
            
            if (data.success && data.token) {
                console.log('✅ Вход успешен, получен токен');
                saveAuthToken(data.token);
                
                // Тестируем запрос с токеном
                await testApiRequest();
            } else {
                console.error('❌ Ошибка входа:', data.message);
            }
        } catch (error) {
            console.error('❌ Ошибка при тестировании входа:', error);
        }
    } else {
        // Если токен есть, тестируем запрос
        await testApiRequest();
    }
}

/**
 * Тестирует запрос к защищенному API
 */
async function testApiRequest() {
    console.log('🧪 Тестирование запроса к API...');
    
    try {
        const response = await authFetch('http://localhost:3001/api/test-token', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Запрос успешен!');
            console.log('👤 Пользователь:', data.user.username);
            return true;
        } else {
            console.error('❌ Запрос не удался:', data.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Ошибка при тестировании запроса:', error);
        return false;
    }
}

/**
 * Получает тестовый токен с сервера (для отладки)
 */
async function getDebugToken() {
    console.log('🎫 Получение тестового токена...');
    
    try {
        const response = await fetch('http://localhost:3001/api/get-token/1');
        const data = await response.json();
        
        if (data.success && data.token) {
            console.log('✅ Тестовый токен получен');
            saveAuthToken(data.token);
            
            console.log('📋 Пример использования:');
            console.log(`fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${data.token.substring(0, 30)}...'
  }
})`);
            return data.token;
        } else {
            console.error('❌ Не удалось получить токен');
            return null;
        }
    } catch (error) {
        console.error('❌ Ошибка получения токена:', error);
        return null;
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

// При загрузке страницы проверяем аутентификацию
if (typeof window !== 'undefined') {
    console.log('🚀 Инициализация системы аутентификации...');
    
    // Проверяем текущий токен
    checkAuthToken();
    
    // Экспортируем функции в глобальную область видимости
    window.auth = {
        getToken: getAuthToken,
        saveToken: saveAuthToken,
        clearToken: clearAuthToken,
        checkToken: checkAuthToken,
        fetch: authFetch,
        test: testAuthentication,
        getDebugToken: getDebugToken
    };
    
    console.log('✅ Система аутентификации инициализирована');
    console.log('📋 Доступные функции: window.auth.test(), window.auth.getDebugToken()');
}

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getAuthToken,
        saveAuthToken,
        clearAuthToken,
        checkAuthToken,
        authFetch,
        testAuthentication,
        getDebugToken
    };
}