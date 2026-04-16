const mongoose = require("mongoose");

// We don't necessarily need a strict Mongoose model if we're just reading results
// but it's better to have one for consistency.
const predictionOutputSchema = new mongoose.Schema({
    productId: String,
    productName: String,
    model_used: String,
    predicted_demand: Number,
    stock_status: String,
    reorder_point: Number,
    recommended_qty: Number,
    last_run: Date
}, { collection: 'predictions_output' });

const PredictionResult = mongoose.model("PredictionResult", predictionOutputSchema);

exports.getPredictionResults = async (req, res) => {
    try {
        const results = await PredictionResult.find().sort({ last_run: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getTopCustomers = async (req, res) => {
    try {
        const sales = mongoose.connection.db.collection('sales');
        const results = await sales.aggregate([
            {
                $group: {
                    _id: "$email",
                    name: { $first: "$customerName" },
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: "$totalAmount" }
                }
            },
            { $sort: { totalOrders: -1 } },
            { $limit: 10 }
        ]).toArray();
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
