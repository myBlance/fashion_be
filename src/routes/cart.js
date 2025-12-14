const express = require('express');
const router = express.Router();
const cartController = require('../Controller/cartController');

// POST /api/carts/sync
router.post('/sync', cartController.syncCart);

// GET /api/carts/:userId
router.get('/:userId', cartController.getCart);

// POST /api/carts
router.post('/', cartController.addToCart);

// PUT /api/carts/update
router.put('/update', cartController.updateCartItem);

// PUT /api/carts/update-variant
router.put('/update-variant', cartController.updateCartItemVariant);

// DELETE /api/carts
router.delete('/', cartController.deleteCartItem);

module.exports = router;
