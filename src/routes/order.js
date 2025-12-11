const express = require('express');
const router = express.Router();
const orderController = require('../Controller/orderController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/orders
router.get('/', protect, orderController.getOrders);

// GET /api/orders/:id
router.get('/:id', protect, orderController.getOrderById);

// POST /api/orders
router.post('/', orderController.createOrder);

// PUT /api/orders/:id
router.put('/:id', orderController.updateOrder);

// PUT /api/orders/:id/mark-delivered
router.put('/:id/mark-delivered', orderController.markOrderDelivered);

// PUT /api/orders/:id/cancel
router.put('/:id/cancel', orderController.cancelOrder);

// DELETE /api/orders/:id
router.delete('/:id', orderController.deleteOrder);

module.exports = router;