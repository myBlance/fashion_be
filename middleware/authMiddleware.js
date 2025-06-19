require('dotenv').config(); // Must be at the very top

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  // Try multiple ways to get the token
  let token = req.headers.authorization?.split(' ')[1] || 
              req.cookies?.token || 
              req.query?.token;

  console.log("Token extraction attempt:", {
    authHeader: req.headers.authorization,
    cookieToken: req.cookies?.token,
    queryToken: req.query?.token,
    finalToken: token
  });

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
      token: token,
      secretSet: !!process.env.JWT_SECRET
    });
    return res.status(403).json({ 
      success: false,
      message: "Invalid or expired token",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = authMiddleware;