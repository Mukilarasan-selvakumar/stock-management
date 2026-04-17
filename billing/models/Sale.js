const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: true,
    },
    phone: String,
    email: String,

    items: [
      {
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
        total: Number,
      },
    ],

    totalAmount: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sale", saleSchema, "sales");