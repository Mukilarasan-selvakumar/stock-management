const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
    },
    name: String,
    category: String,
    price: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema, "products");