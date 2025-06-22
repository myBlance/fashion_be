const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  brand: { type: String }, // Bỏ required tạm thời
  price: { type: Number, required: true },
  category: { type: String }, // Bỏ required tạm thời
  originalPrice: { type: Number }, // Bỏ required tạm thời
  status: { type: String, enum: ['selling', 'stopped'], default: 'selling' },
  type: { type: String }, // Bỏ required tạm thời
  style: { type: String }, // Bỏ required tạm thời
  colors: { type: [String], default: [] },
  sizes: { type: [String], default: [] },
  sold: { type: Number, default: 0 },
  total: { type: Number, default: 0 }, // Bỏ required
  thumbnail: { type: String, default: 'default.jpg' }, // Bỏ required
  images: { type: [String], default: ['default.jpg'] }, // Bỏ required
  sale: { type: Boolean, default: false },
  delivery: { type: String }, // Bỏ required tạm thời
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);