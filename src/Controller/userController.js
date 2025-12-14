const mongoose = require('mongoose');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const Review = require('../models/Review');

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username })
            .select('-password -__v -createdAt -updatedAt');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại'
            });
        }

        return res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Lỗi khi lấy profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { name, email, avatarUrl, phone, gender, birthDate } = req.body;

    try {
        const user = await User.findOne({ username: req.user.username });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại'
            });
        }

        // Cập nhật các trường
        if (name !== undefined) user.name = name;
        if (email !== undefined) user.email = email;
        if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
        if (phone !== undefined) user.phone = phone;
        if (gender !== undefined) user.gender = gender;
        if (birthDate !== undefined) user.birthDate = birthDate;

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Cập nhật thông tin thành công',
            data: {
                username: user.username,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                phone: user.phone,
                gender: user.gender,
                birthDate: user.birthDate,
            }
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật profile:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Email đã được sử dụng bởi người khác'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getAddresses = async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username }).select('addresses');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại'
            });
        }

        return res.status(200).json({
            success: true,
            data: user.addresses
        });

    } catch (error) {
        console.error('Lỗi khi lấy danh sách địa chỉ:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ'
        });
    }
};

exports.addAddress = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    let { name, phone, address, isDefault } = req.body;

    try {
        const user = await User.findOne({ username: req.user.username });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại'
            });
        }

        // Nếu địa chỉ mới được đặt làm mặc định, xóa trạng thái mặc định của các địa chỉ khác
        if (isDefault) {
            user.addresses.forEach(addr => addr.isDefault = false);
        }

        // Nếu không có địa chỉ nào và đây là địa chỉ đầu tiên, đặt làm mặc định
        if (user.addresses.length === 0) {
            isDefault = true;
        }

        const newAddress = { name, phone, address, isDefault };
        user.addresses.push(newAddress);

        await user.save();

        // Trả về địa chỉ vừa được thêm (có _id từ MongoDB)
        const addedAddress = user.addresses[user.addresses.length - 1];
        return res.status(200).json({
            success: true,
            message: 'Thêm địa chỉ thành công',
            data: addedAddress
        });

    } catch (error) {
        console.error('Lỗi khi thêm địa chỉ:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ'
        });
    }
};

exports.updateAddress = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { name, phone, address, isDefault } = req.body;

    try {
        const user = await User.findOne({ username: req.user.username });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại'
            });
        }

        const addrIndex = user.addresses.findIndex(addr => addr._id.toString() === req.params.id);

        if (addrIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Địa chỉ không tồn tại'
            });
        }

        // Nếu địa chỉ được cập nhật thành mặc định, xóa trạng thái mặc định của các địa chỉ khác
        if (isDefault) {
            user.addresses.forEach(addr => addr.isDefault = false);
        }

        // Cập nhật địa chỉ
        if (name !== undefined) user.addresses[addrIndex].name = name;
        if (phone !== undefined) user.addresses[addrIndex].phone = phone;
        if (address !== undefined) user.addresses[addrIndex].address = address;
        if (isDefault !== undefined) user.addresses[addrIndex].isDefault = isDefault;

        await user.save();

        // Trả về địa chỉ đã được cập nhật
        return res.status(200).json({
            success: true,
            message: 'Cập nhật địa chỉ thành công',
            data: user.addresses[addrIndex]
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật địa chỉ:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ'
        });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại'
            });
        }

        const addrIndex = user.addresses.findIndex(addr => addr._id.toString() === req.params.id);

        if (addrIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Địa chỉ không tồn tại'
            });
        }

        user.addresses.splice(addrIndex, 1);

        // Nếu xóa địa chỉ mặc định, đặt địa chỉ đầu tiên làm mặc định
        if (user.addresses.length > 0 && !user.addresses.some(addr => addr.isDefault)) {
            user.addresses[0].isDefault = true;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Xóa địa chỉ thành công',
            data: user.addresses
        });

    } catch (error) {
        console.error('Lỗi khi xóa địa chỉ:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ'
        });
    }
};

exports.changePassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Lỗi validation:', errors.array());
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { password, newPassword } = req.body;

    try {
        const user = await User.findOne({ username: req.user.username });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
        }

        user.password = newPassword;
        await user.save();

        return res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công' });

    } catch (error) {
        console.error('Lỗi khi đổi mật khẩu:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

exports.debugTest = async (req, res) => {
    console.log('👤 /users/debug-test được gọi, req.user =', req.user);
    res.json({ message: 'OK from user route', user: req.user });
};

// --- Admin Functions ---

exports.getUsers = async (req, res) => {
    try {
        const { _end, _order, _sort, _start, q } = req.query;

        // 1. Match / Search
        const matchStage = {};
        if (q) {
            matchStage.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { username: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } }
            ];
        }

        // 2. Sorting
        const sortField = _sort || 'createdAt';
        const sortOrder = _order === 'ASC' ? 1 : -1;
        const sortStage = { [sortField]: sortOrder };

        // 3. Pagination
        const start = parseInt(_start) || 0;
        const end = parseInt(_end) || 10;
        const limit = end - start;

        const pipeline = [
            // Step 1: Filter Users
            { $match: matchStage },

            // Step 2: Lookup Orders (Calculate Spent & Products)
            {
                $lookup: {
                    from: 'orders',
                    let: { userId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$user', '$$userId'] },
                                status: { $in: ['delivered', 'paid', 'shipped'] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalSpent: { $sum: '$totalPrice' },
                                totalProducts: { $sum: { $sum: '$products.quantity' } }
                            }
                        }
                    ],
                    as: 'orderStats'
                }
            },

            // Step 3: Lookup Reviews (Count Reviews)
            {
                $lookup: {
                    from: 'reviews',
                    let: { userId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$userId', '$$userId'] } } },
                        { $count: 'count' }
                    ],
                    as: 'reviewStats'
                }
            },

            // Step 4: Extract Values & Format
            {
                $addFields: {
                    id: '$_id', // React Admin requires 'id'
                    totalSpent: { $ifNull: [{ $arrayElemAt: ['$orderStats.totalSpent', 0] }, 0] },
                    totalProductsBought: { $ifNull: [{ $arrayElemAt: ['$orderStats.totalProducts', 0] }, 0] },
                    totalReviews: { $ifNull: [{ $arrayElemAt: ['$reviewStats.count', 0] }, 0] }
                }
            },

            // Step 5: Sort (Now supports sorting by computed fields!)
            { $sort: sortStage },

            // Step 6: Fach for Data & Total Count
            {
                $facet: {
                    data: [{ $skip: start }, { $limit: limit }],
                    totalCount: [{ $count: 'count' }]
                }
            }
        ];

        const results = await User.aggregate(pipeline);

        const users = results[0].data;
        const total = results[0].totalCount[0] ? results[0].totalCount[0].count : 0;

        // Cleanup intermediate fields if necessary (or just send as is)
        const formattedUsers = users.map(user => {
            const { orderStats, reviewStats, __v, password, ...rest } = user;
            return rest;
        });

        res.set('X-Total-Count', total);
        res.set('Access-Control-Expose-Headers', 'X-Total-Count');
        res.json(formattedUsers);

    } catch (error) {
        console.error('Lỗi khi lấy danh sách users:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -__v');
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }
        res.json({ id: user._id, ...user.toObject() });
    } catch (error) {
        console.error('Lỗi khi lấy user:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { name, email, role, phone, active } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        if (name !== undefined) user.name = name;
        if (email !== undefined) user.email = email;
        if (role !== undefined) user.role = role;
        if (phone !== undefined) user.phone = phone;
        // if (active !== undefined) user.isActive = active; // Assuming there is an isActive field, if not, remove or add to schema

        await user.save();
        res.json({ id: user._id, ...user.toObject() });
    } catch (error) {
        console.error('Lỗi khi cập nhật user:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }
        res.json({ id: user._id, ...user.toObject() });
    } catch (error) {
        console.error('Lỗi khi xóa user:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
