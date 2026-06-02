const cron = require("node-cron");
const nodemailer = require("nodemailer");
const axios = require("axios"); // Use axios since this is within the node server
const User = require("../models/User");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
// We'll reuse the model we defined for prediction results
const PredictionResult = mongoose.model("PredictionResult");

// EMAIL CONFIG (Placeholder - User should fill real creds in .env)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPredictionReport = async () => {
  try {
    console.log("Sending Analytics Dashboard Notification...");

    // Find Admins & Super Admins
    const recipients = await User.find({
      role: { $in: ["admin", "superadmin"] },
    });

    if (recipients.length === 0) {
      return console.log("No admin users found.");
    }

    const recipientEmails = recipients
      .map((u) => u.email)
      .join(",");

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2> Inventory Analytics Dashboard</h2>

        <p>Hello,</p>

        <p>
          The inventory analytics dashboard has been updated.
          Please review the latest stock predictions and inventory insights.
        </p>

        <p style="margin:20px 0;">
          <a
            href="http://localhost:5173/analytics"
            style="
              background:#1677ff;
              color:white;
              padding:10px 20px;
              text-decoration:none;
              border-radius:5px;
            "
          >
            Open Analytics Dashboard
          </a>
        </p>

        <p>
          URL:
          http://localhost:5173/analytics
        </p>

        <hr>

        <p style="font-size:12px;color:gray;">
          AI Inventory Optimization System
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"AI Stock System" <${process.env.EMAIL_USER}>`,
      to: recipientEmails,
      subject: "📊 Inventory Analytics Dashboard",
      html: htmlContent,
    });

    console.log("✅ Email sent successfully");
  } catch (err) {
    console.error("❌ Email Error:", err.message);
  }
};

//  SCHEDULE: Every 2 weeks (1st and 15th of the month at midnight)
// Cron: 0 0 1,15 * *
cron.schedule("0 0 1,15 * *", sendPredictionReport);
// cron.schedule("*/30 * * * * *", sendPredictionReport);

// For testing: run every minute (Uncomment to test)
// cron.schedule("* * * * *", sendPredictionReport);

module.exports = { sendPredictionReport };
