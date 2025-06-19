const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME,
})
.then(async () => {
  console.log('✅ MongoDB connected, bắt đầu tạo user mặc định nếu chưa có...');

  const admin = await User.findOne({ username: 'admin' });
  const client = await User.findOne({ username: 'client' });

  if (!admin) {
    await User.create({
      username: 'admin',
      password: await bcrypt.hash('1', 10),
      role: 'admin',
      email: 'admin@example.com', // Nên thêm email cho user theo schema
    });
    console.log('✅ Tạo tài khoản admin');
  } else {
    console.log('Tài khoản admin đã tồn tại');
  }

  if (!client) {
    await User.create({
      username: 'client',
      password: await bcrypt.hash('1', 10),
      role: 'client',
      email: 'client@example.com', // Nên thêm email cho user theo schema
    });
    console.log('✅ Tạo tài khoản client');
  } else {
    console.log('Tài khoản client đã tồn tại');
  }

  process.exit(0);
})
.catch(err => {
  console.error('❌ Lỗi khi kết nối hoặc tạo user:', err);
  process.exit(1);
});
