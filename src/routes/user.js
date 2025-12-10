const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const userController = require('../Controller/userController');

// Áp dụng middleware xác thực cho tất cả route dưới đây
router.use(protect);

// GET /api/users/profile
router.get('/profile', userController.getProfile);

// PUT /api/users/profile
router.put('/profile', [
  body('email').optional().isEmail().withMessage('Email không hợp lệ'),
  body('name').optional().trim().escape(),
  body('avatarUrl').optional().custom((value) => {
    const isUrl = /^https?:\/\/.+\..+/.test(value);
    const isDataUri = /^data:image\/[a-zA-Z]+;base64,/.test(value);
    if (!isUrl && !isDataUri) {
      throw new Error('Đường dẫn avatar không hợp lệ');
    }
    return true;
  }),
  body('phone').optional().isMobilePhone('vi-VN').withMessage('Số điện thoại không hợp lệ'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Giới tính không hợp lệ'),
  body('birthDate').optional().isISO8601().withMessage('Ngày sinh không hợp lệ'),
], userController.updateProfile);

// GET /api/users/addresses
router.get('/addresses', userController.getAddresses);

// POST /api/users/addresses
router.post('/addresses', [
  body('name').notEmpty().withMessage('Tên người nhận là bắt buộc'),
  body('phone').isMobilePhone('vi-VN').withMessage('Số điện thoại không hợp lệ'),
  body('address').notEmpty().withMessage('Địa chỉ là bắt buộc'),
  body('isDefault').optional().isBoolean().withMessage('isDefault phải là true hoặc false'),
], userController.addAddress);

// PUT /api/users/addresses/:id
router.put('/addresses/:id', [
  body('name').optional().notEmpty().withMessage('Tên người nhận là bắt buộc'),
  body('phone').optional().isMobilePhone('vi-VN').withMessage('Số điện thoại không hợp lệ'),
  body('address').optional().notEmpty().withMessage('Địa chỉ là bắt buộc'),
  body('isDefault').optional().isBoolean().withMessage('isDefault phải là true hoặc false'),
], userController.updateAddress);

// DELETE /api/users/addresses/:id
router.delete('/addresses/:id', userController.deleteAddress);

// PUT /api/users/change-password
router.put('/change-password', [
  body('password').notEmpty().withMessage('Mật khẩu hiện tại là bắt buộc'),
  body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự')
], userController.changePassword);

// routes/user.js (debug)
router.get('/debug-test', userController.debugTest);

module.exports = router;