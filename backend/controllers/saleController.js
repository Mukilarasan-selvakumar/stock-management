const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");

// Get sales history with date filtering
exports.getSalesHistory = async (req, res) => {
  try {
    const { startDate, endDate, limit = 100 } = req.query;
    let query = {};
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const sales = await Sale.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    // Format sales history
    const salesHistory = [];
    for (const sale of sales) {
      for (const item of sale.items) {
        console.log({item})
        salesHistory.push({
          date: sale.createdAt,
          orderId: sale._id,
          productId: item.productId,
          productName:  item._doc?.productName || item.productName || item.name,
          quantity: item.quantity,
          totalAmount: item.total,
          status: "completed",
          customerName: sale.customerName,
          email: sale.email
        });
      }
    }
    
    res.json(salesHistory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get top selling products
exports.getTopProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(0);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    const topProducts = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.name" },
          unitsSold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.total" }
        }
      },
      { $sort: { unitsSold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "productId",
          as: "productDetails"
        }
      },
      {
        $project: {
          productId: "$_id",
          productName: 1,
          category: { $arrayElemAt: ["$productDetails.category", 0] },
          unitsSold: 1,
          revenue: 1,
          price: { $arrayElemAt: ["$productDetails.price", 0] }
        }
      }
    ]);
    
    res.json(topProducts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get daily sales for chart
exports.getDailySales = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const dailySales = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          totalSales: { $sum: "$totalAmount" },
          totalUnits: { $sum: { $sum: "$items.quantity" } },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: "$_id",
          sales: "$totalSales",
          units: "$totalUnits",
          orders: "$orderCount"
        }
      }
    ]);
    
    // Fill missing dates with zero values
    const result = [];
    const currentDate = new Date(startDate);
    const today = new Date();
    
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const existing = dailySales.find(d => d.date === dateStr);
      
      result.push({
        date: dateStr,
        sales: existing ? existing.sales : 0,
        units: existing ? existing.units : 0,
        orders: existing ? existing.orders : 0
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get recent orders
exports.getRecentOrders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const recentSales = await Sale.find()
      .sort({ createdAt: -1 })
      .limit(limit);
    
    const recentOrders = recentSales.map(sale => ({
      orderId: sale._id,
      customerName: sale.customerName,
      email: sale.email,
      phone: sale.phone,
      items: sale.items.length,
      total: sale.totalAmount,
      status: "completed",
      createdAt: sale.createdAt
    }));
    
    res.json(recentOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get sales summary statistics
exports.getSalesSummary = async (req, res) => {
  try {
    const { period = "month" } = req.query; // week, month, year, all
    let startDate = new Date();
    
    switch(period) {
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(0);
    }
    
    const summary = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
          totalItems: { $sum: { $sum: "$items.quantity" } },
          averageOrderValue: { $avg: "$totalAmount" }
        }
      }
    ]);
    
    const result = summary[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      totalItems: 0,
      averageOrderValue: 0
    };
    
    // Get previous period comparison
    const previousStartDate = new Date(startDate);
    const previousEndDate = new Date(startDate);
    
    if (period === "week") {
      previousStartDate.setDate(previousStartDate.getDate() - 7);
    } else if (period === "month") {
      previousStartDate.setMonth(previousStartDate.getMonth() - 1);
    } else if (period === "year") {
      previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);
    }
    
    const previousSummary = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: previousStartDate, $lt: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" }
        }
      }
    ]);
    
    const previousRevenue = previousSummary[0]?.totalRevenue || 0;
    const growth = previousRevenue === 0 ? 100 : ((result.totalRevenue - previousRevenue) / previousRevenue) * 100;
    
    res.json({
      ...result,
      growth: Math.round(growth * 100) / 100,
      period
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create new sale (POS checkout)
exports.createSale = async (req, res) => {
  try {
    const { customerName, phone, email, items, totalAmount } = req.body;
    
    // Validate stock before creating sale
    for (const item of items) {
      const inventory = await Inventory.findOne({ productId: item.productId });
      if (!inventory || inventory.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product: ${item.name}. Available: ${inventory?.stock || 0}`
        });
      }
    }
    
    // Create sale
    const sale = new Sale({
      customerName,
      phone,
      email,
      items,
      totalAmount,
      status: "completed"
    });
    
    await sale.save();
    
    // Update inventory stock
    for (const item of items) {
      await Inventory.findOneAndUpdate(
        { productId: item.productId },
        { 
          $inc: { stock: -item.quantity },
          lastUpdated: Date.now()
        }
      );
    }
    
    res.status(201).json({
      message: "Sale completed successfully",
      sale
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get sale by ID
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get sales by customer
exports.getSalesByCustomer = async (req, res) => {
  try {
    const { email, phone } = req.query;
    let query = {};
    
    if (email) query.email = email;
    if (phone) query.phone = phone;
    
    const sales = await Sale.find(query).sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete sale (with stock restoration)
exports.deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }
    
    // Restore inventory stock
    for (const item of sale.items) {
      await Inventory.findOneAndUpdate(
        { productId: item.productId },
        { 
          $inc: { stock: item.quantity },
          lastUpdated: Date.now()
        }
      );
    }
    
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: "Sale deleted and stock restored successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};