require('dotenv').config(); // Must be at the very top
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  // Lấy token từ header, cookie hoặc query
  const token = req.headers.authorization?.split(' ')[1] || 
                req.cookies?.token || 
                req.query?.token;

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: "Authorization token required" 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification failed:", {
      error: error.message,
      token,
      secretSet: !!process.env.JWT_SECRET
    });

    if (error.name === "TokenExpiredError") {
      // Token hết hạn
      return res.status(401).json({
        success: false,
        message: "Token hết hạn, vui lòng đăng nhập lại"
      });
    }

    // Token không hợp lệ / malformed
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = authMiddleware;
