const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const User = require('../models/User');

// --- ADMIN: CRUD Voucher ---
const createVoucher = async (req, res) => {
  try {
    const { code, name, description, type, value, minOrderAmount, validFrom, validUntil, maxUses, maxUsesPerUser, isActive } = req.body;

    // validate date
    if (new Date(validFrom) >= new Date(validUntil)) {
      return res.status(400).json({ 
        success: false,
        message: 'validFrom must be before validUntil' 
      });
    }

    const voucher = new Voucher({
      code,
      name,
      description,
      type,
      value,
      minOrderAmount,
      validFrom,
      validUntil,
      maxUses,
      maxUsesPerUser,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id, // giả sử đã dùng middleware auth & req.user là admin
    });

    await voucher.save();
    res.status(201).json({
      success: true,
      data: voucher,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

const getAllVouchers = async (req, res) => {
  try {
    // ✅ Sửa lại để trả về đúng cấu trúc
    const isPublic = req.originalUrl.includes('/public');

    let filters = {};
    if (isPublic) {
      filters = {
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
      };
    }

    const vouchers = await Voucher.find(filters).populate('createdBy', 'username name');
    res.json({
      success: true,
      data: vouchers,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const getVoucherById = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id).populate('createdBy', 'username name');
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found',
      });
    }
    // ✅ Trả về đúng cấu trúc
    res.json({
      success: true,
      data: voucher,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const updateVoucher = async (req, res) => {
  try {
    const { code, name, description, type, value, minOrderAmount, validFrom, validUntil, maxUses, maxUsesPerUser, isActive } = req.body;

    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found',
      });
    }

    voucher.set({
      code,
      name,
      description,
      type,
      value,
      minOrderAmount,
      validFrom,
      validUntil,
      maxUses,
      maxUsesPerUser,
      isActive,
    });

    await voucher.save();
    res.json({
      success: true,
      data: voucher,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

const deleteVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findByIdAndDelete(req.params.id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found',
      });
    }
    // Xóa luôn các UserVoucher liên quan (hoặc soft-delete nếu cần)
    await UserVoucher.deleteMany({ voucherId: voucher._id });
    res.json({
      success: true,
      message: 'Voucher deleted',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// --- CLIENT: Quản lý voucher cá nhân ---

// Nhận/gán voucher cho người dùng (theo code)
const claimVoucher = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id; // giả sử đã auth

    const voucher = await Voucher.findOne({
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher không tồn tại hoặc đã hết hạn',
      });
    }

    // Kiểm tra đã nhận chưa (theo maxUsesPerUser)
    const usedCount = await UserVoucher.countDocuments({
      userId,
      voucherId: voucher._id,
      usedAt: { $ne: null },
    });

    if (usedCount >= voucher.maxUsesPerUser) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã sử dụng voucher này đủ số lần cho phép',
      });
    }

    // Kiểm tra còn lượt nhận chung không (nếu maxUses hữu hạn)
    const totalClaimed = await UserVoucher.countDocuments({
      voucherId: voucher._id,
    });

    if (voucher.maxUses > 0 && totalClaimed >= voucher.maxUses) {
      return res.status(400).json({
        success: false,
        message: 'Voucher đã hết lượt sử dụng',
      });
    }

    // Tạo UserVoucher (chưa dùng)
    const userVoucher = new UserVoucher({
      userId,
      voucherId: voucher._id,
    });

    await userVoucher.save();
    res.status(201).json({
      success: true,
      message: 'Nhận voucher thành công!',
      // Nếu bạn muốn trả về voucher đã nhận
      // voucher: voucher,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Xem danh sách voucher của người dùng (chưa dùng + đã dùng)
const getUserVouchers = async (req, res) => {
  console.log('🚀 getUserVouchers được gọi'); // ✅ Log đầu tiên
  console.log('👤 req.user.id =', req.user.id);

  try {
    // ✅ Thêm log để xác nhận userId là gì
    const userId = req.user.id;
    console.log('🔍 Tìm UserVoucher với userId =', userId);

    // ✅ Thêm log trước khi query
    console.log('🔍 Bắt đầu query UserVoucher.find');

    const userVouchers = await UserVoucher.find({ userId })
      .populate({
        path: 'voucherId',
        select: 'code name description type value minOrderAmount validFrom validUntil',
      })
      .sort({ createdAt: -1 });

    console.log('✅ Query thành công, số lượng =', userVouchers.length);

    // ✅ Thêm log trước khi map
    console.log('🔍 Bắt đầu map dữ liệu');

    const result = userVouchers.map(uv => {
      if (!uv.voucherId) {
        console.warn('⚠️ VoucherId không tồn tại cho UserVoucher:', uv._id);
        return null;
      }

      const voucher = uv.voucherId;

      let expiryDate = '2099-12-31T23:59:59.999Z';
      if (voucher.validUntil) {
        const date = new Date(voucher.validUntil);
        if (!isNaN(date.getTime())) {
          expiryDate = date.toISOString();
        } else {
          console.warn('⚠️ validUntil không hợp lệ:', voucher.validUntil);
        }
      }

      let discountText = 'Giảm giá';
      if (voucher.type === 'percentage') {
        discountText = `${voucher.value || 0}%`;
      } else if (voucher.type === 'fixed') {
        discountText = `₫${(voucher.value || 0).toLocaleString()}`;
      }

      let conditionText = `Đơn tối thiểu 0 VND`;
      if (voucher.minOrderAmount) {
        conditionText = `Đơn tối thiểu ${(voucher.minOrderAmount || 0).toLocaleString()} VND`;
      }

      return {
        id: uv._id?.toString() || 'unknown-id',
        voucher: {
          _id: voucher._id?.toString() || 'unknown-voucher-id',
          code: voucher.code || 'NO_CODE',
          discountText,
          conditionText,
          isFreeShip: false,
          shopName: 'Shop ABC',
          minOrderValue: voucher.minOrderAmount || 0,
          expiryDate,
          discountType: voucher.type || 'fixed',
          discountValue: voucher.value || 0,
        },
        claimedAt: uv.createdAt?.toISOString ? uv.createdAt.toISOString() : '2023-01-01T00:00:00.000Z',
        usedAt: uv.usedAt ? (uv.usedAt.toISOString ? uv.usedAt.toISOString() : null) : null,
        isUsed: !!uv.usedAt,
      };
    }).filter(Boolean);

    console.log('✅ Map hoàn tất, số lượng =', result.length);

    res.json({
      success: true,
       result,
    });
  } catch (err) {
    console.error('❌ LỖI CHI TIẾT TRONG getUserVouchers:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};



// [Tuỳ chọn] Dùng voucher (trong flow tạo đơn hàng)
const useVoucher = async (req, res) => {
  // Logic này thường nằm trong service tạo đơn hàng
  // Ví dụ: validate mã, kiểm tra đã dùng chưa, cập nhật usedAt, gắn vào đơn
  // → Có thể triển khai sau nếu bạn có hệ thống Order
};

module.exports = {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  updateVoucher,
  deleteVoucher,
  claimVoucher,
  getUserVouchers,
  useVoucher,
};