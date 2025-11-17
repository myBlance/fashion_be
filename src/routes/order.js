// src/routes/order.js
const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product'); // Thêm model Product
const mongoose = require('mongoose');
const { clearCartAfterOrder } = require('../utils/cartUtils');
const authenticate = require('../middleware/authMiddleware');


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

    // Thêm filter cho user nếu có xác thực
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
      .populate('user', 'username email'); // Populate user vẫn như cũ

    // Populate sản phẩm thủ công - SỬA ĐỔI TẠI ĐÂY
    const populatedOrders = await Promise.all(orders.map(async (order) => {
      const populatedProducts = await Promise.all(order.products.map(async (item) => {
        // 🔴 SỬA: Dùng _id (ObjectId) thay vì id (String)
        const productDetails = await Product.findById(item.product); // item.product là ObjectId
        return {
          ...item._doc,
          product: productDetails ? {
            _id: productDetails._id,
            name: productDetails.name,
            price: productDetails.price,
            image: productDetails.thumbnail || productDetails.images?.[0] || '', // Lấy ảnh đầu tiên nếu thumbnail không có
            // Thêm các trường khác nếu cần: category, brand, ...
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
      .populate('user', 'username email'); // Populate user

    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

    // Populate sản phẩm thủ công - SỬA ĐỔI TẠI ĐÂY
    const populatedProducts = await Promise.all(order.products.map(async (item) => {
      // 🔴 SỬA: Dùng _id (ObjectId) thay vì id (String)
      const productDetails = await Product.findById(item.product); // item.product là ObjectId
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

    // ✅ LẤY userId từ body (vì chưa có token)
    const userId = orderData.user;
    if (!userId) {
      return res.status(400).json({ error: 'User không được xác định.' });
    }

    // Chuyển string product -> ObjectId
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
      user: userId, // ✅ Gán lại user để đảm bảo schema
      products: populatedProducts,
    });

    const saved = await newOrder.save();

    // ✅ Gọi xóa giỏ hàng
    await clearCartAfterOrder(userId, products);

    // Populate lại để trả về đầy đủ sản phẩm
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
    // Nếu bạn cho phép cập nhật sản phẩm trong đơn, cần xử lý tương tự như POST
    // Nếu không, chỉ cập nhật các trường khác như status, shippingAddress, v.v.
    const { products, ...updateData } = req.body;

    if (products) {
      // Nếu có cập nhật sản phẩm, cần chuyển đổi lại từ string -> ObjectId
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

    // Populate lại để trả về thông tin đầy đủ
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

    // Chỉ cho phép đánh dấu nếu trạng thái là shipped
    if (order.status !== 'shipped') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể đánh dấu đơn hàng đang giao là đã nhận' });
    }

    order.status = 'delivered';
    await order.save();

    // Populate lại user và products
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

    // Chỉ cho phép hủy nếu trạng thái là pending hoặc paid
    if (order.status !== 'pending' && order.status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Không thể hủy đơn hàng ở trạng thái này' });
    }

    // 🔴 CHUYỂN ĐỔI: Chuyển các product từ string sang ObjectId trước khi save
    // Nếu không chuyển đổi, save() sẽ báo lỗi vì schema yêu cầu ObjectId
    const convertedProducts = [];
    for (const item of order.products) {
      // Kiểm tra nếu item.product là string, tức là chưa được populate hoặc là id cũ
      if (typeof item.product === 'string') {
        const productDoc = await Product.findOne({ id: item.product });
        if (!productDoc) {
          // Nếu không tìm thấy sản phẩm, BỎ QUA item này hoặc có thể giữ lại với product: null
          // Tùy vào logic kinh doanh, ở đây mình giữ lại với product: null để không mất dữ liệu đơn hàng
          console.warn(`Sản phẩm ${item.product} không tồn tại khi hủy đơn, giữ lại item với product: null.`);
          convertedProducts.push({
            ...item.toObject(), // Dùng toObject() để đảm bảo clean object
            product: null, // Gán null nếu không tìm thấy
          });
        } else {
          // Nếu tìm thấy, chuyển đổi và thêm vào mảng mới
          convertedProducts.push({
            ...item.toObject(), // Dùng toObject() để đảm bảo clean object
            product: productDoc._id, // Gán ObjectId
          });
        }
      } else if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
        // Nếu là ObjectId hợp lệ, giữ nguyên
        // Dùng toObject() để đảm bảo clean object
        convertedProducts.push(item.toObject());
      } else {
        // Nếu là ObjectId nhưng không hợp lệ (null, undefined, ...), BỎ QUA item này
        // hoặc có thể giữ lại nhưng không gán product (sẽ gây lỗi required nếu schema bắt buộc)
        // Cách an toàn hơn là bỏ qua item này để tránh lỗi validation.
        console.warn(`Sản phẩm trong đơn ${order.id} có ObjectId không hợp lệ hoặc null/undefined, bỏ qua item.`);
        console.log('  -> Item problematic:', item._id, item.product); // Log item gây lỗi
        // continue; // Bỏ qua item này, không thêm vào mảng mới
        // HOẶC: Nếu schema cho phép product là null, có thể giữ lại với product: null
        // convertedProducts.push({ ...item.toObject(), product: null }); // Nhưng schema hiện tại là required
        // Cách tốt nhất là bỏ qua
        continue;
      }
    }

    // Gán lại mảng đã chuyển đổi (và loại bỏ các item không hợp lệ nếu bạn chọn cách bỏ qua) vào order
    // Quan trọng: Gán lại toàn bộ mảng, không thay đổi từng phần tử
    order.products = convertedProducts;

    // Cập nhật trạng thái thành cancelled
    order.status = 'cancelled';

    let updatedOrder;
    try {
      updatedOrder = await order.save(); // Bây giờ save sẽ không lỗi do product đã là ObjectId hoặc null (nếu schema cho phép), hoặc item lỗi đã bị bỏ
    } catch (saveErr) {
      console.error('❌ Lỗi khi lưu đơn hàng sau khi cập nhật status:', saveErr);
      if (saveErr.name === 'ValidationError') {
        console.error('Validation Error Details:', saveErr.errors);
      }
      return res.status(500).json({ success: false, message: 'Lỗi khi lưu đơn hàng', error: saveErr.message });
    }

    // Populate lại để trả về thông tin đầy đủ
    const populatedOrder = await Order.findById(updatedOrder._id)
      .populate('user', 'username email')
      .populate('products.product', 'name price thumbnail images');

    res.json({ success: true,  populatedOrder });
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

module.exports = router;