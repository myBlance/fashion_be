const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * @route   GET /api/orders
 * @desc    Lấy danh sách đơn hàng
 * @access  Private (giả sử bạn cần xác thực người dùng)
 */
router.get('/', async (req, res) => {
  try {
    const { _start = 0, _end = 10, _sort = 'createdAt', _order = 'DESC', status, ...filters } = req.query;

    const start = Number(_start);
    const end = Number(_end);
    const limit = end - start;
    const sortField = _sort === 'id' ? '_id' : _sort;
    const sortOrder = _order === 'ASC' ? 1 : -1;

    // const userId = req.user._id; // Bỏ comment nếu dùng auth
    const query = { /* user: userId, */ ...filters };
    if (status && status !== 'all') {
      query.status = status;
    }

    const total = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(start)
      .limit(limit)
      .populate('user', 'username email');

    const populatedOrders = await Promise.all(orders.map(async (order) => {
      const populatedProducts = await Promise.all(order.products.map(async (item) => {
        const productDetails = await Product.findById(item.product);
        return {
          ...item._doc,
          product: productDetails ? {
            _id: productDetails._id,
            name: productDetails.name,
            price: productDetails.price,
            image: productDetails.thumbnail || productDetails.images?.[0] || '',
          } : {
            _id: null,
            name: 'Sản phẩm không tồn tại',
            price: 0,
            image: '',
          }
        };
      }));
      return {
        ...order._doc,
        products: populatedProducts,
      };
    }));

    res.setHeader('Content-Range', `orders ${start}-${end - 1}/${total}`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');

    res.json(populatedOrders);
  } catch (err) {
    console.error('❌ Lỗi GET /orders:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   GET /api/orders/:id
 * @desc    Lấy chi tiết đơn hàng
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id })
      .populate('user', 'username email');

    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

    const populatedProducts = await Promise.all(order.products.map(async (item) => {
      const productDetails = await Product.findById(item.product);
      return {
        ...item._doc,
        product: productDetails ? {
          _id: productDetails._id,
          name: productDetails.name,
          price: productDetails.price,
          image: productDetails.thumbnail || productDetails.images?.[0] || '',
        } : {
          _id: null,
          name: 'Sản phẩm không tồn tại',
          price: 0,
          image: '',
        }
      };
    }));

    res.json({
      ...order._doc,
      products: populatedProducts,
    });
  } catch (err) {
    console.error('❌ Lỗi GET /orders/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   POST /api/orders
 * @desc    Tạo đơn hàng mới
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const { products, ...orderData } = req.body;

    const populatedProducts = await Promise.all(products.map(async (item) => {
      const productDoc = await Product.findOne({ id: item.product });
      if (!productDoc) {
        throw new Error(`Sản phẩm ${item.product} không tồn tại`);
      }
      return {
        ...item,
        product: productDoc._id,
      };
    }));

    const newOrder = new Order({
      ...orderData,
      products: populatedProducts,
    });

    const saved = await newOrder.save();
    const populatedOrder = await Order.findById(saved._id)
      .populate('user', 'username email')
      .populate('products.product', 'name price thumbnail images');

    res.status(201).json(populatedOrder);
  } catch (err) {
    console.error('❌ Lỗi POST /orders:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   PUT /api/orders/:id
 * @desc    Cập nhật đơn hàng
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const { products, ...updateData } = req.body;

    if (products) {
      const populatedProducts = await Promise.all(products.map(async (item) => {
        const productDoc = await Product.findOne({ id: item.product });
        if (!productDoc) {
          throw new Error(`Sản phẩm ${item.product} không tồn tại`);
        }
        return {
          ...item,
          product: productDoc._id,
        };
      }));
      updateData.products = populatedProducts;
    }

    const updated = await Order.findOneAndUpdate({ id: req.params.id }, updateData, {
      new: true,
    });

    if (!updated) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

    const populatedOrder = await Order.findById(updated._id)
      .populate('user', 'username email')
      .populate('products.product', 'name price thumbnail images');

    res.json(populatedOrder);
  } catch (err) {
    console.error('❌ Lỗi PUT /orders/:id:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   PUT /api/orders/:id/mark-delivered
 * @desc    Đánh dấu đơn hàng là đã nhận
 * @access  Private
 */
router.put('/:id/mark-delivered', async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (order.status !== 'shipped') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể đánh dấu đơn hàng đang giao là đã nhận' });
    }

    order.status = 'delivered';
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'username email')
      .populate('products.product', 'name price thumbnail images');

    res.json({ success: true, order: populatedOrder });
  } catch (err) {
    console.error('❌ Lỗi PUT /orders/:id/mark-delivered:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   PUT /api/orders/:id/cancel
 * @desc    Hủy đơn hàng (chỉ khi trạng thái là pending hoặc paid)
 * @access  Private
 */
router.put('/:id/cancel', async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (order.status !== 'pending' && order.status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Không thể hủy đơn hàng ở trạng thái này' });
    }

    const convertedProducts = [];
    for (const item of order.products) {
      if (typeof item.product === 'string') {
        const productDoc = await Product.findOne({ id: item.product });
        if (!productDoc) {
          console.warn(`Sản phẩm ${item.product} không tồn tại khi hủy đơn, giữ lại item với product: null.`);
          convertedProducts.push({
            ...item.toObject(),
            product: null,
          });
        } else {
          convertedProducts.push({
            ...item.toObject(),
            product: productDoc._id,
          });
        }
      } else if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
        convertedProducts.push(item.toObject());
      } else {
        console.warn(`Sản phẩm trong đơn ${order.id} có ObjectId không hợp lệ hoặc null/undefined, bỏ qua item.`);
        console.log('  -> Item problematic:', item._id, item.product);
        continue;
      }
    }

    order.products = convertedProducts;
    order.status = 'cancelled';

    let updatedOrder;
    try {
      updatedOrder = await order.save();
    } catch (saveErr) {
      console.error('❌ Lỗi khi lưu đơn hàng sau khi cập nhật status:', saveErr);
      if (saveErr.name === 'ValidationError') {
        console.error('Validation Error Details:', saveErr.errors);
      }
      return res.status(500).json({ success: false, message: 'Lỗi khi lưu đơn hàng', error: saveErr.message });
    }

    const populatedOrder = await Order.findById(updatedOrder._id)
      .populate('user', 'username email')
      .populate('products.product', 'name price thumbnail images');

    res.json({ success: true, populatedOrder });
  } catch (err) {
    console.error('❌ Lỗi PUT /orders/:id/cancel:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   DELETE /api/orders/:id
 * @desc    Xoá đơn hàng
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Order.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    res.status(204).end();
  } catch (err) {
    console.error('❌ Lỗi DELETE /orders/:id:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   PUT /api/orders/:id/reset-for-payment
 * @desc    Đặt lại trạng thái đơn hàng để thanh toán lại (chỉ cho đơn unpaid seepay)
 * @access  Private
 */
router.put('/:id/reset-for-payment', async (req, res) => {
  try {
    console.log(`🔄 Bắt đầu xử lý PUT /reset-for-payment cho orderId: ${req.params.id}`);
    const orderId = req.params.id;

    // Tìm đơn hàng theo ID (string)
    const order = await Order.findOne({ id: orderId });

    if (!order) {
      console.log(`❌ Không tìm thấy đơn hàng với ID: ${orderId}`);
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    console.log("🔍 Debug: Thông tin đơn hàng tìm thấy", {
      id: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      // paymentStatus: order.paymentStatus // Nếu bạn có trường này
    });

    // ✅ CẬP NHẬT: Kiểm tra điều kiện: phương thức là seepay và status là pending (coi pending là unpaid)
    console.log("🔍 Debug: Kiểm tra paymentMethod và status");
    if (order.paymentMethod !== 'seepay' || order.status !== 'pending') {
      console.log(`❌ Kiểm tra điều kiện thất bại cho orderId ${orderId}. paymentMethod: ${order.paymentMethod}, status: ${order.status}`);
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể đặt lại đơn hàng chưa thanh toán bằng SeePay.',
        currentStatus: order.status,
        currentMethod: order.paymentMethod
      });
    }

    // ✅ CẬP NHẬT: Kiểm tra trạng thái đơn hàng (chỉ pending mới hợp lệ)
    console.log("🔍 Debug: Kiểm tra lại status");
    if (order.status !== 'pending') {
        console.log(`❌ Trạng thái không hợp lệ để thanh toán lại. Current status: ${order.status}`);
        return res.status(400).json({
            success: false,
            message: 'Không thể thanh toán lại đơn hàng ở trạng thái này.',
            currentStatus: order.status
        });
    }

    console.log(`✅ Tất cả điều kiện kiểm tra đã vượt qua cho orderId ${orderId}.`);

    // Cập nhật lại trạng thái (nếu cần, mặc định là pending, nên không cần thay đổi gì thêm)
    // Nếu bạn cho phép từ 'cancelled', thì đặt lại về 'pending'
    // if (order.status === 'cancelled') {
    //   order.status = 'pending';
    //   console.log(`🔄 Cập nhật status từ 'cancelled' về 'pending' cho orderId ${orderId}`);
    // }

    // Nếu bạn có lưu QR code trong đơn và muốn xóa nó để tránh nhầm lẫn
    // order.qrCode = null; // hoặc trường tương ứng
    // console.log(`🔄 (Nếu có) Xóa QR code cũ cho orderId ${orderId}`);

    console.log(`🔄 Bắt đầu lưu đơn hàng sau khi reset cho orderId ${orderId}`);
    await order.save();
    console.log(`🔄 Đơn hàng ${orderId} đã được lưu thành công sau khi reset.`);

    console.log(`🔄 Đơn hàng ${orderId} đã được đặt lại để thanh toán lại.`);

    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'username email')
      .populate('products.product', 'name price thumbnail images');

    res.json({ success: true, message: 'Đơn hàng đã được đặt lại để thanh toán.', order: populatedOrder });

  } catch (err) {
    console.error('❌ Lỗi PUT /orders/:id/reset-for-payment:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;