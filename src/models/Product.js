const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  brand: {
    type: String,
    required: true,
    default: 'DOLASTYLE'
  },
  price: { type: Number, required: true },
  importPrice: { type: Number, default: 0 }, // Giá nhập để tính lợi nhuận
  originalPrice: { type: Number },
  type: { type: String },
  status: { type: String, enum: ['selling', 'stopped', 'sold_out'], default: 'selling' },
  style: { type: [String], default: [] },
  colors: { type: [String], default: [] },
  sizes: { type: [String], default: [] },
  sold: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  thumbnail: { type: String, default: ' ' },
  images: { type: [String], default: ['default.jpg'] },
  createdAt: { type: Date, default: Date.now },
  description: { type: String },
  details: { type: String },
  // 🔹 New Variants Field
  variants: [{
    color: String,
    size: String,
    quantity: { type: Number, default: 0 },
    sold: { type: Number, default: 0 }
  }]
});

module.exports = mongoose.model('Product', productSchema);