// app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
require('dotenv').config();
const path = require('path');

// Routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const productRoutes = require('./src/routes/product');
const orderRoutes = require('./src/routes/order');
const cartRoutes = require('./src/routes/cart');
const wishlistRoutes = require('./src/routes/wishlist');
const voucherRoutes = require('./src/routes/voucherRoutes');
const reviewRoutes = require('./src/routes/review');

const app = express();
const server = http.createServer(app);

// --- CORS ---
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_VERCEL_URL,
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Không được phép bởi CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Content-Range'],
}));

// --- Socket.IO ---
const io = new Server(server, {
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

// --- Middlewares ---
app.use('/uploads', express.static(path.join(__dirname, './src/uploads')));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// --- MongoDB ---
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB connection error:', err));

// Models
const Order = require('./src/models/Order');
const Product = require('./src/models/Product');

// SePay API Key
const SEPAY_API_KEY = process.env.SEPAY_API_KEY;


// =====================================================
// 🔥 API TẠO ĐƠN HÀNG + QR
// =====================================================
app.post('/api/create-order', async (req, res) => {
  const { name, amount, userId, products, shippingAddress } = req.body;

  if (!name || !amount || !userId || !products || !shippingAddress) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin đơn hàng.' });
  }

  const orderId = `ORDER${Date.now()}`;
  const qrUrl = `https://img.vietqr.io/image/MB-0917436401-print.png?amount=${amount}&addInfo=${orderId}`;

  try {
    const convertedProducts = await Promise.all(products.map(async (p) => {
      const productDoc = await Product.findOne({ id: p.productId });
      if (!productDoc) throw new Error(`Sản phẩm ${p.productId} không tồn tại`);
      return {
        product: productDoc._id,
        quantity: p.quantity,
        selectedColor: p.color,
        selectedSize: p.size,
      };
    }));

    const newOrder = new Order({
      id: orderId,
      user: userId,
      products: convertedProducts,
      totalPrice: amount,
      status: 'pending',
      paymentMethod: 'seepay',
      shippingAddress,
    });

    const savedOrder = await newOrder.save();

    console.log(`🆕 Đã tạo đơn hàng DB: ${savedOrder.id}`);

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


// =====================================================
// 🔥 API CHUẨN CHECK GIAO DỊCH SePay + Anti-Spam
// =====================================================
const lastCheckMap = new Map(); // <orderId, timestamp>
// ✅ Thay đổi thời gian giới hạn từ 3000ms (3s) lên 5000ms (5s)
const CHECK_INTERVAL = 5000; // 5 giây

async function checkWithSePay(orderId) {
  try {
    const body = {
      addInfo: orderId,
      limit: 1
    };

    const res = await axios.post(
      "https://api.sepay.vn/v1/transactions/search",
      body,
      {
        headers: {
          Authorization: `Bearer ${SEPAY_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (res.data?.success && res.data?.data?.length > 0) {
      return res.data.data[0];
    }

    return null;
  } catch (err) {
    console.error("❌ Lỗi gọi SePay:", err.response?.data || err.message);
    return null;
  }
}

async function safeCheckWithSePay(orderId) {
  const now = Date.now();
  const last = lastCheckMap.get(orderId) || 0;

  // ✅ Sử dụng CHECK_INTERVAL
  if (now - last < CHECK_INTERVAL) {
    console.log(`⛔ Bỏ qua check SePay ${orderId}: spam quá nhanh`);
    return null;
  }

  lastCheckMap.set(orderId, now);
  return await checkWithSePay(orderId);
}

app.post('/api/check-payment-status', async (req, res) => {
  const { orderId } = req.body;

  try {
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    if (order.status !== 'paid') {
      const result = await safeCheckWithSePay(orderId);

      if (result && (result.status === 'PAID' || result.transferAmount > 0)) {
        order.status = 'paid';
        await order.save();

        console.log(`✅ Đơn hàng ${orderId} đã thanh toán (SePay).`);
        io.to(orderId).emit("order_paid", { orderId });
      }
    }

    res.json({
      orderId: order.id,
      name: order.shippingAddress.fullName || "Khách hàng",
      amount: order.totalPrice,
      status: order.status
    });
  } catch (err) {
    console.error("❌ Lỗi check-payment:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});


// =====================================================
// 🔥 WEBHOOK SePay
// =====================================================
app.post('/api/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Nhận webhook SePay:', data);

  const content = data.content || data.description || "";
  const transferAmount = data.transferAmount;
  const match = content.match(/ORDER\d+/);

  if (!match) {
    return res.status(400).json({ message: "Không tìm thấy orderId trong nội dung." });
  }

  const orderId = match[0];

  try {
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    if (transferAmount > 0 && order.status !== "paid") {
      order.status = "paid";
      await order.save();

      console.log(`✅ Đơn hàng ${orderId} Paid qua webhook.`);
      io.to(orderId).emit("order_paid", { orderId });
    }

    res.json({ message: "Webhook xử lý xong." });
  } catch (err) {
    console.error("❌ Lỗi webhook:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});


// =====================================================
// ROUTES CŨ
// =====================================================
app.use('/api/vouchers', voucherRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);


// =====================================================
// SERVER START
// =====================================================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server chạy trên port ${PORT}`);
});