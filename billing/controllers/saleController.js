const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const Sale = require("../models/Sale");
const Inventory = require("../models/Inventory");



const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});



const generateInvoicePDF = (sale) => {
  return new Promise((resolve, reject) => {
    const invoiceDir = path.join(__dirname, "../invoices");

    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }

    const pdfPath = path.join(
      invoiceDir,
      `Invoice-${sale._id}.pdf`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);


    doc
      .fontSize(24)
      .fillColor("#2563eb")
      .text("STOCK MANAGEMENT SYSTEM", {
        align: "center",
      });

    doc.moveDown(0.5);

    doc
      .fontSize(18)
      .fillColor("black")
      .text("SALES INVOICE", {
        align: "center",
      });

    doc.moveDown(2);


    doc.fontSize(12);

    doc.text(`Invoice ID: ${sale._id}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.text(`Customer Name: ${sale.customerName || "N/A"}`);
    doc.text(`Email: ${sale.email || "N/A"}`);
    doc.text(`Phone: ${sale.phone || "N/A"}`);

    doc.moveDown(2);


    const tableTop = doc.y;

    doc.rect(50, tableTop, 500, 25).fill("#2563eb");

    doc
      .fillColor("white")
      .fontSize(11)
      .text("Product", 60, tableTop + 7);

    doc.text("Qty", 260, tableTop + 7);

    doc.text("Price", 340, tableTop + 7);

    doc.text("Total", 450, tableTop + 7);

    let y = tableTop + 35;

    doc.fillColor("black");

    sale.items.forEach((item) => {
      doc.text(
        item.productName || item.productId,
        60,
        y
      );

      doc.text(
        String(item.quantity),
        260,
        y
      );

      doc.text(
        `₹${item.price}`,
        340,
        y
      );

      doc.text(
        `₹${item.total}`,
        450,
        y
      );

      y += 25;
    });

    y += 20;

    doc
      .fontSize(16)
      .fillColor("#16a34a")
      .text(
        `Grand Total: ₹${sale.totalAmount}`,
        300,
        y
      );

    y += 60;

    doc
      .fontSize(14)
      .fillColor("#2563eb")
      .text(
        "Thank You For Your Purchase!",
        {
          align: "center",
        }
      );

    doc.moveDown();

    doc
      .fontSize(11)
      .fillColor("black")
      .text(
        "We appreciate your business and look forward to serving you again.",
        {
          align: "center",
        }
      );

    doc.end();

    stream.on("finish", () => {
      resolve(pdfPath);
    });

    stream.on("error", reject);
  });
};



const sendInvoiceMail = async (sale) => {
  try {
    const pdfPath = await generateInvoicePDF(sale);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: sale.email,
      subject: `Invoice #${sale._id}`,

      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;">
        
          <h2 style="color:#2563eb;">
            Thank You ${sale.customerName || "Customer"}!
          </h2>

          <p>
            Your purchase was completed successfully.
          </p>

          <p>
            Total Amount:
            <strong>₹${sale.totalAmount}</strong>
          </p>

          <p>
            Your invoice has been attached as a PDF.
          </p>

          <br/>

          <p>
            We truly appreciate your business.
          </p>

          <p>
            Regards,<br/>
            Stock Management Team
          </p>

        </div>
      `,

      attachments: [
        {
          filename: `Invoice-${sale._id}.pdf`,
          path: pdfPath,
        },
      ],
    });

    console.log("Invoice email sent successfully");
  } catch (error) {
    console.error("Email Error:", error);
  }
};




exports.createSale = async (req, res) => {
  try {
    const {
      customerName,
      phone,
      email,
      items,
    } = req.body;

    if (!phone && !email) {
      return res.status(400).json({
        message: "Phone or Email required",
      });
    }

    let totalAmount = 0;

    const updatedItems = [];

    for (const item of items) {
      const updated =
        await Inventory.findOneAndUpdate(
          {
            productId: item.productId,
            stock: {
              $gte: item.quantity,
            },
          },
          {
            $inc: {
              stock: -item.quantity,
            },
          },
          {
            returnDocument: "after",
          }
        );

      if (!updated) {
        return res.status(400).json({
          message: `Not enough stock for ${item.productId}`,
        });
      }

      const itemTotal =
        item.price * item.quantity;

      updatedItems.push({
        productId: item.productId,
        productName:
          item.productName ||
          item.productId,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal,
      });

      totalAmount += itemTotal;
    }

    const sale = await Sale.create({
      customerName,
      phone,
      email,
      items: updatedItems,
      totalAmount,
    });

    if (
      sale.email &&
      sale.email.trim() !== ""
    ) {
      await sendInvoiceMail(sale);
    }

    res.status(201).json({
      message:
        "Sale created and invoice emailed successfully",
      sale,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
};