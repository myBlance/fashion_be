const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  brand: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  originalPrice: { type: Number, required: true },
  status: { type: Boolean, default: true },
  colors: { type: [String], required: true },
  type: { type: String, required: true },
  style: { type: String, required: true },
  sizes: { type: [String], required: true },
  sold: { type: Number, default: 0 },
  total: { type: Number, required: true },
  thumbnail: { type: String, required: true },
  images: { type: [String], required: true },
  sale: { type: Boolean, default: false },
  delivery: { type: String, required: true },
  createdAt: { type: String, required: true }
});

module.exports = mongoose.model('Product', productSchema);