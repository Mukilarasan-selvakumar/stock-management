const express = require("express");
const router = express.Router();

const { createSale } = require("../controllers/saleController");
const Product = require("../models/Product");

// 🔥 CREATE SALE (Billing)
router.post("/", createSale);
router.get("/product/:id", async (req, res) => {
  try {
    const Product = require("../models/Product");

    const product = await Product.findOne({
      productId: req.params.id,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;