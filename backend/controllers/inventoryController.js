const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

// Helper function to log stock movements
const logStockMovement = async (productId, productName, previousStock, newStock, type, reason, referenceId = null, referenceType = null, performedBy = 'system', metadata = {}) => {
  try {
    const change = newStock - previousStock;
    await StockMovement.create({
      productId,
      productName,
      previousStock,
      newStock,
      change,
      type,
      reason,
      referenceId,
      referenceType,
      performedBy,
      metadata
    });
  } catch (err) {
    console.error("Error logging stock movement:", err);
  }
};

// GET ALL with product details
exports.getInventory = async (req, res) => {
  try {
    const data = await Inventory.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "productId",
          as: "productDetails",
        },
      },
      {
        $unwind: {
          path: "$productDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          productId: 1,
          stock: 1,
          lastUpdated: 1,
          updatedAt: 1,
          productName: "$productDetails.name",
          category: "$productDetails.category",
          price: "$productDetails.price",
        },
      },
      {
        $sort: { lastUpdated: -1 }
      }
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET by ID
exports.getInventoryById = async (req, res) => {
  try {
    const data = await Inventory.aggregate([
      {
        $match: { _id: req.params.id }
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "productId",
          as: "productDetails",
        },
      },
      {
        $unwind: {
          path: "$productDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          productId: 1,
          stock: 1,
          lastUpdated: 1,
          productName: "$productDetails.name",
          category: "$productDetails.category",
          price: "$productDetails.price",
        },
      },
    ]);

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET by Product ID
exports.getInventoryByProductId = async (req, res) => {
  try {
    const { productId } = req.params;
    const data = await Inventory.aggregate([
      {
        $match: { productId: productId }
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "productId",
          as: "productDetails",
        },
      },
      {
        $unwind: {
          path: "$productDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          productId: 1,
          stock: 1,
          lastUpdated: 1,
          productName: "$productDetails.name",
          category: "$productDetails.category",
          price: "$productDetails.price",
        },
      },
    ]);

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Inventory not found for this product" });
    }

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET stock movement history
exports.getStockHistory = async (req, res) => {
  try {
    const { days = 30, productId, limit = 100 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    let query = { createdAt: { $gte: startDate } };
    if (productId) {
      query.productId = productId;
    }
    
    const movements = await StockMovement.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json(movements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET stock summary by product
exports.getStockSummary = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const movements = await StockMovement.find({ productId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    const totalAdded = movements
      .filter(m => m.change > 0)
      .reduce((sum, m) => sum + m.change, 0);
    
    const totalRemoved = movements
      .filter(m => m.change < 0)
      .reduce((sum, m) => sum + Math.abs(m.change), 0);
    
    const recentMovements = movements.slice(0, 10);
    
    res.json({
      productId,
      totalAdded,
      totalRemoved,
      netChange: totalAdded - totalRemoved,
      recentMovements
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// CREATE inventory (with product creation if needed)
exports.createInventory = async (req, res) => {
  try {
    const { productId, stock, name, category, price } = req.body;

    // Check if product exists
    let product = await Product.findOne({ productId });

    // If product doesn't exist, create it
    if (!product) {
      product = await Product.create({
        productId,
        name,
        category,
        price,
      });
    } else {
      // Optionally update product details if they are provided
      if (name || category || price) {
        await Product.findOneAndUpdate(
          { productId },
          {
            ...(name && { name }),
            ...(category && { category }),
            ...(price && { price }),
            updatedAt: Date.now()
          }
        );
      }
    }

    // Check if inventory already exists
    const existingInventory = await Inventory.findOne({ productId });
    if (existingInventory) {
      return res.status(400).json({ 
        message: "Inventory already exists for this product. Use update instead." 
      });
    }

    // Create inventory
    const item = await Inventory.create({
      productId,
      stock,
      lastUpdated: Date.now()
    });

    // Log stock movement for initial stock
    await logStockMovement(
      productId,
      product.name,
      0,
      stock,
      'RESTOCK',
      'Initial stock setup',
      null,
      null,
      req.user?.email || 'system',
      { createdBy: req.user?.email }
    );

    // Return with product details
    const result = {
      ...item.toObject(),
      productName: product.name,
      category: product.category,
      price: product.price
    };

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// UPDATE inventory
exports.updateInventory = async (req, res) => {
  try {
    const { stock, name, category, price, stockUpdateStrategy = 'overwrite', reason = 'Manual update' } = req.body;
    
    // Get current inventory item first
    const currentItem = await Inventory.findById(req.params.id);
    
    if (!currentItem) {
      return res.status(404).json({ message: "Inventory not found" });
    }
    
    // Get product details for name
    const product = await Product.findOne({ productId: currentItem.productId });
    
    // Calculate final stock based on strategy
    let finalStock;
    let changeType = 'MANUAL_EDIT';
    let changeReason = reason;
    
    if (stockUpdateStrategy === 'add') {
      // Add to existing stock
      finalStock = currentItem.stock + (stock || 0);
      changeReason = `Added ${stock} units - ${reason}`;
    } else {
      // Overwrite stock (default behavior)
      finalStock = stock;
      if (finalStock > currentItem.stock) {
        changeReason = `Increased from ${currentItem.stock} to ${finalStock} - ${reason}`;
      } else if (finalStock < currentItem.stock) {
        changeReason = `Reduced from ${currentItem.stock} to ${finalStock} - ${reason}`;
      } else {
        changeReason = `Stock unchanged - ${reason}`;
      }
    }
    
    const previousStock = currentItem.stock;
    
    // Update inventory with calculated stock
    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      { 
        stock: finalStock, 
        lastUpdated: Date.now(),
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    // Update product if details are provided
    if (name || category || price) {
      await Product.findOneAndUpdate(
        { productId: item.productId },
        {
          ...(name && { name }),
          ...(category && { category }),
          ...(price && { price }),
          updatedAt: Date.now()
        }
      );
    }

    // Log stock movement if stock changed
    if (previousStock !== finalStock) {
      await logStockMovement(
        item.productId,
        product?.name || 'Unknown',
        previousStock,
        finalStock,
        changeType,
        changeReason,
        item._id,
        'inventory_update',
        req.user?.email || 'system',
        { 
          strategy: stockUpdateStrategy,
          requestedChange: stock,
          previousProductDetails: { name, category, price }
        }
      );
    }

    // Get updated product details
    const updatedProduct = await Product.findOne({ productId: item.productId });

    const result = {
      ...item.toObject(),
      productName: updatedProduct?.name,
      category: updatedProduct?.category,
      price: updatedProduct?.price,
      stockUpdated: {
        oldStock: previousStock,
        addedStock: stockUpdateStrategy === 'add' ? stock : null,
        newStock: finalStock,
        strategy: stockUpdateStrategy
      }
    };

    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// UPDATE inventory by Product ID
exports.updateInventoryByProductId = async (req, res) => {
  try {
    const { productId } = req.params;
    const { stock, name, category, price } = req.body;
    
    // Get current inventory
    const currentItem = await Inventory.findOne({ productId });
    
    if (!currentItem) {
      return res.status(404).json({ message: "Inventory not found for this product" });
    }
    
    const previousStock = currentItem.stock;
    const product = await Product.findOne({ productId });
    
    // Update inventory
    const item = await Inventory.findOneAndUpdate(
      { productId },
      { 
        stock, 
        lastUpdated: Date.now(),
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Inventory not found for this product" });
    }

    // Update product if details are provided
    if (name || category || price) {
      await Product.findOneAndUpdate(
        { productId },
        {
          ...(name && { name }),
          ...(category && { category }),
          ...(price && { price }),
          updatedAt: Date.now()
        }
      );
    }

    // Log stock movement
    if (previousStock !== stock) {
      await logStockMovement(
        productId,
        product?.name || 'Unknown',
        previousStock,
        stock,
        'MANUAL_EDIT',
        `Direct update from ${previousStock} to ${stock}`,
        item._id,
        'inventory_update',
        req.user?.email || 'system'
      );
    }

    // Get updated product details
    const updatedProduct = await Product.findOne({ productId });

    const result = {
      ...item.toObject(),
      productName: updatedProduct?.name,
      category: updatedProduct?.category,
      price: updatedProduct?.price
    };

    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE inventory
exports.deleteInventory = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: "Inventory not found" });
    }
    
    // Log deletion
    await logStockMovement(
      item.productId,
      'Unknown',
      item.stock,
      0,
      'ADJUSTMENT',
      'Inventory deleted',
      item._id,
      'deletion',
      req.user?.email || 'system'
    );
    
    await Inventory.findByIdAndDelete(req.params.id);
    
    res.json({ message: "Inventory deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE inventory and associated product (optional)
exports.deleteInventoryAndProduct = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: "Inventory not found" });
    }
    
    // Log deletion
    await logStockMovement(
      item.productId,
      'Unknown',
      item.stock,
      0,
      'ADJUSTMENT',
      'Inventory and product deleted',
      item._id,
      'deletion',
      req.user?.email || 'system'
    );
    
    // Delete inventory
    await Inventory.findByIdAndDelete(req.params.id);
    
    // Delete associated product
    await Product.findOneAndDelete({ productId: item.productId });
    
    res.json({ message: "Inventory and associated product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// BULK IMPORT - Create or update multiple inventory items
exports.bulkImportInventory = async (req, res) => {
  try {
    const { items, updateStrategy = 'add' } = req.body;
    let created = 0;
    let updated = 0;
    let errors = [];

    for (const item of items) {
      try {
        const { productId, stock, name, category, price, updateStrategy: itemStrategy } = item;
        const strategy = itemStrategy || updateStrategy;

        // Validate required fields (only productId and stock are required)
        if (!productId || stock === undefined || stock === null) {
          errors.push({ productId, error: "Missing required fields (productId and stock are required)" });
          continue;
        }

        // Handle Product - only update fields that have values
        let product = await Product.findOne({ productId });
        
        if (!product) {
          // Create new product with only provided fields
          const productData = {
            productId,
            name: name || "Unknown Product",
            category: category || "Uncategorized",
            price: (price !== undefined && price !== null && price !== "") ? price : 0
          };
          
          product = await Product.create(productData);
          created++;
        } else {
          // Update existing product - only update fields that have values
          const updateData = {};
          
          if (name && name !== "") {
            updateData.name = name;
          }
          
          if (category && category !== "") {
            updateData.category = category;
          }
          
          if (price !== undefined && price !== null && price !== "" && !isNaN(parseFloat(price))) {
            updateData.price = parseFloat(price);
          }
          
          // Only update if there are fields to update
          if (Object.keys(updateData).length > 0) {
            updateData.updatedAt = Date.now();
            await Product.findOneAndUpdate(
              { productId },
              updateData
            );
          }
        }

        // Handle Inventory with update strategy
        const existingInventory = await Inventory.findOne({ productId });
        const previousStock = existingInventory ? existingInventory.stock : 0;
        let newStock;
        let changeType = 'IMPORT';
        
        // Stock is always required for import
        const stockValue = parseInt(stock);
        if (isNaN(stockValue)) {
          errors.push({ productId, error: "Invalid stock value" });
          continue;
        }
        
        if (existingInventory) {
          if (strategy === 'add') {
            newStock = existingInventory.stock + stockValue;
            changeType = 'RESTOCK';
          } else {
            newStock = stockValue;
            changeType = 'BULK_UPDATE';
          }
          
          // Update existing inventory
          await Inventory.findOneAndUpdate(
            { productId },
            { 
              stock: newStock, 
              lastUpdated: Date.now(),
              updatedAt: Date.now()
            }
          );
          updated++;
        } else {
          // Create new inventory
          newStock = stockValue;
          await Inventory.create({
            productId,
            stock: newStock,
            lastUpdated: Date.now()
          });
          created++;
        }

        // Get product name for logging
        const productName = product ? product.name : (name || "Unknown Product");

        // Log stock movement
        await logStockMovement(
          productId,
          productName,
          previousStock,
          newStock,
          changeType,
          `Bulk import: ${strategy === 'add' ? `added ${stockValue} units` : `set to ${stockValue} units`}`,
          null,
          'bulk_import',
          req.user?.email || 'system',
          { 
            batchSize: items.length,
            strategy,
            importData: item
          }
        );
        
      } catch (error) {
        errors.push({ productId: item.productId, error: error.message });
      }
    }

    res.status(200).json({
      message: "Bulk import completed",
      summary: {
        created,
        updated,
        errors: errors.length
      },
      errors: errors.slice(0, 20)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET low stock items
exports.getLowStock = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    
    const data = await Inventory.aggregate([
      {
        $match: { stock: { $lte: threshold } }
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "productId",
          as: "productDetails",
        },
      },
      {
        $unwind: {
          path: "$productDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          productId: 1,
          stock: 1,
          lastUpdated: 1,
          productName: "$productDetails.name",
          category: "$productDetails.category",
          price: "$productDetails.price",
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET inventory stats with movement summary
exports.getInventoryStats = async (req, res) => {
  try {
    const inventory = await Inventory.find();
    const products = await Product.find();
    
    let totalStock = 0;
    let totalValue = 0;
    let understock = 0;
    let overstock = 0;
    let optimal = 0;
    
    // Get last 30 days movements summary
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentMovements = await StockMovement.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$type',
          totalAdded: { $sum: { $cond: [{ $gt: ['$change', 0] }, '$change', 0] } },
          totalRemoved: { $sum: { $cond: [{ $lt: ['$change', 0] }, { $abs: '$change' }, 0] } },
          count: { $sum: 1 }
        }
      }
    ]);
    
    for (const item of inventory) {
      const product = products.find(p => p.productId === item.productId);
      const price = product?.price || 0;
      
      totalStock += item.stock;
      totalValue += price * item.stock;
      
      // Stock categorization
      if (item.stock < 10) understock++;
      else if (item.stock > 100) overstock++;
      else optimal++;
    }
    
    // Get total movements count
    const totalMovements = await StockMovement.countDocuments();
    const last30DaysMovements = await StockMovement.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    res.json({
      totalProducts: inventory.length,
      totalStock,
      totalValue: Math.round(totalValue * 100) / 100,
      understock,
      overstock,
      optimal,
      movementSummary: {
        totalMovements,
        last30DaysMovements,
        recentMovements
      }
    });
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET stock movement analytics
exports.getStockMovementAnalytics = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get daily stock movement summary
    const dailyMovements = await StockMovement.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$type"
          },
          totalAdded: { $sum: { $cond: [{ $gt: ['$change', 0] }, '$change', 0] } },
          totalRemoved: { $sum: { $cond: [{ $lt: ['$change', 0] }, { $abs: '$change' }, 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.date": 1 } }
    ]);
    
    // Get top products with most movements
    const topMovingProducts = await StockMovement.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$productId",
          productName: { $first: "$productName" },
          totalMovements: { $sum: 1 },
          totalAdded: { $sum: { $cond: [{ $gt: ['$change', 0] }, '$change', 0] } },
          totalRemoved: { $sum: { $cond: [{ $lt: ['$change', 0] }, { $abs: '$change' }, 0] } },
          netChange: { $sum: "$change" }
        }
      },
      { $sort: { totalMovements: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      dailyMovements,
      topMovingProducts,
      summary: {
        totalDays: days,
        startDate,
        endDate: new Date()
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Manual stock adjustment with reason
exports.adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation, reason } = req.body;
    
    if (!['add', 'subtract', 'set'].includes(operation)) {
      return res.status(400).json({ message: "Invalid operation. Use 'add', 'subtract', or 'set'" });
    }
    
    const currentItem = await Inventory.findById(id);
    
    if (!currentItem) {
      return res.status(404).json({ message: "Inventory not found" });
    }
    
    const product = await Product.findOne({ productId: currentItem.productId });
    let newStock;
    let changeAmount;
    
    switch(operation) {
      case 'add':
        changeAmount = quantity;
        newStock = currentItem.stock + quantity;
        break;
      case 'subtract':
        changeAmount = -quantity;
        newStock = currentItem.stock - quantity;
        if (newStock < 0) {
          return res.status(400).json({ message: "Stock cannot be negative" });
        }
        break;
      case 'set':
        changeAmount = quantity - currentItem.stock;
        newStock = quantity;
        break;
    }
    
    const item = await Inventory.findByIdAndUpdate(
      id,
      { 
        stock: newStock, 
        lastUpdated: Date.now(),
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    // Log the adjustment
    await logStockMovement(
      currentItem.productId,
      product?.name || 'Unknown',
      currentItem.stock,
      newStock,
      'ADJUSTMENT',
      reason || `Manual ${operation} of ${Math.abs(quantity)} units`,
      item._id,
      'stock_adjustment',
      req.user?.email || 'system',
      { operation, quantity, reason }
    );
    
    res.json({
      message: "Stock adjusted successfully",
      item,
      adjustment: {
        operation,
        quantity,
        previousStock: currentItem.stock,
        newStock,
        change: changeAmount
      }
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};