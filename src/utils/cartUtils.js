// ✅ src/utils/cartUtils.js
const CartItem = require('../models/CartItem');

const clearCartAfterOrder = async (userId, products) => {
  try {
    if (!userId || !products || !Array.isArray(products) || products.length === 0) {
      console.log('⚠️ Không có userId hoặc products hợp lệ để xóa giỏ.', { userId, products });
      return { deletedCount: 0 };
    }

    // Lấy danh sách product *string ID* từ đơn hàng
    const productStringIds = products.map(p => p.product || p.productId).filter(Boolean);

    if (productStringIds.length === 0) {
      console.log('⚠️ Không tìm thấy product ID nào hợp lệ trong mảng products:', products);
      return { deletedCount: 0 };
    }

    // ✅ DÙNG `userId` và `productId` như trong schema DB
    const result = await CartItem.deleteMany({
      userId: userId,           // ← string
      productId: { $in: productStringIds }  // ← string
    });

    console.log(`🗑️ clearCartAfterOrder: Đã xóa ${result.deletedCount} sản phẩm khỏi giỏ của user ${userId}.`, {
      userId,
      productStringIds,
    });

    return result;
  } catch (err) {
    console.error('❌ Lỗi trong clearCartAfterOrder:', err);
    throw err;
  }
};

module.exports = { clearCartAfterOrder };