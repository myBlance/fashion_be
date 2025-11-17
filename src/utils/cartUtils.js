const CartItem = require('../models/CartItem');

async function clearCartAfterOrder(userId, products) {
  try {
    for (const item of products) {
      await CartItem.deleteOne({
        userId: userId,
        productId: item.productId,
        color: item.color || '',
        size: item.size || ''
      });
    }
    console.log(`🗑️ Đã xóa các sản phẩm trong giỏ hàng của người dùng ${userId} sau khi tạo đơn.`);
  } catch (err) {
    console.error('❌ Lỗi khi xóa sản phẩm khỏi giỏ hàng:', err);
  }
}

module.exports = { clearCartAfterOrder };