// Модель пользователя
class User {
    constructor(id, email, name, createdAt) {
        this.id = id;
        this.email = email;
        this.name = name;
        this.createdAt = createdAt;
    }
    
    toJSON() {
        return {
            id: this.id,
            email: this.email,
            name: this.name,
            createdAt: this.createdAt
        };
    }
    
    // Метод для безопасного возврата данных (без пароля)
    toSafeJSON() {
        return {
            id: this.id,
            email: this.email,
            name: this.name,
            createdAt: this.createdAt
        };
    }
}

module.exports = User;