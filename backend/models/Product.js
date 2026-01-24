// Модель товара
class Product {
    constructor(id, name, description, price, category, stock, image) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.price = price;
        this.category = category;
        this.stock = stock;
        this.image = image;
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            price: this.price,
            category: this.category,
            stock: this.stock,
            image: this.image
        };
    }
}

module.exports = Product;