const { Schema, model } = require('mongoose');

const wishlistSchema = new Schema({
  userId: { type: String, required: true },   // lưu trực tiếp userId dạng string
  productId: { type: String, required: true },
}, { timestamps: true });

module.exports = model('WishlistItem', wishlistSchema);
