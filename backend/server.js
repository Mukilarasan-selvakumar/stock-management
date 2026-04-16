const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require("./routes/userRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
require("./utils/scheduler"); // Initialize scheduler

dotenv.config();
connectDB();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// 🔥 👉 PROXY MUST BE BEFORE body parsers!
app.use(
  "/api/billing",
  createProxyMiddleware({
    target: "http://localhost:6000", // billing service
    changeOrigin: true,
    pathRewrite: {
      "^/api/billing": "", // strip the /api/billing prefix
    },
  })
);

app.use(
  "/api/process",
  createProxyMiddleware({
    target: "http://localhost:7000", // data processing service
    changeOrigin: true,
    pathRewrite: {
      "^/api/process": "", 
    },
  })
);

app.use(
  "/api/predict",
  createProxyMiddleware({
    target: "http://localhost:8000", // prediction service
    changeOrigin: true,
    pathRewrite: {
      "^/api/predict": "", 
    },
  })
);

app.use(express.json());
app.use(cookieParser());

// 🔥 ROUTES
app.use('/api/auth', authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/analytics", analyticsRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("🗓️  2-Week Background Prediction Scheduler Active");
});