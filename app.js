// app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

// ✅ Đảm bảo require('dotenv') ở đầu file
require('dotenv').config();

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const productRoutes = require('./src/routes/product');
const orderRoutes = require('./src/routes/order');
const cartRoutes = require('./src/routes/cart');
const wishlistRoutes = require('./src/routes/wishlist');
const voucherRoutes = require('./src/routes/voucherRoutes');
const reviewRoutes = require('./src/routes/review');
const path = require('path');

const app = express();

// ✅ Lấy URL từ .env
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

// ✅ Kết nối DB từ .env
mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.log('❌ MongoDB connection error:', err));

// ✅ Import Order và Product model
const Order = require('./src/models/Order');
const Product = require('./src/models/Product'); // <-- Thêm dòng này

// ✅ Lấy SePay API Key từ .env
const SEPAY_API_KEY = process.env.SEPAY_API_KEY;

// --- APIs SePay ---
app.post('/api/create-order', async (req, res) => {
  const { name, amount, userId, products, shippingAddress } = req.body;

  if (!name || !amount || !userId || !products || !shippingAddress) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin đơn hàng.' });
  }

  const orderId = `ORDER${Date.now()}`;
  const qrUrl = `https://img.vietqr.io/image/MB-0917436401-print.png?amount=${amount}&addInfo=${orderId}`;

  try {
    // 🔴 CHUYỂN ĐỔI: Chuyển product từ string (id) sang ObjectId
    const convertedProducts = await Promise.all(products.map(async (p) => {
      const productDoc = await Product.findOne({ id: p.productId }); // <-- Bây giờ Product đã được định nghĩa
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

    const newOrder = new Order({
      id: orderId,
      user: userId,
      products: convertedProducts, // Dùng mảng đã chuyển đổi
      totalPrice: amount,
      status: 'pending',
      paymentMethod: 'seepay',
      shippingAddress,
    });

    const savedOrder = await newOrder.save(); // Bây giờ sẽ không lỗi validation

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

          console.log(`✅ Đơn hàng ${orderId} đã thanh toán và cập nhật DB.`);

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

        console.log(`✅ Đơn hàng ${orderId} cập nhật sang Paid qua webhook.`);

        io.to(orderId).emit('order_paid', { orderId });
      }

      res.json({ message: 'Webhook đã xử lý thành công.' });
    } catch (err) {
      console.error('❌ Lỗi xử lý webhook:', err);
      res.status(500).json({ message: 'Lỗi server.' });
    }
});

// --- Các route cũ ---
app.use('/api/vouchers', voucherRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);

// ✅ Lấy PORT từ .env hoặc dùng mặc định là 5000
const PORT = process.env.PORT || 5000;
// ✅ Dùng `server` từ `http.createServer` để chạy cả Express và Socket.IO
io.httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
