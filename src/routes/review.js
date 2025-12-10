const express = require('express');
const { createReview, getProductReviewsById, checkReviewExists, getReviewsForAdmin, getReviewById } = require('../Controller/reviewController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/check', protect, checkReviewExists);
router.post('/', protect, createReview);
router.get('/product/:id', getProductReviewsById);
router.get('/', protect, getReviewsForAdmin);
router.get('/:id', protect, getReviewById);

module.exports = router;