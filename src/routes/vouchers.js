// routes/vouchers.js
const express = require('express');
const router = express.Router();
const Voucher = require('../models/Voucher');
const { body, validationResult } = require('express-validator');

// Middleware kiểm tra admin (nếu bạn có)
const adminAuth = (req, res, next) => {
  // Ví dụ: kiểm tra role admin
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Truy cập bị từ chối' });
  }
};

// ======================
// POST /api/vouchers
// ======================
router.post(
  '/',
  adminAuth,
  [
    body('code').notEmpty().withMessage('Mã voucher là bắt buộc'),
    body('discountType').isIn(['fixed', 'percent']).withMessage('discountType phải là fixed hoặc percent'),
    body('discountValue').isNumeric().withMessage('discountValue phải là số'),
    body('discountText').notEmpty().withMessage('discountText là bắt buộc'),
    body('minOrderValue').isNumeric().withMessage('minOrderValue phải là số'),
    body('shopName').notEmpty().withMessage('shopName là bắt buộc'),
    body('expiryDate').isISO8601().withMessage('expiryDate phải là định dạng ngày hợp lệ'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const newVoucher = new Voucher(req.body);
      await newVoucher.save();
      res.status(201).json({ success: true, data: newVoucher });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ success: false, message: 'Mã voucher đã tồn tại' });
      }
      res.status(500).json({ success: false, message: 'Lỗi server', error: err.message });
    }
  }
);

// ======================
// GET /api/vouchers
// ======================
router.get('/', async (req, res) => {
  try {
    const {
      shopName,
      isActive = true,
      page = 1,
      limit = 10,
      sort = '-createdAt',
      expired = false,
    } = req.query;

    let query = { isActive: isActive === 'true' };

    if (shopName) {
      query.shopName = { $regex: shopName, $options: 'i' };
    }

    if (expired === 'true') {
      query.expiryDate = { $lt: new Date() };
    } else {
      query.expiryDate = { $gte: new Date() };
    }

    const vouchers = await Voucher.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Voucher.countDocuments(query);

    res.status(200).json({
      success: true,
      data: vouchers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: err.message });
  }
});

// ======================
// GET /api/vouchers/:code
// ======================
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const voucher = await Voucher.findOne({
      code: code.toUpperCase(),
      isActive: true,
      expiryDate: { $gte: new Date() },
      usedCount: { $lt: '$usageLimit' }, // chưa hết lượt dùng
    });

    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Voucher không tồn tại hoặc đã hết hạn' });
    }

    res.status(200).json({ success: true, data: voucher });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: err.message });
  }
});

// ======================
// PUT /api/vouchers/:id
// ======================
router.put(
  '/:id',
  adminAuth,
  [
    body('discountValue').optional().isNumeric().withMessage('discountValue phải là số'),
    body('minOrderValue').optional().isNumeric().withMessage('minOrderValue phải là số'),
    body('expiryDate').optional().isISO8601().withMessage('expiryDate phải là định dạng ngày hợp lệ'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const updatedVoucher = await Voucher.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!updatedVoucher) {
        return res.status(404).json({ success: false, message: 'Voucher không tồn tại' });
      }

      res.status(200).json({ success: true, data: updatedVoucher });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ success: false, message: 'Mã voucher đã tồn tại' });
      }
      res.status(500).json({ success: false, message: 'Lỗi server', error: err.message });
    }
  }
);

// ======================
// DELETE /api/vouchers/:id
// ======================
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const deletedVoucher = await Voucher.findByIdAndDelete(req.params.id);

    if (!deletedVoucher) {
      return res.status(404).json({ success: false, message: 'Voucher không tồn tại' });
    }

    res.status(200).json({ success: true, message: 'Xóa voucher thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: err.message });
  }
});

module.exports = router;