const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const { clearCartAfterOrder } = require('../utils/cartUtils');

exports.getOrders = async (req, res) => {
    try {
        const { _start = 0, _end = 10, _sort = 'createdAt', _order = 'DESC', status, ...filters } = req.query;

        const start = Number(_start);
        const end = Number(_end);
        const limit = end - start;
        const sortField = _sort === 'id' ? '_id' : _sort;
        const sortOrder = _order === 'ASC' ? 1 : -1;

        // Build query
        const query = { ...filters };
        if (status && status !== 'all') {
            query.status = status;
        }

        // 🔒 SECURITY: Non-admin users can only see their own orders
        if (req.user && req.user.role !== 'admin') {
            query.user = req.user.id;
        }

        const total = await Order.countDocuments(query);

        const orders = await Order.find(query)
            .sort({ [sortField]: sortOrder })
            .skip(start)
            .limit(limit)
            .populate('user', 'username email');

        // Populate sản phẩm thủ công (xử lý trường hợp product null hoặc bị xóa)
        const populatedOrders = await Promise.all(orders.map(async (order) => {
            const populatedProducts = await Promise.all(order.products.map(async (item) => {
                // item.product đang lưu ObjectId trong DB
                const productDetails = await Product.findById(item.product);
                return {
                    ...item._doc,
                    product: productDetails ? {
                        _id: productDetails._id,
                        name: productDetails.name,
                        price: productDetails.price,
                        image: productDetails.thumbnail || productDetails.images?.[0] || '',
                    } : {
                        _id: null,
                        name: 'Sản phẩm không tồn tại (đã xóa)',
                        price: 0,
                        image: '',
                    }
                };
            }));
            return {
                ...order._doc,
                products: populatedProducts,
            };
        }));

        res.setHeader('Content-Range', `orders ${start}-${end - 1}/${total}`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range');

        res.json(populatedOrders);
    } catch (err) {
        console.error('❌ Lỗi GET /orders:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findOne({ id: req.params.id })
            .populate('user', 'username email');

        if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

        // 🔒 SECURITY: Check ownership
        if (req.user.role !== 'admin' && order.user._id.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Bạn không có quyền xem đơn hàng này' });
        }

        // Populate sản phẩm thủ công
        const populatedProducts = await Promise.all(order.products.map(async (item) => {
            const productDetails = await Product.findById(item.product);
            return {
                ...item._doc,
                product: productDetails ? {
                    _id: productDetails._id,
                    name: productDetails.name,
                    price: productDetails.price,
                    image: productDetails.thumbnail || productDetails.images?.[0] || '',
                } : {
                    _id: null,
                    name: 'Sản phẩm không tồn tại',
                    price: 0,
                    image: '',
                }
            };
        }));

        res.json({
            ...order._doc,
            products: populatedProducts,
        });
    } catch (err) {
        console.error('❌ Lỗi GET /orders/:id:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createOrder = async (req, res) => {
    try {
        // Lấy shippingMethod và shippingFee từ body
        const { products, shippingMethod, shippingFee, voucherCode, ...orderData } = req.body; // Nhận voucherCode

        // Kiểm tra User
        const userId = orderData.user;
        if (!userId) {
            return res.status(400).json({ error: 'User không được xác định.' });
        }

        // Chuyển đổi ID sản phẩm (String từ FE -> ObjectId trong DB)
        const populatedProducts = await Promise.all(products.map(async (item) => {
            // Tìm product bằng field 'id' (string) mà FE gửi lên
            const productDoc = await Product.findOne({ id: item.product });
            if (!productDoc) {
                throw new Error(`Sản phẩm với ID ${item.product} không tồn tại`);
            }

            // CHECK STOCK
            const availableStock = (productDoc.total || 0) - (productDoc.sold || 0);
            if (item.quantity > availableStock) {
                throw new Error(`Sản phẩm "${productDoc.name}" chỉ còn ${availableStock} sản phẩm (bạn đặt ${item.quantity})`);
            }

            return {
                ...item,
                product: productDoc._id, // Lưu ObjectId vào Order
                price: productDoc.price, // Snapshot giá bán
                buyPrice: productDoc.importPrice || 0, // Snapshot giá nhập (để tính lãi)
            };
        }));

        // 🔍 XỬ LÝ VOUCHER (Nếu có)
        let finalAmount = orderData.totalPrice; // Giả sử FE gửi totalPrice lên
        let discountAmount = 0;
        let appliedVoucher = null;
        let userVoucherRecord = null;

        if (voucherCode) {
            console.log(`🎫 [Order Route] Đang kiểm tra voucher: ${voucherCode}`);
            const voucher = await Voucher.findOne({
                code: voucherCode.toUpperCase(),
                isActive: true,
                validFrom: { $lte: new Date() },
                validUntil: { $gte: new Date() }
            });

            if (!voucher) {
                return res.status(400).json({ error: 'Voucher không hợp lệ hoặc đã hết hạn.' });
            }

            // 1. Kiểm tra số lượng sử dụng toàn hệ thống
            // Default to 1 if not defined to prevent infinite usage on legacy data
            const maxUses = (voucher.maxUses === undefined || voucher.maxUses === null) ? 1 : voucher.maxUses;
            if (maxUses > 0 && (voucher.usedCount || 0) >= maxUses) {
                return res.status(400).json({ error: 'Voucher đã hết lượt sử dụng.' });
            }

            // Kiểm tra UserVoucher
            userVoucherRecord = await UserVoucher.findOne({ userId, voucherId: voucher._id });

            if (!userVoucherRecord) {
                return res.status(400).json({ error: 'Bạn chưa lưu voucher này.' });
            }

            // 2. Kiểm tra số lần sử dụng của user
            // Backward compatibility: If usageCount is 0 but usedAt is set, assume 1 usage
            const currentUsage = userVoucherRecord.usageCount || (userVoucherRecord.usedAt ? 1 : 0);
            const maxUsesPerUser = (voucher.maxUsesPerUser === undefined || voucher.maxUsesPerUser === null) ? 1 : voucher.maxUsesPerUser;

            if (maxUsesPerUser > 0 && currentUsage >= maxUsesPerUser) {
                return res.status(400).json({ error: `Bạn đã dùng hết ${maxUsesPerUser} lượt sử dụng cho voucher này.` });
            }

            // Tính lại subTotal để verify
            let subTotal = 0;
            for (const p of populatedProducts) {
                // p.product là ObjectId, cần query lại giá nếu muốn chính xác tuyệt đối, 
                // hoặc nếu populatedProducts đã có price thì dùng luôn.
                // Ở bước trên ta chỉ gán product: productDoc._id, nên cần query lại productDoc
                const prod = await Product.findById(p.product);
                if (prod) subTotal += prod.price * p.quantity;
            }

            if (subTotal < voucher.minOrderAmount) {
                return res.status(400).json({ error: `Đơn hàng chưa đạt tối thiểu ${voucher.minOrderAmount.toLocaleString()}đ để dùng voucher.` });
            }

            // Tính giảm giá
            if (voucher.type === 'percentage') {
                discountAmount = (subTotal * voucher.value) / 100;
            } else {
                discountAmount = voucher.value;
            }

            if (discountAmount > subTotal) discountAmount = subTotal;
            finalAmount = subTotal - discountAmount + (shippingFee || 0);

            appliedVoucher = voucher;
        }

        const newOrder = new Order({
            ...orderData,
            user: userId,
            products: populatedProducts,
            shippingMethod: shippingMethod || 'standard',
            shippingFee: shippingFee || 0,
            totalPrice: appliedVoucher ? finalAmount : orderData.totalPrice,
            voucherCode: appliedVoucher ? appliedVoucher.code : null,
            discountAmount: discountAmount
        });

        const saved = await newOrder.save();

        // UPDATE SOLD COUNT & STOCK (Including Variants)
        for (const item of populatedProducts) {
            // 1. Update Global Sold Count
            const globalUpdate = { $inc: { sold: item.quantity } };

            // 2. Update Variant Quantity & Sold (if color/size exists)
            if (item.selectedColor && item.selectedSize) {
                // Use array filters to update specific variant element
                await Product.findOneAndUpdate(
                    {
                        _id: item.product,
                        "variants": {
                            $elemMatch: {
                                color: item.selectedColor,
                                size: item.selectedSize
                            }
                        }
                    },
                    {
                        $inc: {
                            "variants.$.quantity": -item.quantity,
                            "variants.$.sold": item.quantity,
                            "sold": item.quantity // Also increment global sold here if found
                        }
                    }
                );
            } else {
                // Fallback: Just update global sold if no variant info
                await Product.findByIdAndUpdate(item.product, globalUpdate);
            }
        }

        // CẬP NHẬT TRẠNG THÁI VOUCHER
        if (appliedVoucher) {
            console.log(`🎫 Updating voucher ${appliedVoucher.code} usage. Current usedCount: ${appliedVoucher.usedCount}`);
            // Increase global used count
            const updatedVoucher = await Voucher.findByIdAndUpdate(appliedVoucher._id, { $inc: { usedCount: 1 } }, { new: true });
            console.log(`🎫 Updated voucher usedCount to: ${updatedVoucher.usedCount}`);

            // Increase user usage count logic using atomic update
            if (userVoucherRecord) {
                await UserVoucher.findOneAndUpdate(
                    { _id: userVoucherRecord._id },
                    {
                        $set: {
                            usedAt: new Date(),
                            orderId: saved._id
                        },
                        $inc: { usageCount: 1 }
                    }
                );
            }
        }

        // Xóa giỏ hàng sau khi đặt thành công
        await clearCartAfterOrder(userId, products);

        // Trả về dữ liệu đầy đủ
        const populatedOrder = await Order.findById(saved._id)
            .populate('user', 'username email')
            .populate('products.product', 'name price thumbnail images');

        res.status(201).json(populatedOrder);
    } catch (err) {
        console.error('❌ Lỗi POST /orders:', err);
        res.status(400).json({ error: err.message });
    }
};

exports.updateOrder = async (req, res) => {
    try {
        const { products, ...updateData } = req.body;

        // Nếu có cập nhật danh sách sản phẩm, cần chuyển đổi lại ID
        if (products) {
            const populatedProducts = await Promise.all(products.map(async (item) => {
                // Nếu item.product đã là ObjectId thì giữ nguyên, nếu là String ID thì tìm
                if (mongoose.Types.ObjectId.isValid(item.product)) {
                    return item;
                }

                const productDoc = await Product.findOne({ id: item.product });
                if (!productDoc) {
                    throw new Error(`Sản phẩm ${item.product} không tồn tại`);
                }
                return {
                    ...item,
                    product: productDoc._id,
                };
            }));
            updateData.products = populatedProducts;
        }

        // updateData sẽ tự động chứa shippingMethod/shippingFee nếu FE gửi lên
        const updated = await Order.findOneAndUpdate({ id: req.params.id }, updateData, {
            new: true,
        });

        if (!updated) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

        const populatedOrder = await Order.findById(updated._id)
            .populate('user', 'username email')
            .populate('products.product', 'name price thumbnail images');

        res.json(populatedOrder);
    } catch (err) {
        console.error('❌ Lỗi PUT /orders/:id:', err);
        res.status(400).json({ error: err.message });
    }
};

exports.markOrderDelivered = async (req, res) => {
    try {
        const order = await Order.findOne({ id: req.params.id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        if (order.status !== 'shipped') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể đánh dấu đơn hàng đang giao là đã nhận' });
        }

        order.status = 'delivered';
        await order.save();

        const populatedOrder = await Order.findById(order._id)
            .populate('user', 'username email')
            .populate('products.product', 'name price thumbnail images');

        res.json({ success: true, order: populatedOrder });
    } catch (err) {
        console.error('❌ Lỗi PUT /mark-delivered:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findOne({ id: req.params.id });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        if (order.status !== 'pending' && order.status !== 'paid') {
            return res.status(400).json({ success: false, message: 'Không thể hủy đơn hàng ở trạng thái này' });
        }

        // 🔴 LOGIC CHUYỂN ĐỔI: Đảm bảo products chứa ObjectId hợp lệ trước khi save()
        const convertedProducts = [];
        for (const item of order.products) {
            // Case 1: product là string (custom ID chưa populate)
            if (typeof item.product === 'string') {
                const productDoc = await Product.findOne({ id: item.product });
                if (productDoc) {
                    convertedProducts.push({ ...item.toObject(), product: productDoc._id });
                } else {
                    console.warn(`Sản phẩm ${item.product} không tìm thấy khi hủy đơn. Bỏ qua.`);
                }
            }
            // Case 2: product là ObjectId hợp lệ
            else if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
                convertedProducts.push(item.toObject());
            }
            // Case 3: Lỗi data -> Bỏ qua
            else {
                continue;
            }
        }

        order.products = convertedProducts;
        order.status = 'cancelled';

        const updatedOrder = await order.save();

        const populatedOrder = await Order.findById(updatedOrder._id)
            .populate('user', 'username email')
            .populate('products.product', 'name price thumbnail images');

        res.json({ success: true, populatedOrder });
    } catch (err) {
        console.error('❌ Lỗi PUT /cancel:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const deleted = await Order.findOneAndDelete({ id: req.params.id });
        if (!deleted) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

        // Trả về JSON response thay vì 204 empty
        res.json({
            success: true,
            message: 'Đã xóa đơn hàng thành công',
            data: { id: deleted.id, _id: deleted._id }
        });
    } catch (err) {
        console.error('❌ Lỗi DELETE /orders/:id:', err);
        res.status(400).json({ error: err.message });
    }
};
