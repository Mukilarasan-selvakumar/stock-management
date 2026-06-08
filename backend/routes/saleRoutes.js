const express = require("express");
const router = express.Router();
const saleController = require("../controllers/saleController");
const { protect, isAdmin } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);

// Admin only routes (for dashboard)
router.get("/admin/sales-history", isAdmin, saleController.getSalesHistory);
router.get("/admin/top-products", isAdmin, saleController.getTopProducts);
router.get("/admin/daily-sales", isAdmin, saleController.getDailySales);
router.get("/admin/recent-orders", isAdmin, saleController.getRecentOrders);
router.get("/admin/sales-summary", isAdmin, saleController.getSalesSummary);

// Public routes (authenticated users)
router.post("/", saleController.createSale);
router.get("/", saleController.getSalesHistory);
router.get("/customer", saleController.getSalesByCustomer);
router.get("/:id", saleController.getSaleById);
router.delete("/:id", isAdmin, saleController.deleteSale);

module.exports = router;