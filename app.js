// app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

// Đảm bảo require('dotenv') ở đầu file
require('dotenv').config();

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const productRoutes = require('./src/routes/product');
const orderRoutes = require('./src/routes/order');
const cartRoutes = require('./src/routes/cart');
const wishlistRoutes = require('./src/routes/wishlist');
const voucherRoutes = require('./src/routes/voucherRoutes');
const reviewRoutes = require('./src/routes/review');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const path = require('path');

const app = express();

// Lấy URL từ .env - Lọc bỏ undefined để tránh lỗi
const allowedOrigins = [
  // process.env.FRONTEND_URL,
  process.env.FRONTEND_VERCEL_URL,
  // 'http://localhost:5173',
  // 'http://localhost:3000',
].filter(Boolean); // Quan trọng: Lọc bỏ undefined/null

// QUAN TRỌNG: Sử dụng CORS đơn giản hơn để tránh spam error logs
app.use(cors({
  origin: function (origin, callback) {
    // Cho phép requests không có origin (Postman, mobile apps)
    if (!origin) {
      return callback(null, true);
    }

    // Kiểm tra origin có trong allowedOrigins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // ❌ KHÔNG throw Error vì nó sẽ spam logs trên Render
    // Thay vào đó, chỉ return false để từ chối request
    return callback(null, false);
  },
  credentials: true,
  exposedHeaders: ['Content-Range'],
}));

const io = new Server(http.createServer(app), {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('join_order', (orderId) => {
    socket.join(orderId);
    console.log(`📦 Client joined room: ${orderId}`);
  });

  socket.on('leave_order', (orderId) => {
    socket.leave(orderId);
    console.log(`🚪 Client left room: ${orderId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

app.use('/uploads', express.static(path.join(__dirname, './src/uploads')));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Kết nối DB từ .env
mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('❌ MongoDB connection error:', err));

// Import Order và Product model
const Order = require('./src/models/Order');
const Product = require('./src/models/Product');
const CartItem = require('./src/models/CartItem'); // Import CartItem
const Voucher = require('./src/models/Voucher'); // Import Voucher
const UserVoucher = require('./src/models/UserVoucher'); // Import UserVoucher

// Lấy SePay API Key từ .env
const SEPAY_API_KEY = process.env.SEPAY_API_KEY;
const SEPAY_ACCOUNT_NO = process.env.SEPAY_ACCOUNT_NO;

// --- APIs SePay ---
app.post('/api/create-order', async (req, res) => {
  const { name, amount, userId, products, shippingAddress, voucherCode } = req.body; // Nhận thêm voucherCode

  if (!name || !amount || !userId || !products || !shippingAddress) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin đơn hàng.' });
  }

  const orderId = `ORDER${Date.now()}`;
  const qrUrl = `https://img.vietqr.io/image/MB-${SEPAY_ACCOUNT_NO}-print.png?amount=${amount}&addInfo=${orderId}`;

  try {
    // 🔍 Kiểm tra xem đơn hàng đã tồn tại chưa (idempotency)
    const existingOrder = await Order.findOne({ id: orderId });
    if (existingOrder) {
      console.log(`🔁 Đơn ${orderId} đã tồn tại. Trả về dữ liệu cũ.`);
      return res.json({
        orderId: existingOrder.id,
        qrUrl: `https://img.vietqr.io/image/MB-${SEPAY_ACCOUNT_NO}-print.png?amount=${existingOrder.totalPrice}&addInfo=${existingOrder.id}`,
        status: existingOrder.status,
        amount: existingOrder.totalPrice,
      });
    }

    // 🔴 CHUYỂN ĐỔI: Chuyển product từ string (id) sang ObjectId
    const convertedProducts = await Promise.all(products.map(async (p) => {
      const productDoc = await Product.findOne({ id: p.productId });
      if (!productDoc) {
        throw new Error(`Sản phẩm ${p.productId} không tồn tại`);
      }
      return {
        product: productDoc._id, // Gán ObjectId
        quantity: p.quantity,
        selectedColor: p.color,
        selectedSize: p.size,
      };
    }));

    // 🔍 XỬ LÝ VOUCHER (Nếu có)
    let finalAmount = amount;
    let discountAmount = 0;
    let appliedVoucher = null;
    let userVoucherRecord = null;

    if (voucherCode) {
      console.log(`🎫 Đang kiểm tra voucher: ${voucherCode}`);
      const voucher = await Voucher.findOne({
        code: voucherCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
      });

      if (!voucher) {
        return res.status(400).json({ message: 'Voucher không hợp lệ hoặc đã hết hạn.' });
      }

      // Kiểm tra UserVoucher
      userVoucherRecord = await UserVoucher.findOne({ userId, voucherId: voucher._id });

      if (!userVoucherRecord) {
        return res.status(400).json({ message: 'Bạn chưa lưu voucher này.' });
      }

      if (userVoucherRecord.usedAt) {
        return res.status(400).json({ message: 'Voucher này đã được sử dụng.' });
      }

      // Kiểm tra điều kiện đơn tối thiểu (Tạm tính tổng tiền hàng chưa ship/giảm)
      // Lưu ý: `amount` ở đây là tổng tiền FE gửi lên (đã có thể bị trừ rồi? Cần cẩn thận).
      // Tốt nhất nên tính lại từ products để an toàn, nhưng ở đây ta tin tưởng FE hoặc check sơ bộ.
      // Giả sử `amount` là tổng tiền cuối cùng FE tính ra. Nếu FE đã trừ voucher thì backend cần tính lại để verify.
      // ĐỂ ĐƠN GIẢN: Ta sẽ tính lại tổng tiền hàng gốc từ DB để verify minOrderAmount.

      let subTotal = 0;
      for (const p of convertedProducts) {
        const prod = await Product.findById(p.product);
        if (prod) subTotal += prod.price * p.quantity;
      }

      if (subTotal < voucher.minOrderAmount) {
        return res.status(400).json({ message: `Đơn hàng chưa đạt tối thiểu ${voucher.minOrderAmount.toLocaleString()}đ để dùng voucher.` });
      }

      // Tính giảm giá
      if (voucher.type === 'percentage') {
        discountAmount = (subTotal * voucher.value) / 100;
      } else {
        discountAmount = voucher.value;
      }

      // Đảm bảo không giảm quá tổng tiền
      if (discountAmount > subTotal) discountAmount = subTotal;

      finalAmount = subTotal - discountAmount; // Cộng thêm ship nếu cần, nhưng ở đây `amount` của Seepay thường là final.
      // Nếu logic FE gửi `amount` là đã trừ voucher, ta cần so sánh.
      // Để an toàn và đồng bộ với Seepay, ta sẽ dùng `finalAmount` này làm `totalPrice`.

      appliedVoucher = voucher;
      console.log(`Voucher hợp lệ. Giảm: ${discountAmount}. Tổng mới: ${finalAmount}`);
    }

    const newOrder = new Order({
      id: orderId,
      user: userId,
      products: convertedProducts,
      totalPrice: appliedVoucher ? finalAmount : amount, // Dùng giá đã giảm nếu có voucher
      status: 'awaiting_payment',
      paymentMethod: 'seepay',
      shippingAddress,
      voucherCode: appliedVoucher ? appliedVoucher.code : null,
      discountAmount: discountAmount
    });

    const savedOrder = await newOrder.save();

    console.log(`🆕 Đã tạo đơn hàng DB: ${savedOrder.id}`);

    // CẬP NHẬT TRẠNG THÁI VOUCHER LÀ ĐÃ DÙNG
    if (userVoucherRecord) {
      userVoucherRecord.usedAt = new Date();
      userVoucherRecord.orderId = savedOrder._id;
      await userVoucherRecord.save();
      console.log(`🎫 Đã đánh dấu voucher ${voucherCode} là đã dùng.`);
    }

    // XÓA SẢN PHẨM KHỎI GIỎ HÀNG SAU KHI TẠO ĐƠN THÀNH CÔNG
    try {
      // Mô phỏng logic của cart.js để đảm bảo khớp dữ liệu
      const { ObjectId } = require('mongoose').Types;
      const uid = new ObjectId(userId);

      for (const item of products) {
        const deleteQuery = {
          userId: uid, // Dùng ObjectId như cart.js (Mongoose sẽ tự cast sang String nếu schema là String)
          productId: item.productId,
          color: item.color || '', // Xử lý trường hợp null/undefined thành chuỗi rỗng
          size: item.size || ''    // Xử lý trường hợp null/undefined thành chuỗi rỗng
        };

        console.log('🗑️ Deleting cart item with query:', JSON.stringify(deleteQuery));

        const result = await CartItem.deleteOne(deleteQuery);
        console.log(`   Deleted count: ${result.deletedCount}`);
      }
      console.log('Hoàn tất xóa giỏ hàng.');
    } catch (cartErr) {
      console.error('⚠️ Lỗi khi xóa giỏ hàng (không ảnh hưởng đơn hàng):', cartErr);
    }

    res.json({
      orderId: savedOrder.id,
      qrUrl,
      status: savedOrder.status,
      amount: savedOrder.totalPrice,
    });
  } catch (err) {
    console.error('❌ Lỗi tạo đơn hàng DB:', err);
    res.status(500).json({ message: 'Lỗi server khi tạo đơn.' });
  }
});

// --- Thêm endpoint mới để lấy QR cho đơn hàng cũ ---
app.get('/api/orders/:orderId/seepay-qr', async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    // Chỉ cho phép nếu đơn đang pending/awaiting_payment và chưa thanh toán
    if (!['pending', 'awaiting_payment'].includes(order.status) || order.paymentMethod !== 'seepay') {
      return res.status(400).json({ message: 'Không thể tạo lại QR cho đơn này.' });
    }

    // Sinh lại QR URL giống như khi tạo đơn
    // 🔴 CẢNH BÁO: Nếu bạn dùng `addInfo` để nhận diện đơn trong webhook, phải đảm bảo format khớp
    const qrUrl = `https://img.vietqr.io/image/MB-${SEPAY_ACCOUNT_NO}-print.png?amount=${order.totalPrice}&addInfo=${order.id}`;

    res.json({
      orderId: order.id,
      qrUrl,
      amount: order.totalPrice,
      status: order.status,
    });
  } catch (err) {
    console.error('❌ Lỗi khi lấy QR cho đơn hàng:', err);
    res.status(500).json({ message: 'Lỗi server khi lấy QR.' });
  }
});

async function checkWithSePay(orderId) {
  try {
    const res = await axios.get(`https://my.sepay.vn/userapi/transactions/search?addInfo=${orderId}`, {
      headers: {
        Authorization: `Bearer ${SEPAY_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (res.data?.success && res.data?.data?.length > 0) {
      return res.data.data[0];
    } else {
      console.log(`⚠️ SePay trả về success: false hoặc không có dữ liệu cho ${orderId}`);
      return null;
    }

  } catch (err) {
    console.error('❌ Lỗi khi gọi SePay:', err.response?.data || err.message);
    return null;
  }
}

app.post('/api/check-payment-status', async (req, res) => {
  const { orderId } = req.body;

  try {
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    if (order.status !== 'paid') {
      const result = await checkWithSePay(orderId);

      if (result && result.status === 'PAID') {
        order.status = 'paid';
        await order.save();

        console.log(`Đơn hàng ${orderId} đã thanh toán và cập nhật DB.`);

        io.to(orderId).emit('order_paid', { orderId });
      }
    }

    res.json({
      orderId: order.id,
      name: order.shippingAddress.fullName || 'Khách hàng',
      amount: order.totalPrice,
      status: order.status,
    });
  } catch (err) {
    console.error('❌ Lỗi kiểm tra trạng thái:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

app.post('/api/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Nhận webhook từ SePay:', data);

  const content = data.content || data.description || '';
  const transferAmount = data.transferAmount;
  const match = content.match(/ORDER\d+/);
  if (!match) {
    return res.status(400).json({ message: 'Không tìm thấy orderId trong nội dung.' });
  }

  const orderId = match[0];

  try {
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({ message: `Không tìm thấy đơn hàng với orderId: ${orderId}` });
    }

    if (transferAmount > 0 && order.status !== 'paid') {
      order.status = 'paid';
      await order.save();

      console.log(`Đơn hàng ${orderId} cập nhật sang Paid qua webhook.`);

      io.to(orderId).emit('order_paid', { orderId });
    }

    res.json({ message: 'Webhook đã xử lý thành công.' });
  } catch (err) {
    console.error('❌ Lỗi xử lý webhook:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

// --- Các route cũ ---
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);

// Lấy PORT từ .env hoặc dùng mặc định là 5000
const PORT = process.env.PORT || 5000;
// Dùng `server` từ `http.createServer` để chạy cả Express và Socket.IO
io.httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
