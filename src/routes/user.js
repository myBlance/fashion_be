const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware'); // ✅ Sửa ở đây

// Áp dụng middleware xác thực cho tất cả route dưới đây
router.use(protect);

/**
 * @route   GET /api/users/profile
 * @desc    Lấy thông tin cá nhân người dùng (bao gồm địa chỉ)
 * @access  Private
 */
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username })
      .select('-password -__v -createdAt -updatedAt');

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
 * @desc    Cập nhật thông tin cá nhân người dùng (không bao gồm mật khẩu)
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
  body('phone').optional().isMobilePhone('vi-VN').withMessage('Số điện thoại không hợp lệ'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Giới tính không hợp lệ'),
  body('birthDate').optional().isISO8601().withMessage('Ngày sinh không hợp lệ'),

], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { name, email, avatarUrl, phone, gender, birthDate } = req.body;

  try {
    const user = await User.findOne({ username: req.user.username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    // Cập nhật các trường
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (phone !== undefined) user.phone = phone;
    if (gender !== undefined) user.gender = gender;
    if (birthDate !== undefined) user.birthDate = birthDate;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      data: {
        username: user.username,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        gender: user.gender,
        birthDate: user.birthDate,
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
 * @route   GET /api/users/addresses
 * @desc    Lấy danh sách địa chỉ người dùng
 * @access  Private
 */
router.get('/addresses', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username }).select('addresses');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    return res.status(200).json({
      success: true,
      data: user.addresses
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách địa chỉ:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
});

/**
 * @route   POST /api/users/addresses
 * @desc    Thêm địa chỉ mới
 * @access  Private
 */
router.post('/addresses', [
  body('name').notEmpty().withMessage('Tên người nhận là bắt buộc'),
  body('phone').isMobilePhone('vi-VN').withMessage('Số điện thoại không hợp lệ'),
  body('address').notEmpty().withMessage('Địa chỉ là bắt buộc'),
  body('isDefault').optional().isBoolean().withMessage('isDefault phải là true hoặc false'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  let { name, phone, address, isDefault } = req.body;

  try {
    const user = await User.findOne({ username: req.user.username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    // Nếu địa chỉ mới được đặt làm mặc định, xóa trạng thái mặc định của các địa chỉ khác
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    // Nếu không có địa chỉ nào và đây là địa chỉ đầu tiên, đặt làm mặc định
    if (user.addresses.length === 0) {
      isDefault = true;
    }

    const newAddress = { name, phone, address, isDefault };
    user.addresses.push(newAddress);

    await user.save();

    // ✅ Trả về địa chỉ vừa được thêm (có _id từ MongoDB)
    const addedAddress = user.addresses[user.addresses.length - 1];
    return res.status(200).json({
      success: true,
      message: 'Thêm địa chỉ thành công',
      data: addedAddress
    });

  } catch (error) {
    console.error('Lỗi khi thêm địa chỉ:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
});

/**
 * @route   PUT /api/users/addresses/:id
 * @desc    Cập nhật địa chỉ
 * @access  Private
 */
router.put('/addresses/:id', [
  body('name').optional().notEmpty().withMessage('Tên người nhận là bắt buộc'),
  body('phone').optional().isMobilePhone('vi-VN').withMessage('Số điện thoại không hợp lệ'),
  body('address').optional().notEmpty().withMessage('Địa chỉ là bắt buộc'),
  body('isDefault').optional().isBoolean().withMessage('isDefault phải là true hoặc false'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { name, phone, address, isDefault } = req.body;

  try {
    const user = await User.findOne({ username: req.user.username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    const addrIndex = user.addresses.findIndex(addr => addr._id.toString() === req.params.id);

    if (addrIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Địa chỉ không tồn tại'
      });
    }

    // Nếu địa chỉ được cập nhật thành mặc định, xóa trạng thái mặc định của các địa chỉ khác
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    // Cập nhật địa chỉ
    if (name !== undefined) user.addresses[addrIndex].name = name;
    if (phone !== undefined) user.addresses[addrIndex].phone = phone;
    if (address !== undefined) user.addresses[addrIndex].address = address;
    if (isDefault !== undefined) user.addresses[addrIndex].isDefault = isDefault;

    await user.save();

    // ✅ Trả về địa chỉ đã được cập nhật
    return res.status(200).json({
      success: true,
      message: 'Cập nhật địa chỉ thành công',
      data: user.addresses[addrIndex]
    });

  } catch (error) {
    console.error('Lỗi khi cập nhật địa chỉ:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
});

/**
 * @route   DELETE /api/users/addresses/:id
 * @desc    Xóa địa chỉ
 * @access  Private
 */
router.delete('/addresses/:id', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    const addrIndex = user.addresses.findIndex(addr => addr._id.toString() === req.params.id);

    if (addrIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Địa chỉ không tồn tại'
      });
    }

    user.addresses.splice(addrIndex, 1);

    // Nếu xóa địa chỉ mặc định, đặt địa chỉ đầu tiên làm mặc định
    if (user.addresses.length > 0 && !user.addresses.some(addr => addr.isDefault)) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Xóa địa chỉ thành công',
      data: user.addresses
    });

  } catch (error) {
    console.error('Lỗi khi xóa địa chỉ:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
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
  body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự')
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

// routes/user.js
router.get('/debug-test', async (req, res) => {
  console.log('👤 /users/debug-test được gọi, req.user =', req.user);
  res.json({ message: 'OK from user route', user: req.user });
});

module.exports = router;