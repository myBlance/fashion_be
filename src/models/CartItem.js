const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  productId: { type: String, ref: 'Product', required: true },
  name: String,
  color: String,
  size: String,
  price: Number,
  quantity: Number,
  image: String,
}, { timestamps: true });

module.exports = mongoose.model('CartItem', cartItemSchema);
