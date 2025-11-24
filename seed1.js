const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid'); // npm install uuid

// Import models
const User = require('./src/models/User');
const Product = require('./src/models/Product');
const Review = require('./src/models/Review');
const Voucher = require('./src/models/Voucher');
const UserVoucher = require('./src/models/UserVoucher');
const CartItem = require('./src/models/CartItem');
const Order = require('./src/models/Order');

// Connect to MongoDB (adjust URI as needed)
async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fashion_ecommerce';
  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB_NAME || 'fashion_ecommerce', // thêm dbName nếu có
  });
  console.log('✅ Connected to MongoDB');
}
// Helper: generate Vietnamese names & info
const names = [
  'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Quang Cường', 'Phạm Minh Đức',
  'Hoàng Thị Linh', 'Vũ Văn Hải', 'Ngô Thị Mai', 'Đỗ Văn Nam',
  'Bùi Thị Ngọc', 'Dương Văn Sơn'
];
const emails = names.map((name, i) => `client${i + 1}@example.com`);
const phones = Array.from({ length: 10 }, (_, i) => `+8490123${String(4567 + i).padEnd(4, '0').slice(-4)}`);

const brands = ['ZARA', 'H&M', 'Uniqlo', 'LocalBrand', 'Nike', 'Adidas', 'Gucci', 'LV'];
const categories = ['shirt', 'pants', 'dress', 'jacket', 'shoes', 'accessory'];
const colors = ['black', 'white', 'red', 'blue', 'gray', 'green', 'yellow', 'pink'];
const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const cities = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Hải Phòng'];
const districts = ['Quận 1', 'Quận 2', 'Quận Ba Đình', 'Quận Cầu Giấy'];
const wards = ['Phường Bến Nghé', 'Phường Tân Định', 'Phường Tràng Tiền', 'Phường Dịch Vọng'];

// Generate slug ID (e.g., ao-thun-tron-trang-m)
function generateProductId(name, color, size) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30) + `-${color}-${size}`.toLowerCase();
}

// 🌱 Main Seed Function
async function seed() {
  try {
    // Clear existing data (optional — ⚠️ destructive)
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Review.deleteMany({}),
      Voucher.deleteMany({}),
      UserVoucher.deleteMany({}),
      CartItem.deleteMany({}),
      Order.deleteMany({})
    ]);
    console.log('🧹 Cleared existing data');

    // === 1. Create Users ===
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const clientPassword = await bcrypt.hash('client123', salt);

    const adminUser = new User({
      username: 'admin',
      password: adminPassword,
      role: 'admin',
      name: 'Admin',
      email: 'admin@example.com',
      phone: '+84776467128',
      gender: 'male',
      addresses: [{
        name: 'Admin Office',
        phone: '+84776467128',
        address: '123 Tech Street, Hanoi',
        type: 'work',
        isDefault: true
      }]
    });

    await adminUser.save();
    console.log('✅ Created admin user');

    const clientUsers = [];
    for (let i = 0; i < 10; i++) {
      const user = new User({
        username: `client${i + 1}`,
        password: clientPassword,
        role: 'client',
        name: names[i],
        email: emails[i],
        phone: phones[i],
        gender: i % 2 === 0 ? 'male' : 'female',
        birthDate: new Date(1990 + i, 5, 15),
        addresses: [{
          name: names[i],
          phone: phones[i],
          address: `${i + 1} Main St, ${districts[i % districts.length]}, ${cities[i % cities.length]}`,
          type: 'home',
          isDefault: true
        }, {
          name: 'Work',
          phone: phones[i],
          address: `Office ${i + 1}, Tech Park, ${cities[i % cities.length]}`,
          type: 'work',
          isDefault: false
        }]
      });
      clientUsers.push(user);
    }
    await User.insertMany(clientUsers);
    console.log('✅ Created 10 client users');

    // === 2. Create Products (50) ===
    const products = [];
    for (let i = 0; i < 50; i++) {
      const brand = brands[Math.floor(Math.random() * brands.length)];
      const type = categories[Math.floor(Math.random() * categories.length)];
      const colorSet = [...new Set(Array.from({ length: Math.floor(Math.random() * 3) + 2 }, () => colors[Math.floor(Math.random() * colors.length)]))];
      const sizeSet = [...new Set(Array.from({ length: Math.floor(Math.random() * 4) + 2 }, () => sizes[Math.floor(Math.random() * sizes.length)]))];
      const basePrice = Math.floor(Math.random() * 2000000) + 200000; // 200K–2.2M VND
      const discount = Math.random() > 0.7 ? Math.floor(basePrice * 0.2) : 0;
      const price = basePrice - discount;
      const name = `${brand} ${type.charAt(0).toUpperCase() + type.slice(1)} ${['Basic', 'Premium', 'Slim', 'Oversize'][Math.floor(Math.random() * 4)]}`;

      const product = new Product({
        id: generateProductId(name, colorSet[0], sizeSet[0]),
        name,
        brand,
        price,
        originalPrice: basePrice,
        type,
        status: Math.random() > 0.1 ? 'selling' : 'stopped', // 10% stopped
        type: ['casual', 'formal', 'sport'][Math.floor(Math.random() * 3)],
        style: ['modern', 'classic', 'vintage'][Math.floor(Math.random() * 3)],
        colors: colorSet,
        sizes: sizeSet,
        sold: Math.floor(Math.random() * 200),
        total: 100,
        thumbnail: `https://placehold.co/300x400?text=${encodeURIComponent(brand + ' ' + type)}`,
        images: Array.from({ length: 3 }, (_, j) => `https://placehold.co/600x800?text=IMG${j + 1}-${encodeURIComponent(name)}`),
        description: `High-quality ${type} from ${brand}. Suitable for daily wear.`,
        details: 'Material: 100% cotton. Machine washable. Imported.',
      });
      products.push(product);
    }
    await Product.insertMany(products);
    console.log('✅ Created 50 products');

    // === 3. Create Reviews (200) ===
    // Assign ~4 reviews per product (some products get more/less)
    const reviews = [];
    const productIds = products.map(p => p.id); // string IDs
    const userIds = clientUsers.map(u => u._id);

    for (let i = 0; i < 200; i++) {
      const productId = productIds[Math.floor(Math.random() * productIds.length)];
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const rating = Math.floor(Math.random() * 3) + 3; // 3–5 stars mostly
      const comment = [
        'Great quality!', 'Fits perfectly.', 'Fast shipping.',
        'Color slightly different but still nice.', 'Will buy again.',
        'Slightly small, size up next time.', 'Excellent fabric.'
      ][Math.floor(Math.random() * 7)] || 'Nice product.';

      reviews.push({
        orderId: `ORD-${uuidv4().slice(0, 8).toUpperCase()}`,
        productId, // ← string
        userId,    // ← ObjectId
        rating,
        comment,
        images: Math.random() > 0.7 ? [`https://placehold.co/200x200?text=Review+Img`] : []
      });
    }
    await Review.insertMany(reviews);
    console.log('✅ Created 200 reviews');

    // === 4. Create Vouchers (20) ===
    const vouchers = [];
    const voucherNames = [
      'NEWUSER', 'SUMMER20', 'WELCOME10', 'FREESHIP', 'BLACKFRIDAY',
      'VIP50K', 'BIRTHDAY', 'FLASH25', 'LOYALTY', 'WEEKEND',
      'FASHION24', 'TET2025', 'SALE5', 'BIGDEAL', 'HAPPYHOUR',
      'STUDENT15', 'MEMBER20', 'FREEDOM', 'LUCKY777', 'GIFT2025'
    ];

    for (let i = 0; i < 20; i++) {
      const name = voucherNames[i] || `VOUCHER${i + 1}`;
      const type = Math.random() > 0.5 ? 'percentage' : 'fixed';
      const value = type === 'percentage' ? (Math.floor(Math.random() * 25) + 5) : (Math.floor(Math.random() * 5) + 1) * 10000; // 5–30% or 10K–60K
      const minOrder = [0, 100000, 200000, 500000][Math.floor(Math.random() * 4)];
      const now = new Date();
      const validFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead
      const isActive = Math.random() > 0.1; // 90% active

      vouchers.push({
        code: name,
        name: `${name} Discount`,
        description: `Special discount for ${name.toLowerCase()}.`,
        type,
        value,
        minOrderAmount: minOrder,
        validFrom,
        validUntil,
        maxUses: Math.random() > 0.5 ? 100 : 1,
        maxUsesPerUser: 1,
        isActive,
        createdBy: adminUser._id // ← ObjectId
      });
    }
    await Voucher.insertMany(vouchers);
    console.log('✅ Created 20 vouchers');

    // === 5. Assign Vouchers to Users (UserVoucher) ===
    const userVouchers = [];
    const voucherObjs = await Voucher.find();
    clientUsers.forEach(user => {
      // Give each user 3 random unused vouchers
      const selected = voucherObjs
        .filter(v => v.isActive && v.maxUsesPerUser >= 1)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      selected.forEach(v => {
        userVouchers.push({
          userId: user._id,    // ← ObjectId
          voucherId: v._id     // ← ObjectId
        });
      });
    });
    await UserVoucher.insertMany(userVouchers);
    console.log('✅ Assigned vouchers to users');

    // === 6. Create Cart Items (1–3 per client) ===
    const cartItems = [];
    clientUsers.forEach(user => {
      const count = Math.floor(Math.random() * 3) + 1; // 1–3 items
      for (let j = 0; j < count; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const color = product.colors[Math.floor(Math.random() * product.colors.length)];
        const size = product.sizes[Math.floor(Math.random() * product.sizes.length)];
        cartItems.push({
          userId: user._id.toString(), // ← string
          productId: product.id,       // ← string (the product's custom id)
          name: product.name,
          color,
          size,
          price: product.price,
          quantity: Math.floor(Math.random() * 3) + 1,
          image: product.thumbnail
        });
      }
    });
    await CartItem.insertMany(cartItems);
    console.log('✅ Created cart items');

    // === 7. Create Orders (2–3 per client) ===
    const orders = [];
    clientUsers.forEach(user => {
      const orderCount = Math.floor(Math.random() * 2) + 2; // 2–3 orders
      for (let j = 0; j < orderCount; j++) {
        const productCount = Math.floor(Math.random() * 3) + 1;
        const selectedProducts = [];
        let totalPrice = 0;

        for (let k = 0; k < productCount; k++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const quantity = Math.floor(Math.random() * 3) + 1;
          const selectedColor = product.colors[Math.floor(Math.random() * product.colors.length)];
          const selectedSize = product.sizes[Math.floor(Math.random() * product.sizes.length)];
          
          // 🔴 FIX: Dùng ObjectId của product trong orders
          selectedProducts.push({
            product: product._id, // ← ObjectId (the actual product document reference)
            quantity,
            selectedColor,
            selectedSize
          });
          totalPrice += product.price * quantity;
        }

        // Simulate status progression
        const statusOptions = [
          ['pending', 'paid'],
          ['paid', 'processing', 'shipped'],
          ['processing', 'shipped', 'delivered']
        ];
        const statusSeq = statusOptions[Math.floor(Math.random() * statusOptions.length)];
        const status = statusSeq[Math.floor(Math.random() * statusSeq.length)];

        // 🔴 FIX: Tạo ID duy nhất cho mỗi lần chạy seed (tránh trùng nếu chạy lại)
        const uniqueOrderId = `ORD-${Date.now().toString(36).toUpperCase().slice(-8)}-${uuidv4().slice(0, 4).toUpperCase()}`;

        orders.push({
          id: uniqueOrderId, // ← string
          user: user._id,    // ← ObjectId
          products: selectedProducts,
          totalPrice,
          status,
          paymentMethod: Math.random() > 0.3 ? 'seepay' : 'cod',
          shippingAddress: {
            fullName: user.name,
            phone: user.phone,
            addressLine: user.addresses.find(a => a.isDefault)?.address || 'Default address',
            city: cities[Math.floor(Math.random() * cities.length)],
            district: districts[Math.floor(Math.random() * districts.length)],
            ward: wards[Math.floor(Math.random() * wards.length)],
            note: Math.random() > 0.8 ? 'Leave at door' : ''
          }
        });
      }
    });
    await Order.insertMany(orders);
    console.log('✅ Created orders');

    console.log('\n🎉 Database seeded successfully!');
    console.log(`📊 Stats:\n  Users: ${1 + clientUsers.length}\n  Products: 50\n  Reviews: 200\n  Vouchers: 20\n  Orders: ~${orders.length}`);
  } catch (err) {
    console.error('❌ Seed failed:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run script
(async () => {
  await connectDB();
  await seed();
})();