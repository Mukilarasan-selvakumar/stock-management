require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());


app.use("/sales", require("./routes/saleRoutes"));

const PORT = process.env.PORT || 6000;

app.listen(PORT, () => {
  console.log(`Billing Service running on port ${PORT}`);
});