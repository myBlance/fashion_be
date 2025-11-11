const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true, // đã tự tạo index
    uppercase: true,
    trim: true,
  },
  discountType: {
    type: String,
    enum: ['fixed', 'percent'],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  discountText: {
    type: String,
    required: true,
  },
  conditionText: {
    type: String,
    required: true,
  },
  minOrderValue: {
    type: Number,
    required: true,
    default: 0,
  },
  shopName: {
    type: String,
    required: true,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  isFreeShip: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  usageLimit: {
    type: Number,
    default: 100,
  },
  usedCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

voucherSchema.index({ expiryDate: 1 });
voucherSchema.index({ isActive: 1 });
voucherSchema.index({ shopName: 1 });

module.exports = mongoose.model('Voucher', voucherSchema);
