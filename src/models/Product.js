const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  brand: { type: String },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  category: { type: String },
  status: { type: String, enum: ['selling','stopped','sold_out'], default: 'selling' },
  type: { type: String },
  style: { type: String },
  colors: { type: [String], default: [] },
  sizes: { type: [String], default: [] },
  sold: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  thumbnail: { type: String, default: '/assets/images/xanh.webp' },
  images: { type: [String], default: ['default.jpg'] },
  delivery: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
