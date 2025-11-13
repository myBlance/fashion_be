// models/UserVoucher.js
const mongoose = require('mongoose');

const userVoucherSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher',
    required: true,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order', // nếu có hệ thống đơn hàng
    default: null,
  },
}, {
  timestamps: true, // createdAt = ngày nhận voucher
});

// Đảm bảo 1 user không nhận cùng 1 voucher nhiều lần (trừ khi maxUsesPerUser > 1 và cho phép duplicate)
userVoucherSchema.index({ userId: 1, voucherId: 1, usedAt: 1 });

module.exports = mongoose.model('UserVoucher', userVoucherSchema);