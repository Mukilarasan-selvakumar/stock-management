const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require("./routes/userRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");

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

app.use(express.json());
app.use(cookieParser());

// 🔥 ROUTES
app.use('/api/auth', authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/inventory", inventoryRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));