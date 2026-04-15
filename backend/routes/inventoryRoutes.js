const express = require("express");
const router = express.Router();

const {
  getInventory,
  createInventory,
  updateInventory,
  deleteInventory,
} = require("../controllers/inventoryController");

const { protect, isAdmin } = require("../middleware/authMiddleware");

router.get("/", protect, isAdmin, getInventory);
router.post("/", protect, isAdmin, createInventory);
router.put("/:id", protect, isAdmin, updateInventory);
router.delete("/:id", protect, isAdmin, deleteInventory);

module.exports = router;