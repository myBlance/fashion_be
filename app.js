const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const productRoutes = require('./src/routes/product');
const orderRoutes = require('./src/routes/order')
const cartRoutes = require('./src/routes/cart')
const path = require('path');

require('dotenv').config();

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'https://fashion-app-cyan.vercel.app',
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

app.use('/uploads', express.static(path.join(__dirname, './src/uploads')));
// Chỉ khai báo 1 lần express.json() với limit 10mb
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.log('❌ MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/carts',cartRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
