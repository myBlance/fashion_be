const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, default: 1 },
      selectedColor: { type: String },   // nếu có chọn màu
      selectedSize: { type: String },    // nếu có chọn size
    }
  ],
  totalPrice: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  shippingAddress: {
    fullName: String,
    phone: String,
    addressLine: String,
    city: String,
    district: String,
    ward: String,
    note: String,
  },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
