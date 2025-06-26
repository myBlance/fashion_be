require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./src/models/Order');
const User = require('./src/models/User');
const Product = require('./src/models/Product');

const sampleOrderId = 'ORD0001';

async function seedOrders() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME,
    });
    console.log('✅ Đã kết nối MongoDB');

    // Lấy 1 user và 1 sản phẩm mẫu
    const user = await User.findOne();
    const product = await Product.findOne();

    if (!user || !product) {
      console.log('❌ Cần có ít nhất 1 user và 1 product trong DB để seed đơn hàng');
      process.exit(1);
    }

    // Tạo dữ liệu đơn hàng mẫu
    const orderData = [
      {
        id: sampleOrderId,
        user: user._id,
        products: [
          {
            product: product._id,
            quantity: 2,
            price: product.price,
          }
        ],
        shippingAddress: {
          address: '123 Đường Lê Lợi',
          city: 'Hà Nội',
          postalCode: '100000',
          country: 'Việt Nam'
        },
        paymentMethod: 'cod',
        totalPrice: product.price * 2,
        isPaid: false,
        isDelivered: false,
        createdAt: new Date('2025-06-01')
      }
    ];

    // Kiểm tra xem đã tồn tại đơn hàng chưa
    const count = await Order.countDocuments();
    if (count === 0) {
      const result = await Order.insertMany(orderData);
      console.log(`✅ Đã thêm ${result.length} đơn hàng vào database`);
    } else {
      console.log(`ℹ️ Đã có ${count} đơn hàng, không thêm mới`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi seed đơn hàng:', err);
    process.exit(1);
  }
}

seedOrders();
