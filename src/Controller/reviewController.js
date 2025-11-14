
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Order = require('../models/Order');

const multer = require('multer');
const path = require('path');

// -------------------- Cấu hình multer --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/review-images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh'), false);
    }
  },
});

const uploadImages = upload.array('images', 5); // tối đa 5 ảnh

// -------------------- API --------------------

// POST /api/reviews
const createReview = async (req, res) => {
  uploadImages(req, res, async (err) => {
    // ... phần upload ...

    try {
      const { orderId, productId, rating, comment } = req.body;

      if (!orderId || !productId || rating === undefined || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu trường bắt buộc hoặc số sao không hợp lệ (1-5).',
        });
      }

      // ✅ Sửa lại: dùng findOne thay vì findById
      const order = await Order.findOne({ id: orderId, user: req.user.id });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền đánh giá.',
        });
      }

      // ... phần còn lại ...
    } catch (err) {
      console.error('Lỗi khi tạo đánh giá:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });
};

// GET /api/reviews/:productId
const getProductReviewsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'product id không hợp lệ' });
    }

    const reviews = await Review.find({ productId: id })
      .populate('userId', 'username avatar')
      .sort({ createdAt: -1 });

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      success: true,
      reviews,
      avgRating: Math.round(avgRating * 10) / 10,
      total: reviews.length,
    });
  } catch (err) {
    console.error('Lỗi khi lấy đánh giá:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/reviews/check?orderId=xxx&productId=xxx
const checkReviewExists = async (req, res) => {
  try {
    const { orderId, productId } = req.query;
    if (!orderId || !productId) {
      return res.status(400).json({ success: false, message: 'Thiếu orderId hoặc productId' });
    }

    const review = await Review.findOne({
      orderId,
      productId,
      userId: req.user.id,
    });

    res.json({
      success: true,
      alreadyReviewed: !!review,
      review: review || null,
    });
  } catch (err) {
    console.error('Lỗi khi kiểm tra đánh giá:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createReview,
  getProductReviewsById,
  checkReviewExists,
};