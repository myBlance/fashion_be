// models/Voucher.js
const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },

  // Loại giảm: phần trăm hoặc cố định
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true,
  },
  value: {
    type: Number,
    required: true, // ví dụ: 10% hoặc 50000 VND
    min: 0,
  },

  // Điều kiện áp dụng
  minOrderAmount: {
    type: Number,
    default: 0,
  },

  // Ngày hiệu lực
  validFrom: {
    type: Date,
    required: true,
  },
  validUntil: {
    type: Date,
    required: true,
  },

  // Giới hạn
  maxUses: {
    type: Number,
    default: 1, // 1 lần dùng toàn hệ thống (nếu là voucher chung)
  },
  maxUsesPerUser: {
    type: Number,
    default: 1, // 1 lần dùng mỗi người
  },
  usedCount: {
    type: Number,
    default: 0,
  },

  // Trạng thái
  isActive: {
    type: Boolean,
    default: true,
  },

  // Người tạo (admin)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Voucher', voucherSchema);