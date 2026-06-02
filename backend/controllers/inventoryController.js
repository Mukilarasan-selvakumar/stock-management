const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
// GET ALL
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




exports.createInventory = async (req, res) => {
  try {
    const { productId, stock, name, category, price } = req.body;

    
    let product = await Product.findOne({ productId });

    
    if (!product) {
      product = await Product.create({
        productId,
        name,
        category,
        price,
      });
    }

    
    const item = await Inventory.create({
      productId,
      stock,
    });

    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


exports.updateInventory = async (req, res) => {
  const item = await Inventory.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(item);
};


exports.deleteInventory = async (req, res) => {
  await Inventory.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
};