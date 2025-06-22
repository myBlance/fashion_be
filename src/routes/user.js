const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// Áp dụng middleware xác thực cho tất cả route dưới đây
router.use(authMiddleware);

/**
 * @route   GET /api/users/profile
 * @desc    Lấy thông tin cá nhân người dùng
 * @access  Private
 */
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username }).select('-password -__v -createdAt -updatedAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Lỗi khi lấy profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Cập nhật thông tin cá nhân người dùng
 * @access  Private
 */
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

], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { name, email, avatarUrl} = req.body;

  try {
    const user = await User.findOne({ username: req.user.username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    
    // Cập nhật các trường khác
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      data: {
        username: user.username,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl
      }
    });

  } catch (error) {
    console.error('Lỗi khi cập nhật profile:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng bởi người khác'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/users/change-password
 * @desc    Đổi mật khẩu người dùng
 * @access  Private
 */
router.put('/change-password', [
  body('password').notEmpty().withMessage('Mật khẩu hiện tại là bắt buộc'),
  body('newPassword').isLength({ min: 1 }).withMessage('Mật khẩu mới phải có ít nhất 1 ký tự')
], async (req, res) => {
  const errors = validationResult(req);
 if (!errors.isEmpty()) {
  console.log('Lỗi validation:', errors.array());
  return res.status(400).json({ success: false, errors: errors.array() });
}


  const { password, newPassword } = req.body;

  try {
    const user = await User.findOne({ username: req.user.username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công' });

  } catch (error) {
    console.error('Lỗi khi đổi mật khẩu:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});


module.exports = router;
