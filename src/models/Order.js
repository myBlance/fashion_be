// models/Order.js
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, default: 1 },
      price: { type: Number }, // Giá bán tại thời điểm đặt hàng
      buyPrice: { type: Number }, // Giá nhập tại thời điểm đặt hàng (để tính lãi)
      selectedColor: { type: String },
      selectedSize: { type: String },
    }
  ],
  totalPrice: { type: Number, required: true }, // Tổng tiền cuối cùng (đã bao gồm ship và giảm giá)

  // THÊM MỚI: Phương thức vận chuyển
  shippingMethod: {
    type: String,
    enum: ['standard', 'express'],
    default: 'standard',
    required: true
  },

  // THÊM MỚI: Phí vận chuyển (để lưu lại giá ship tại thời điểm đặt)
  shippingFee: {
    type: Number,
    default: 0,
    required: true
  },

  // THÊM MỚI: Thông tin voucher
  voucherCode: { type: String, default: null },
  discountAmount: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  paymentMethod: { type: String, default: 'seepay' },
  shippingAddress: {
    fullName: String,
    phone: String,
    addressLine: String,
    city: String,
    district: String,
    ward: String,
    note: String,
  },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);