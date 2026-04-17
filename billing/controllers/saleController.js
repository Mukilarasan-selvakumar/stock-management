const Sale = require("../models/Sale");
const Inventory = require("../models/Inventory");


exports.createSale = async (req, res) => {
  try {
    const { customerName, phone, email, items } = req.body;

    if (!phone && !email) {
      return res.status(400).json({
        message: "Phone or Email required",
      });
    }

    let totalAmount = 0;
    const updatedItems = [];

    for (let item of items) {
      // ✅ ATOMIC STOCK REDUCTION
      const updated = await Inventory.findOneAndUpdate(
        {
          productId: item.productId,
          stock: { $gte: item.quantity }, // ensures enough stock
        },
        {
          $inc: { stock: -item.quantity },
        },
        { new: true }
      );

      if (!updated) {
        return res.status(400).json({
          message: `Not enough stock for ${item.productId}`,
        });
      }

      // ✅ calculate total
      const itemTotal = item.price * item.quantity;

      updatedItems.push({
        ...item,
        total: itemTotal,
      });

      totalAmount += itemTotal;
    }

    // ✅ SAVE SALE
    const sale = await Sale.create({
      customerName,
      phone,
      email,
      items: updatedItems,
      totalAmount,
    });

    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};