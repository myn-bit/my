// Функции валидации

// Валидация формы заказа
function validateOrderForm(formData) {
    const errors = {};
    
    if (!formData.name || formData.name.trim().length < 2) {
        errors.name = 'Имя должно содержать минимум 2 символа';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
        errors.email = 'Введите корректный email';
    }
    
    const phoneRegex = /^\+7\d{10}$/;
    if (!formData.phone || !phoneRegex.test(formData.phone)) {
        errors.phone = 'Введите телефон в формате +79991234567';
    }
    
    if (!formData.address || formData.address.trim().length < 10) {
        errors.address = 'Адрес должен содержать минимум 10 символов';
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

// Валидация формы регистрации
function validateRegisterForm(formData) {
    const errors = {};
    
    if (!formData.name || formData.name.trim().length < 2) {
        errors.name = 'Имя должно содержать минимум 2 символа';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
        errors.email = 'Введите корректный email';
    }
    
    if (!formData.password || formData.password.length < 6) {
        errors.password = 'Пароль должен содержать минимум 6 символов';
    }
    
    if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Пароли не совпадают';
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

// Валидация формы входа
function validateLoginForm(formData) {
    const errors = {};
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
        errors.email = 'Введите корректный email';
    }
    
    if (!formData.password) {
        errors.password = 'Введите пароль';
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

// Валидация товара (для админки)
function validateProductForm(formData) {
    const errors = {};
    
    if (!formData.name || formData.name.trim().length < 3) {
        errors.name = 'Название должно содержать минимум 3 символа';
    }
    
    if (!formData.price || isNaN(formData.price) || formData.price <= 0) {
        errors.price = 'Введите корректную цену';
    }
    
    if (!formData.category) {
        errors.category = 'Выберите категорию';
    }
    
    if (!formData.stock || isNaN(formData.stock) || formData.stock < 0) {
        errors.stock = 'Введите корректное количество';
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

// Валидация конфигуратора ПК
function validatePcConfig(config) {
    const errors = {};
    
    if (!config.cpu) {
        errors.cpu = 'Выберите процессор';
    }
    
    if (!config.motherboard) {
        errors.motherboard = 'Выберите материнскую плату';
    }
    
    if (!config.ram) {
        errors.ram = 'Выберите оперативную память';
    }
    
    if (!config.storage) {
        errors.storage = 'Выберите накопитель';
    }
    
    if (!config.gpu) {
        errors.gpu = 'Выберите видеокарту';
    }
    
    // Проверка совместимости
    if (config.cpu && config.motherboard) {
        // Здесь должна быть логика проверки совместимости
        // Например, проверка сокета
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        warnings: []
    };
}