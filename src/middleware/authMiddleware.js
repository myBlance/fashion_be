// middleware/authMiddleware.js
require('dotenv').config();
const jwt = require("jsonwebtoken");
const User = require('../models/User');

// Middleware xác thực JWT
const authMiddleware = (req, res, next) => {
  console.log('🔒 authMiddleware được gọi'); // ✅ Log đầu tiên
  const token = req.headers.authorization?.split(' ')[1] || 
                req.cookies?.token || 
                req.query?.token;

  console.log('🔒 Token nhận được:', token); // ✅ Log token

  if (!token) {
    console.log('🔒 Không có token');
    return res.status(401).json({ 
      success: false,
      message: "Authorization token required" 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔒 Token hợp lệ, decoded =', decoded);
    req.user = decoded;

    // ✅ Thêm log sau khi gán req.user và trước next()
    console.log('🔒 Gọi next()...');
    next();

    // ✅ Thêm log sau next() để kiểm tra xem next() có thực sự chạy không
    console.log('🔒 Đã gọi next(), đang chuyển sang hàm route...');
  } catch (error) {
    console.error("Token verification failed:", {
      error: error.message,
      token,
      secretSet: !!process.env.JWT_SECRET
    });

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token hết hạn, vui lòng đăng nhập lại"
      });
    }

    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware kiểm tra quyền admin
const admin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: "Bạn cần đăng nhập để thực hiện hành động này" 
    });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: "Bạn không có quyền thực hiện hành động này" 
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server khi kiểm tra quyền admin" 
    });
  }
};

module.exports = { protect: authMiddleware, admin };