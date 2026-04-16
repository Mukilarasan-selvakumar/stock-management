const express = require("express");
const router = express.Router();

const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  updateProfile,
} = require("../controllers/userController");

const { protect, isAdmin } = require("../middleware/authMiddleware");

// 🔐 Protected routes
router.put("/profile", protect, updateProfile); // Self update
router.get("/", protect, isAdmin, getUsers);
router.post("/", protect, isAdmin, createUser);
router.put("/:id", protect, isAdmin, updateUser);
router.delete("/:id", protect, isAdmin, deleteUser);

module.exports = router;