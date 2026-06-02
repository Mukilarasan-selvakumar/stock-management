const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const MONGO_URI = process.env.MONGODB_URI;

const ProductSchema = new mongoose.Schema({
    productId: String,
    name: String,
    category: String,
    price: Number,
}, { strict: false });

const InventorySchema = new mongoose.Schema({
    productId: String,
    stock: Number,
    lastUpdated: Date,
}, { strict: false });

const SaleSchema = new mongoose.Schema({
    customerName: String,
    email: String,
    phone: String,
    items: Array,
    totalAmount: Number,
    createdAt: Date,
}, { strict: false });

const Product = mongoose.model("Product", ProductSchema, "products");
const Inventory = mongoose.model("Inventory", InventorySchema, "inventories");
const Sale = mongoose.model("Sale", SaleSchema, "sales");

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB for seeding...");

        
        await Product.deleteMany({});
        await Inventory.deleteMany({});
        await Sale.deleteMany({});
        console.log("Cleared existing collections.");

        
        const sampleProducts = [
            { productId: "P001", name: "Premium Cotton T-Shirt", category: "Apparel", price: 25 },
            { productId: "P002", name: "Wireless Headphones", category: "Electronics", price: 120 },
            { productId: "P003", name: "Stainless Steel Bottle", category: "Home", price: 15 },
            { productId: "P004", name: "Leather Wallet", category: "Accessories", price: 45 },
            { productId: "P005", name: "Running Shoes", category: "Apparel", price: 85 },
            { productId: "P006", name: "Smart Watch", category: "Electronics", price: 199 },
        ];

        await Product.insertMany(sampleProducts);
        console.log("Inserted Sample Products.");

        
        const sampleInventory = [
            { productId: "P001", stock: 15, lastUpdated: new Date() }, // Low stock (Understock)
            { productId: "P002", stock: 200, lastUpdated: new Date() }, // High stock (Overstock)
            { productId: "P003", stock: 50, lastUpdated: new Date() }, // Optimal
            { productId: "P004", stock: 8, lastUpdated: new Date() }, // Understock
            { productId: "P005", stock: 65, lastUpdated: new Date() }, // Optimal
            { productId: "P006", stock: 300, lastUpdated: new Date() }, // Overstock
        ];

        await Inventory.insertMany(sampleInventory);
        console.log("Inserted Sample Inventory.");

        
        const sampleSales = [];
        const customers = [
            { name: "Alice Smith", email: "alice@example.com", phone: "1234567890" },
            { name: "Bob Johnson", email: "bob@example.com", phone: "0987654321" },
            { name: "Charlie Brown", email: "charlie@example.com", phone: "1122334455" }
        ];

        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            
            const dailyOrders = Math.floor(Math.random() * 3) + 1;
            
            for (let j = 0; j < dailyOrders; j++) {
                const customer = customers[Math.floor(Math.random() * customers.length)];
                
                
                const product = sampleProducts[Math.floor(Math.random() * sampleProducts.length)];
                const qty = Math.floor(Math.random() * 5) + 1;

                sampleSales.push({
                    customerName: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    items: [
                        { productId: product.productId, name: product.name, price: product.price, quantity: qty, total: product.price * qty }
                    ],
                    totalAmount: product.price * qty,
                    createdAt: date
                });
            }
        }

        await Sale.insertMany(sampleSales);
        console.log(`Inserted ${sampleSales.length} Sample Sales.`);

        console.log("✅ Seeding complete! Database is now ready for showcase.");
        process.exit();
    } catch (err) {
        console.error("Seeding failed:", err);
        process.exit(1);
    }
};

seedData();
