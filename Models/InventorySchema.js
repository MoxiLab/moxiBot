const mongoose = require('mongoose');

const InventoryItemSchema = new mongoose.Schema({
    // Stable catalog identifier (e.g. "mejoras/expansion-de-mochila")
    itemId: { type: String, required: true },
    // Backward-compatible fields: optional, prefer catalog lookup by itemId
    name: { type: String },
    category: { type: String },
    amount: { type: Number, default: 1 },
    obtainedAt: { type: Date, default: Date.now },
    attributes: { type: Object },
});

const InventorySchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    items: [InventoryItemSchema],
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Inventory', InventorySchema);
