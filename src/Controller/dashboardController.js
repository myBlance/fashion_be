const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

exports.getStats = async (req, res) => {
    try {
        const { timeRange = '7days', startDate, endDate } = req.query; // Get timeRange and custom dates
        const validStatuses = ['confirmed', 'paid', 'shipped', 'delivered'];

        // Calculate date range based on timeRange parameter
        let dateFilter = {};
        const now = new Date();

        switch (timeRange) {
            case '7days':
                const last7Days = new Date();
                last7Days.setDate(last7Days.getDate() - 7);
                last7Days.setHours(0, 0, 0, 0);
                dateFilter = { createdAt: { $gte: last7Days } };
                break;
            case 'month':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                dateFilter = { createdAt: { $gte: startOfMonth } };
                break;
            case 'year':
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                dateFilter = { createdAt: { $gte: startOfYear } };
                break;
            case 'custom':
                if (startDate && endDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    dateFilter = {
                        createdAt: {
                            $gte: start,
                            $lte: end
                        }
                    };
                }
                break;
            case 'all':
            default:
                dateFilter = {}; // No date filter for 'all'
                break;
        }

        // 1. Total Revenue (from valid orders)
        const revenueResult = await Order.aggregate([
            { $match: { status: { $in: validStatuses }, ...dateFilter } },
            { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // 1.1 Total Profit
        const profitResult = await Order.aggregate([
            { $match: { status: { $in: validStatuses }, ...dateFilter } },
            { $unwind: '$products' },
            {
                $group: {
                    _id: null,
                    totalProfit: {
                        $sum: {
                            $multiply: [
                                { $subtract: ['$products.price', { $ifNull: ['$products.buyPrice', 0] }] },
                                '$products.quantity'
                            ]
                        }
                    }
                }
            }
        ]);
        const totalProfit = profitResult.length > 0 ? profitResult[0].totalProfit : 0;

        // 2. Order counts by status
        const orderStats = await Order.aggregate([
            { $match: { ...dateFilter } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const ordersByStatus = {};
        orderStats.forEach(stat => {
            ordersByStatus[stat._id] = stat.count;
        });

        // 2.1 Total Orders (Filtered)
        const totalOrders = await Order.countDocuments({ ...dateFilter });

        // 3. Total Products
        const totalProducts = await Product.countDocuments();

        // 4. Total Users
        const totalUsers = await User.countDocuments({ role: 'client' });

        // 5. Revenue by date - determine date range based on timeRange
        let chartStartDate;
        let chartDays;

        switch (timeRange) {
            case '7days':
                chartStartDate = new Date();
                chartStartDate.setDate(chartStartDate.getDate() - 7);
                chartStartDate.setHours(0, 0, 0, 0);
                chartDays = 7;
                break;
            case 'month':
                chartStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
                chartDays = now.getDate(); // Days from start of month to today
                break;
            case 'year':
                chartStartDate = new Date(now.getFullYear(), 0, 1);
                chartDays = 12; // Show 12 months for year view
                break;
            case 'custom':
                if (startDate && endDate) {
                    chartStartDate = new Date(startDate);
                    chartStartDate.setHours(0, 0, 0, 0);
                    const endDateObj = new Date(endDate);
                    endDateObj.setHours(0, 0, 0, 0);
                    // Calculate number of days between start and end
                    chartDays = Math.ceil((endDateObj - chartStartDate) / (1000 * 60 * 60 * 24)) + 1;
                } else {
                    // Fallback if dates not provided
                    chartStartDate = new Date();
                    chartStartDate.setDate(chartStartDate.getDate() - 7);
                    chartStartDate.setHours(0, 0, 0, 0);
                    chartDays = 7;
                }
                break;
            case 'all':
            default:
                // For 'all', show last 30 days as default
                chartStartDate = new Date();
                chartStartDate.setDate(chartStartDate.getDate() - 30);
                chartStartDate.setHours(0, 0, 0, 0);
                chartDays = 30;
                break;
        }

        const revenueByDateRaw = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: chartStartDate },
                    status: { $in: validStatuses }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+07:00' } },
                    revenue: { $sum: '$totalPrice' },
                    profit: {
                        $sum: {
                            $reduce: {
                                input: '$products',
                                initialValue: 0,
                                in: {
                                    $add: [
                                        '$$value',
                                        {
                                            $multiply: [
                                                { $subtract: ['$$this.price', { $ifNull: ['$$this.buyPrice', 0] }] },
                                                '$$this.quantity'
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fill in missing dates
        const revenueByDate = [];
        for (let i = chartDays - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

            const found = revenueByDateRaw.find(item => item._id === dateStr);
            revenueByDate.push({
                _id: dateStr,
                revenue: found ? found.revenue : 0,
                profit: found ? found.profit : 0,
                orders: found ? found.orders : 0
            });
        }

        // 6. Top 10 selling products
        const topProducts = await Order.aggregate([
            { $match: { status: { $in: validStatuses }, ...dateFilter } },
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.product',
                    totalQuantity: { $sum: '$products.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$products.quantity', 1] } } // Will need to join with Product for actual price
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 }
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

        // 6.5. Top 10 profit products
        const topProfitProducts = await Order.aggregate([
            { $match: { status: { $in: validStatuses }, ...dateFilter } },
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.product',
                    totalProfit: {
                        $sum: {
                            $multiply: [
                                { $subtract: ['$products.price', { $ifNull: ['$products.buyPrice', 0] }] },
                                '$products.quantity'
                            ]
                        }
                    },
                    totalQuantity: { $sum: '$products.quantity' }
                }
            },
            { $sort: { totalProfit: -1 } },
            { $limit: 10 }
        ]);

        // Populate product details for top profit products
        const populatedTopProfitProducts = await Promise.all(
            topProfitProducts.map(async (item) => {
                const product = await Product.findById(item._id);
                return {
                    productId: item._id,
                    name: product?.name || 'Unknown Product',
                    image: product?.thumbnail || product?.images?.[0] || '',
                    totalProfit: item.totalProfit,
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

        // 8. Product counts by Type
        // Note: Products usually don't have a 'date' filter in the same way (inventory is current state).
        // However, if we want "Products sold by type in period", we'd need to query Orders.
        // Assuming user wants "Inventory breakdown", we keep it global. 
        // BUT, if the user requested "time filter check", they might expect consistency.
        // Let's keep Product Types as Global Inventory unless specifically asked, 
        // as filtering "Inventory" by "Orders date" is semantically ambiguous.
        // Wait, the previous request was just "Products by Type".
        // Let's stick to global for Product Types to represent "Current Stock/Catalog Structure".

        const productTypeStats = await Product.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);
        const productsByType = productTypeStats.map(stat => ({
            name: stat._id || 'Khác',
            value: stat.count
        }));

        res.json({
            success: true,
            data: {
                totalRevenue,
                totalProfit,
                totalOrders,
                totalProducts,
                totalUsers,
                ordersByStatus,
                revenueByDate,
                productsByType, // Added new stat
                topProducts: populatedTopProducts,
                topProfitProducts: populatedTopProfitProducts,
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
};
