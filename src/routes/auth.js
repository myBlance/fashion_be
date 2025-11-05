require('dotenv').config(); // Nếu bạn chưa gọi ở server.js thì giữ dòng này
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Validate JWT secret
if (!process.env.JWT_SECRET) {
  throw new Error('Missing JWT_SECRET in environment variables');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ username và password' });
  }

  try {
    // tìm user theo username hoặc email
    const user = await User.findOne({ 
      $or: [
        { username: username }, 
        { email: username } 
      ] 
    });

    if (!user) {
      return res.status(401).json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    const token = jwt.sign(
      { username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Đăng nhập thành công',
      role: user.role,
      userId: user._id,
      token,
    });
  } catch (err) {
    console.error('Lỗi khi đăng nhập:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});


// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, phone, password, confirm } = req.body;

  if (!firstName || !lastName || !email || !phone || !password || !confirm) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
  }

  if (password !== confirm) {
    return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' });
  }

  try {
    const existingUser = await User.findOne({ username: email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email đã được sử dụng.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username: email, // dùng email làm username
      email,
      password: hashedPassword,
      name: `${lastName} ${firstName}`,
      role: 'client',
      phone,
    });

    await newUser.save();

    res.status(201).json({ message: 'Đăng ký thành công.' });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
