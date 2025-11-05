require('dotenv').config(); // phải để lên đầu để load env trước khi dùng
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User'); // đường dẫn tới model User

// Kiểm tra các biến môi trường
if (!process.env.MONGO_URI || !process.env.MONGO_DB_NAME) {
  throw new Error('Vui lòng cấu hình MONGO_URI và MONGO_DB_NAME trong .env');
}

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME,
})
.then(async () => {
  console.log('✅ MongoDB connected. Bắt đầu tạo user mặc định...');

  // Tạo admin nếu chưa có
  let admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    admin = await User.create({
      username: 'admin',
      password: '1',
      role: 'admin',
      email: 'admin@example.com',
      name: 'Admin',
    });
    console.log('✅ Tạo tài khoản admin: username=admin, password=1');
  } else {
    console.log('Tài khoản admin đã tồn tại');
  }

  // Tạo client nếu chưa có
  let client = await User.findOne({ username: 'client' });
  if (!client) {
    client = await User.create({
      username: 'client',
      password: '1',
      role: 'client',
      email: 'client@example.com',
      name: 'Client',
    });
    console.log('✅ Tạo tài khoản client: username=client, password=1');
  } else {
    console.log('Tài khoản client đã tồn tại');
  }


  mongoose.connection.close();
  console.log('✅ Script hoàn tất, đóng kết nối MongoDB');
})
.catch(err => {
  console.error('❌ Lỗi khi kết nối MongoDB hoặc tạo user:', err);
  process.exit(1);
});
