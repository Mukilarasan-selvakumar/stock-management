const express = require("express");
const router = express.Router();

const {
  getInventory,
  getInventoryById,
  getInventoryByProductId,
  createInventory,
  updateInventory,
  updateInventoryByProductId,
  deleteInventory,
  deleteInventoryAndProduct,
  bulkImportInventory,
  getLowStock,
  getInventoryStats,
  getStockHistory,
  getStockSummary,
  getStockMovementAnalytics,
  adjustStock,
} = require("../controllers/inventoryController");

const { protect, isAdmin } = require("../middleware/authMiddleware");

// All routes require authentication and admin access
router.use(protect, isAdmin);

// GET routes
router.get("/", getInventory);
router.get("/low-stock", getLowStock);
router.get("/product/:productId", getInventoryByProductId);
router.get("/stats", getInventoryStats);
router.get("/stock-history", getStockHistory);           // NEW: Get stock movement history
router.get("/stock-analytics", getStockMovementAnalytics); // NEW: Get stock analytics
router.get("/stock-summary/:productId", getStockSummary);  // NEW: Get stock summary by product
router.get("/:id", getInventoryById);

// POST routes
router.post("/", createInventory);
router.post("/bulk-import", bulkImportInventory);

// PUT routes
router.put("/:id", updateInventory);
router.put("/adjust/:id", adjustStock);                  // NEW: Manual stock adjustment
router.put("/product/:productId", updateInventoryByProductId);

// DELETE routes
router.delete("/:id", deleteInventory);
router.delete("/:id/product", deleteInventoryAndProduct);

module.exports = router;