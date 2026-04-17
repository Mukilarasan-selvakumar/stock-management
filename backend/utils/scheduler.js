const cron = require("node-cron");
const nodemailer = require("nodemailer");
const axios = require("axios"); // Use axios since this is within the node server
const User = require("../models/User");
const mongoose = require("mongoose");

// We'll reuse the model we defined for prediction results
const PredictionResult = mongoose.model("PredictionResult");

// 📧 EMAIL CONFIG (Placeholder - User should fill real creds in .env)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPredictionReport = async () => {
  try {
    console.log("🚀 Starting Automatic 2-Week Stock Prediction & Report...");

    // 1. Trigger the pipeline via the Python services (running on 7000 and 8000)
    // First, preprocess
    await axios.post("http://localhost:7000/process-all");
    // Next, predict
    await axios.post("http://localhost:8000/predict-all");

    // 2. Fetch results from DB
    const results = await PredictionResult.find();
    
    if (results.length === 0) return console.log("No prediction results to send.");

    // 3. Find target recipients (Admins and Superadmins)
    const recipients = await User.find({ role: { $in: ["admin", "superadmin"] } });
    if (recipients.length === 0) return console.log("No admin users found to email.");

    const recipientEmails = recipients.map(u => u.email).join(",");

    // 4. Build Email Content
    const underStockItems = results.filter(r => r.stock_status === "Understock");
    
    let htmlContent = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #1890ff;">📦 Bi-Weekly Stock Prediction Report</h2>
        <p>This is an automated report generated for the next 14 days.</p>
        
        <h3 style="color: #cf1322;">🚨 Critical: Understock Alert (${underStockItems.length} items)</h3>
        <table border="1" style="width: 100%; border-collapse: collapse; text-align: left;">
          <tr style="background: #fff1f0;">
            <th>Product</th><th>Predicted Demand</th><th>Recommended Reorder</th>
          </tr>
          ${underStockItems.map(item => `
            <tr>
              <td>${item.productName} (${item.productId})</td>
              <td>${item.predicted_demand}</td>
              <td style="color: #cf1322; font-weight: bold;">${item.recommended_qty}</td>
            </tr>
          `).join("")}
        </table>

        <p style="margin-top: 20px;">Please check the full <a href="http://localhost:5173/analytics">Analytics Dashboard</a> for all product details.</p>
        <hr/>
        <p style="font-size: 12px; color: #888;">AI Inventory Optimization System</p>
      </div>
    `;

    // 5. Send Mail
    await transporter.sendMail({
      from: `"AI Stock System" <${process.env.EMAIL_USER}>`,
      to: recipientEmails,
      subject: "📊 Bi-Weekly Inventory Prediction & Alerts",
      html: htmlContent,
    });

    console.log("✅ Prediction report sent successfully to:", recipientEmails);
  } catch (err) {
    console.error("❌ Scheduler Error:", err.message);
  }
};

// 🗓️ SCHEDULE: Every 2 weeks (1st and 15th of the month at midnight)
// Cron: 0 0 1,15 * *
cron.schedule("0 0 1,15 * *", sendPredictionReport);

// For testing: run every minute (Uncomment to test)
// cron.schedule("* * * * *", sendPredictionReport);

module.exports = { sendPredictionReport };
