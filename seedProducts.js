require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

// Dữ liệu sản phẩm
const products = [
  {
    id: "DOLA3900",
    name: "QUẦN DÀI ỐNG SUÔNG",
    brand: "Dola Style",
    price: 299000,
    category: "Quần",
    originalPrice: 500000,
    status: true,
    colors: ["#fff", "#000"],
    type: "quần",
    style: "trẻ trung",
    sizes: ["S", "M", "L"],
    sold: 10,  
    total: 50,
    thumbnail: "/assets/images/xanh.webp",
    images: [
      "/assets/images/xanh1.webp",
      "/assets/images/kem.jpg",
      "/assets/images/xanh.webp"
    ],
    sale: false,
    createdAt: new Date("2025-05-01")
  }
];

mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME,
})
.then(async () => {
  console.log('✅ Đã kết nối tới MongoDB Atlas');

  try {
    const count = await Product.countDocuments();
    if (count === 0) {
      const result = await Product.insertMany(products);
      console.log(`✅ Đã thêm ${result.length} sản phẩm vào database`);
    } else {
      console.log(`ℹ️ Database đã có ${count} sản phẩm, không thêm mới`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi thêm dữ liệu:', err);
    process.exit(1);
  }
})
.catch(err => {
  console.error('❌ Lỗi kết nối MongoDB:', err);
  process.exit(1);
});
