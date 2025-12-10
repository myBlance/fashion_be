const express = require('express');
const router = express.Router();
const orderController = require('../Controller/orderController');

// GET /api/orders
router.get('/', orderController.getOrders);

// GET /api/orders/:id
router.get('/:id', orderController.getOrderById);

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