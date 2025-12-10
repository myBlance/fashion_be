const mongoose = require('mongoose');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product'); // ✅ Import Product model

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

// POST /api/reviews
const createReview = async (req, res) => {
  uploadImages(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });

    try {
      const { orderId, productId, rating, comment } = req.body;

      if (!orderId || !productId || rating === undefined || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu trường bắt buộc hoặc số sao không hợp lệ (1-5).',
        });
      }

      const order = await Order.findOne({ id: orderId, user: req.user.id });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền đánh giá.',
        });
      }

      const existingReview = await Review.findOne({
        orderId,
        productId,
        userId: req.user.id,
      });
      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã đánh giá sản phẩm này rồi.',
        });
      }

      const imagePaths = req.files ? req.files.map(f => `/uploads/review-images/${f.filename}`) : [];

      const newReview = new Review({
        orderId,
        productId,
        userId: req.user.id,
        rating: Number(rating),
        comment,
        images: imagePaths,
      });

      await newReview.save();

      res.status(201).json({
        success: true,
        message: 'Đánh giá đã được gửi thành công!',
        newReview,
      });
    } catch (err) {
      console.error('Lỗi khi tạo đánh giá:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });
};

// GET /api/reviews/product/:id
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

// GET /api/reviews (cho react-admin)
const getReviewsForAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, rating, productId, orderId, userId, _start, _end, _sort, _order } = req.query;

    const filter = {};
    if (rating) filter.rating = parseInt(rating);
    if (productId) filter.productId = productId;
    if (orderId) filter.orderId = orderId;
    if (userId) filter.userId = userId;

    const skip = _start ? parseInt(_start) : (parseInt(page) - 1) * parseInt(limit);
    const take = _end ? parseInt(_end) - parseInt(_start) : parseInt(limit);

    const sort = {};
    if (_sort) {
      sort[_sort] = _order === 'ASC' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }

    const reviews = await Review.find(filter)
      .populate('userId', 'username')
      .sort(sort)
      .skip(skip)
      .limit(take);

    console.log(`📋 getReviewsForAdmin returning ${reviews.length} items. IDs[0-3]:`, reviews.slice(0, 3).map(r => r._id));

    // ✅ Lấy tên và mã sản phẩm theo productId (ObjectId)
    const reviewsWithProductInfo = await Promise.all(reviews.map(async (review) => {
      // ✅ Dùng Product.findById để tìm theo ObjectId
      const product = await Product.findById(review.productId).select('name id'); // ✅ Lấy cả name và id
      return {
        ...review.toObject(),
        productName: product?.name || 'N/A',
        productCode: product?.id || 'N/A', // ✅ Mã sản phẩm
      };
    }));

    const total = await Review.countDocuments(filter);

    res.header('Content-Range', `items 0-${reviews.length}/${total}`);
    res.json(reviewsWithProductInfo); // ✅ Trả về dữ liệu có tên và mã sản phẩm
  } catch (err) {
    console.error('Lỗi khi lấy danh sách đánh giá:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/reviews/:id (cho react-admin getOne)
const getReviewById = async (req, res) => {
  try {
    const { id: rawId } = req.params;
    const id = rawId.trim(); // Trim whitespace
    console.log(`🔍 getReviewById called with ID: '${id}' (raw: '${rawId}')`);

    // --- DEEP DEBUG START ---
    try {
      const nativeOID = await Review.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
      console.log('🧐 Native OID check:', nativeOID ? 'FOUND' : 'NOT FOUND');

      const nativeString = await Review.collection.findOne({ _id: id });
      console.log('🧐 Native String check:', nativeString ? 'FOUND' : 'NOT FOUND');

      if (!nativeOID && !nativeString) {
        console.log('😱 Review completely missing from DB regardless of ID type');
      }
    } catch (e) {
      console.log('⚠️ Error during native debug check:', e.message);
    }
    // --- DEEP DEBUG END ---

    const review = await Review.findById(id).populate('userId', 'username');

    if (!review) {
      console.log(`❌ Review not found in DB for ID: ${id}`);

      // LOG SAMPLE IDs
      const sampleReviews = await Review.find().select('_id').limit(5);
      console.log('📋 Sample Review IDs in DB:', sampleReviews.map(r => r._id));

      return res.status(404).json({
        success: false,
        message: `Review not found for ID: ${id}. Check server logs for details.`
      });
    }

    const product = await Product.findById(review.productId).select('name id');
    const reviewWithProductInfo = {
      ...review.toObject(),
      productName: product?.name || 'N/A',
      productCode: product?.id || 'N/A',
    };

    res.json(reviewWithProductInfo);
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết đánh giá:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createReview,
  getProductReviewsById,
  checkReviewExists,
  getReviewsForAdmin,
  getReviewById,
};