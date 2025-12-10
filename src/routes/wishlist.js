const express = require('express');
const router = express.Router();
const wishlistController = require('../Controller/wishlistController');

// ======================
// Lấy danh sách wishlist theo user
// GET /api/wishlist/:userId
// ======================
router.get('/:userId', wishlistController.getWishlist);

/// ======================
// Thêm hoặc xóa sản phẩm (toggle)
// POST /api/wishlist/toggle
// ======================
router.post('/toggle', wishlistController.toggleWishlist);

module.exports = router;
