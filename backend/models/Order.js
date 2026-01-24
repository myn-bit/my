// Модель заказа
class Order {
    constructor(id, userId, total, status, shippingAddress, createdAt) {
        this.id = id;
        this.userId = userId;
        this.total = total;
        this.status = status;
        this.shippingAddress = shippingAddress;
        this.createdAt = createdAt;
        this.items = [];
    }
    
    addItem(productId, quantity, price) {
        this.items.push({ productId, quantity, price });
    }
    
    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            total: this.total,
            status: this.status,
            shippingAddress: this.shippingAddress,
            createdAt: this.createdAt,
            items: this.items
        };
    }
}

module.exports = Order;