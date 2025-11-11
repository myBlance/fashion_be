// routes/orders.js
const express = require('express');
const Order = require('../models/Order');

const router = express.Router();

/**
 * @route   GET /api/orders
 * @desc    Lấy danh sách đơn hàng
 * @access  Public (có thể thêm auth nếu cần)
 */
router.get('/', async (req, res) => {
  try {
    const { _start = 0, _end = 10, _sort = 'createdAt', _order = 'DESC', ...filters } = req.query;

    const start = Number(_start);
    const end = Number(_end);
    const limit = end - start;
    const sortField = _sort === 'id' ? '_id' : _sort;
    const sortOrder = _order === 'ASC' ? 1 : -1;

    const query = {};
    for (let key in filters) {
      query[key] = new RegExp(filters[key], 'i');
    }

    const total = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(start)
      .limit(limit)
      .populate('user', 'username email')
      .populate('products.product', 'name price');

    res.setHeader('Content-Range', `orders ${start}-${end - 1}/${total}`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');

    res.json(orders);
  } catch (err) {
    console.error('❌ Lỗi GET /orders:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   GET /api/orders/:id
 * @desc    Lấy chi tiết đơn hàng
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id })
      .populate('user', 'username email')
      .populate('products.product', 'name price');

    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

    res.json(order);
  } catch (err) {
    console.error('❌ Lỗi GET /orders/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   POST /api/orders
 * @desc    Tạo đơn hàng mới
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const newOrder = new Order(req.body);
    const saved = await newOrder.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('❌ Lỗi POST /orders:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   PUT /api/orders/:id
 * @desc    Cập nhật đơn hàng
 * @access  Public
 */
router.put('/:id', async (req, res) => {
  try {
    const updated = await Order.findOneAndUpdate({ id: req.params.id }, req.body, {
      new: true,
    });
    res.json(updated);
  } catch (err) {
    console.error('❌ Lỗi PUT /orders/:id:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   DELETE /api/orders/:id
 * @desc    Xoá đơn hàng
 * @access  Public
 */
router.delete('/:id', async (req, res) => {
  try {
    await Order.findOneAndDelete({ id: req.params.id });
    res.status(204).end();
  } catch (err) {
    console.error('❌ Lỗi DELETE /orders/:id:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;