// routes/voucherRoutes.js
const express = require('express');
const router = express.Router();
const { 
  createVoucher, getAllVouchers, getVoucherById, updateVoucher, deleteVoucher,
  claimVoucher, getUserVouchers
} = require('../Controller/voucherController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public: Xem chi tiết voucher theo ID (ai cũng xem được)
// ✅ Phải để dưới cùng, sau các route cụ thể
router.get('/public', getAllVouchers); // ✅ Không cần auth

// ✅ Route cụ thể trước
router.get('/debug', protect, (req, res) => {
  console.log('DEBUG: /debug được gọi');
  res.json({ user: req.user, timestamp: new Date() });
});

// ✅ Route cụ thể trước
router.get('/my', protect, getUserVouchers); // yêu cầu auth

// ✅ Route nhận tham số phải để ở cuối
router.get('/:id', getVoucherById); // ✅ Phải để cuối cùng

// Admin: CRUD
router.post('/', protect, admin, createVoucher);
router.get('/', protect, admin, getAllVouchers); // dành cho admin
router.put('/:id', protect, admin, updateVoucher);
router.delete('/:id', protect, admin, deleteVoucher);

// Client: Voucher cá nhân
router.post('/claim', protect, claimVoucher); // yêu cầu auth

module.exports = router;