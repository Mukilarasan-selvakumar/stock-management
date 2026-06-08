const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      index: true
    },
    productName: {
      type: String,
      required: true
    },
    previousStock: {
      type: Number,
      required: true
    },
    newStock: {
      type: Number,
      required: true
    },
    change: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['SALE', 'RESTOCK', 'IMPORT', 'ADJUSTMENT', 'BULK_UPDATE', 'MANUAL_EDIT'],
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    referenceId: {
      type: String, // Can store sale ID, order ID, etc.
      default: null
    },
    referenceType: {
      type: String, // 'sale', 'purchase', 'import', etc.
      default: null
    },
    performedBy: {
      type: String, // User email or ID who performed the action
      default: 'system'
    },
    notes: {
      type: String,
      default: null
    },
    metadata: {
      type: Object,
      default: {}
    }
  },
  { 
    timestamps: true 
  }
);

// Create indexes for better query performance
stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1 });

module.exports = mongoose.model("StockMovement", stockMovementSchema);