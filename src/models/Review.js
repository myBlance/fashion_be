const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  orderId: { type: String, required: true },     // nếu orderId là string (ví dụ từ hệ thống bên ngoài)
  productId: { type: String, required: true }, // lưu mã sản phẩm
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  images: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
