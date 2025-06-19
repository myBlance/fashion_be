require('dotenv').config(); 
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Add validation for the JWT secret
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
    const user = await User.findOne({ username });

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
      token,
    });
  } catch (err) {
    console.error('Lỗi khi đăng nhập:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// POST /api/auth/register
// router.post('/register', async (req, res) => {
//   const { firstName, lastName, email, phone, password, confirm } = req.body;

//   if (!firstName || !lastName || !email || !phone || !password || !confirm) {
//     return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
//   }

//   if (password !== confirm) {
//     return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' });
//   }

//   try {
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(409).json({ message: 'Email đã được sử dụng.' });
//     }

//     const newUser = new User({
//       username: email, // dùng email làm username
//       email,
//       password,
//       name: `${lastName} ${firstName}`,
//       role: 'client',
//     });

//     await newUser.save();

//     res.status(201).json({ message: 'Đăng ký thành công.' });
//   } catch (error) {
//     console.error('Lỗi đăng ký:', error);
//     res.status(500).json({ message: 'Lỗi server' });
//   }
// });

module.exports = router;