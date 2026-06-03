const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    
    req.user = await User.findById(decoded.id).select("-password");

    
    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};


const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "superadmin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied (Admin only)" });
  }
};
const isAdmin = (req, res, next) => {
  if (req.user &&( req.user.role === "admin" || req.user.role === "superadmin")) {
    next();
  } else {
    res.status(403).json({ message: "Access denied (Admin only)" });
  }
};

module.exports = { protect, isAdmin ,isSuperAdmin};