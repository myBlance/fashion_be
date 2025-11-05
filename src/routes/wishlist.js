const express = require('express');
const WishlistItem = require('../models/WishlistItem');

const router = express.Router();

// ======================
// Lấy danh sách wishlist theo user
// GET /api/wishlist/:userId
// ======================
router.get('/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const items = await WishlistItem.find({ userId });
    res.status(200).json(items.map(i => i.productId));
  } catch (err) {
    console.error('Wishlist get error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/// ======================
// Thêm hoặc xóa sản phẩm (toggle)
// POST /api/wishlist/toggle
// ======================
router.post('/toggle', async (req, res) => {
  try {
    const { userId, productId } = req.body;

    // 👇 VALIDATE RÕ RÀNG HƠN
    if (!userId || typeof userId !== 'string') {
      console.error('Missing or invalid userId:', userId);
      return res.status(400).json({ message: 'Missing or invalid userId' });
    }

    if (!productId || typeof productId !== 'string') {
      console.error('Missing or invalid productId:', productId);
      return res.status(400).json({ message: 'Missing or invalid productId' });
    }

    const existing = await WishlistItem.findOne({ userId, productId });

    if (existing) {
      await existing.deleteOne();
      console.log(`Removed ${productId} from ${userId}'s wishlist`);
      return res.status(200).json({ message: 'Removed', productId });
    } else {
      const newItem = new WishlistItem({ userId, productId });
      await newItem.save();
      console.log(`Added ${productId} to ${userId}'s wishlist`);
      return res.status(201).json({ message: 'Added', productId });
    }
  } catch (err) {
    console.error('Wishlist toggle error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
