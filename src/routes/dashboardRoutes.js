// src/routes/dashboardRoutes.js
const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

const router = express.Router();

/**
 * @route   GET /api/admin/stats
 * @desc    Get dashboard statistics
 * @access  Admin
 */
router.get('/stats', async (req, res) => {
    try {
        // 1. Total Revenue (from paid orders)
        const revenueResult = await Order.aggregate([
            { $match: { status: { $in: ['paid', 'processing', 'shipped', 'delivered'] } } },
            { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // 2. Order counts by status
        const orderStats = await Order.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const ordersByStatus = {};
        orderStats.forEach(stat => {
            ordersByStatus[stat._id] = stat.count;
        });
        const totalOrders = await Order.countDocuments();

        // 3. Total Products
        const totalProducts = await Product.countDocuments();

        // 4. Total Users
        const totalUsers = await User.countDocuments({ role: 'client' });

        // 5. Revenue by date (last 7 days)
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const revenueByDate = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: last7Days },
                    status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    revenue: { $sum: '$totalPrice' },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 6. Top 5 selling products
        const topProducts = await Order.aggregate([
            { $match: { status: { $in: ['paid', 'processing', 'shipped', 'delivered'] } } },
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.product',
                    totalQuantity: { $sum: '$products.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$products.quantity', 1] } } // Will need to join with Product for actual price
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 }
        ]);

        // Populate product details
        const populatedTopProducts = await Promise.all(
            topProducts.map(async (item) => {
                const product = await Product.findById(item._id);
                return {
                    productId: item._id,
                    name: product?.name || 'Unknown Product',
                    image: product?.thumbnail || product?.images?.[0] || '',
                    soldQuantity: item.totalQuantity
                };
            })
        );

        // 7. Recent orders (last 10)
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('user', 'username email')
            .lean();

        // Format recent orders
        const formattedRecentOrders = recentOrders.map(order => ({
            id: order.id,
            customerName: order.shippingAddress?.fullName || order.user?.username || 'Unknown',
            totalPrice: order.totalPrice,
            status: order.status,
            createdAt: order.createdAt,
            paymentMethod: order.paymentMethod
        }));

        res.json({
            success: true,
            data: {
                totalRevenue,
                totalOrders,
                totalProducts,
                totalUsers,
                ordersByStatus,
                revenueByDate,
                topProducts: populatedTopProducts,
                recentOrders: formattedRecentOrders
            }
        });

    } catch (err) {
        console.error('❌ Error fetching dashboard stats:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

module.exports = router;
