const jwt = require("jsonwebtoken");
const User = require("../models/User");

// 🔐 VERIFY TOKEN
const protect = async (req, res, next) => {
  let token;

  // ✅ Check Authorization header
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // ❌ No token
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    // ✅ Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // ✅ Get full user from DB
    req.user = await User.findById(decoded.id).select("-password");

    // ❌ If user deleted
    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

// 🔥 ROLE CHECK (SUPER ADMIN ONLY)
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "superadmin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied (Admin only)" });
  }
};

module.exports = { protect, isAdmin };