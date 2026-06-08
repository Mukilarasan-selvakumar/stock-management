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
const saleRoutes = require("./routes/saleRoutes");

const { isAdmin, isSuperAdmin, protect } = require('./middleware/authMiddleware');
require("./utils/scheduler");

dotenv.config();
connectDB();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));


app.use(
  "/api/billing",
  createProxyMiddleware({
    target: "http://localhost:6000",
    changeOrigin: true,
    pathRewrite: {
      "^/api/billing": "",
    },
  })
);

app.use(
  "/api/process",
  createProxyMiddleware({
    target: "http://localhost:7000",
    changeOrigin: true,
    pathRewrite: {
      "^/api/process": "",
    },
  })
);

app.use(
  "/api/predict",
  createProxyMiddleware({
    target: "http://localhost:8000",
    changeOrigin: true,
    pathRewrite: {
      "^/api/predict": "",
    },
  })
);

app.use(express.json());
app.use(cookieParser());


app.use('/api/auth', authRoutes);
app.use("/api/users", protect, isSuperAdmin, userRoutes);
app.use("/api/inventory", protect, isAdmin, inventoryRoutes);
app.use("/api/analytics", protect, isAdmin, analyticsRoutes);
app.use("/api/sales", protect, isAdmin, saleRoutes);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(" 2-Week Background Prediction Scheduler Active");
});