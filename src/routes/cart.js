const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const CartItem = require('../models/CartItem');

const { ObjectId } = mongoose.Types;

// ======================
// POST /api/carts/sync
// ======================
router.post('/sync', async (req, res) => {
  try {
    const { userId, items } = req.body;
    if (!userId || !Array.isArray(items)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const uid = new ObjectId(userId);

    for (const item of items) {
      const existing = await CartItem.findOne({
        userId: uid,
        productId: item.productId,
        color: item.color || '',
        size: item.size || ''
      });

      if (existing) {
        existing.quantity += item.quantity || 1;
        await existing.save();
      } else {
        const newItem = new CartItem({
          userId: uid,
          productId: item.productId,
          name: item.name || 'Unknown',
          color: item.color || '',
          size: item.size || '',
          price: item.price || 0,
          quantity: item.quantity || 1,
          image: item.image || ''
        });
        await newItem.save();
      }
    }

    const cart = await CartItem.find({ userId: uid });
    res.status(200).json(cart);
  } catch (error) {
    console.error('Error syncing cart:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ======================
// GET /api/carts/:userId
// ======================
router.get('/:userId', async (req, res) => {
  try {
    const uid = new ObjectId(req.params.userId);
    const items = await CartItem.find({ userId: uid });
    res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ======================
// POST /api/carts
// ======================
router.post('/', async (req, res) => {
  try {
    let { userId, productId, name, color, size, price, quantity, image } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const uid = new ObjectId(userId);

    const existing = await CartItem.findOne({
      userId: uid,
      productId,
      color: color || '',
      size: size || ''
    });

    if (existing) {
      existing.quantity += quantity || 1;
      await existing.save();
      return res.status(200).json(existing);
    }

    const newItem = new CartItem({
      userId: uid,
      productId,
      name: name || 'Unknown',
      color: color || '',
      size: size || '',
      price: price || 0,
      quantity: quantity || 1,
      image: image || ''
    });

    await newItem.save();
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ======================
// PUT /api/carts/update
// ======================
router.put('/update', async (req, res) => {
  try {
    let { userId, productId, color, size, quantity } = req.body;
    if (!userId || !productId || quantity === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const uid = new ObjectId(userId);

    const item = await CartItem.findOne({
      userId: uid,
      productId,
      color: color || '',
      size: size || ''
    });

    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.quantity = quantity;
    await item.save();
    res.status(200).json(item);
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ======================
// DELETE /api/carts
// ======================
router.delete('/', async (req, res) => {
  try {
    let { userId, productId, color, size } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const uid = new ObjectId(userId);

    const result = await CartItem.deleteOne({
      userId: uid,
      productId,
      color: color || '',
      size: size || ''
    });

    if (result.deletedCount === 0) return res.status(404).json({ message: 'Item not found' });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting cart item:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
