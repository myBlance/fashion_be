const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const User = require('../models/User');

// --- ADMIN: CRUD Voucher ---
const createVoucher = async (req, res) => {
  try {
    let bodyData = req.body;

    // ✅ Nếu bodyData là undefined hoặc không phải object, kiểm tra xem có file không
    if (!bodyData || typeof bodyData !== 'object') {
      console.log('⚠️ req.body là:', req.body);
      console.log('⚠️ req có file không?', !!req.file);
      console.log('⚠️ req có files không?', !!req.files);

      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ hoặc không được gửi đúng định dạng',
      });
    }

    // ✅ FormData gửi từ React Admin sẽ có các trường là string, nên cần parse lại
    const {
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
      isActive
    } = bodyData;

    // ✅ Parse lại các trường số nếu là string
    const parsedValue = typeof value === 'string' ? parseFloat(value) : value;
    const parsedMinOrderAmount = typeof minOrderAmount === 'string' ? parseFloat(minOrderAmount) : minOrderAmount;
    const parsedMaxUses = typeof maxUses === 'string' ? parseInt(maxUses) : maxUses;
    const parsedMaxUsesPerUser = typeof maxUsesPerUser === 'string' ? parseInt(maxUsesPerUser) : maxUsesPerUser;
    const parsedIsActive = typeof isActive === 'string' ? isActive === 'true' : isActive;

    if (!code || !name || !type || parsedValue === undefined || parsedMinOrderAmount === undefined || !validFrom || !validUntil) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu trường bắt buộc',
      });
    }

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
      value: parsedValue,
      minOrderAmount: parsedMinOrderAmount,
      validFrom,
      validUntil,
      maxUses: parsedMaxUses || 1,
      maxUsesPerUser: parsedMaxUsesPerUser || 1,
      isActive: parsedIsActive !== undefined ? parsedIsActive : true,
      createdBy: req.user.id,
    });

    await voucher.save();
    res.status(201).json({
      success: true,
       voucher,
    });
  } catch (err) {
    console.error('Lỗi trong createVoucher:', err);

    // ✅ Xử lý lỗi duplicate key
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `Mã ${field} đã tồn tại`,
      });
    }

    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

const getAllVouchers = async (req, res) => {
  try {
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

    // Map dữ liệu an toàn
    const safeVouchers = vouchers.map(v => ({
      ...v._doc,
      validFrom: v.validFrom ? new Date(v.validFrom).toISOString() : null,
      validUntil: v.validUntil ? new Date(v.validUntil).toISOString() : null,
    }));

    res.json({
      success: true,
      data: safeVouchers, // ✅ đổi từ safeVouchers → data
    });
  } catch (err) {
    console.error('Lỗi trong getAllVouchers:', err);
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
  console.log('🚀 getUserVouchers được gọi');
  try {
    const userId = req.user.id;

    const userVouchers = await UserVoucher.find({ userId })
      .populate({
        path: 'voucherId',
        select: 'code name description type value minOrderAmount validFrom validUntil',
      })
      .sort({ createdAt: -1 });

    const data = userVouchers.map(uv => {
      if (!uv.voucherId) return null;
      const voucher = uv.voucherId;

      const expiryDate = voucher.validUntil
        ? new Date(voucher.validUntil).toISOString()
        : '2099-12-31T23:59:59.999Z';

      const discountValue = Number(voucher.value) || 0;
      const minOrderValue = Number(voucher.minOrderAmount) || 0;

      const discountText =
        voucher.type === 'percentage'
          ? `${discountValue}%`
          : `₫${discountValue.toLocaleString()}`;

      const conditionText = `Đơn tối thiểu ${minOrderValue.toLocaleString()} VND`;

      return {
        id: uv._id?.toString() || 'unknown-id',
        voucher: {
          _id: voucher._id?.toString() || 'unknown-voucher-id',
          code: voucher.code || 'NO_CODE',
          discountText,
          conditionText,
          isFreeShip: false,
          shopName: 'Shop ABC',
          minOrderValue,
          expiryDate,
          discountType: voucher.type || 'fixed',
          discountValue,
        },
        claimedAt: uv.createdAt?.toISOString?.() ?? new Date().toISOString(),
        usedAt: uv.usedAt?.toISOString?.() ?? null,
        isUsed: !!uv.usedAt,
      };
    }).filter(Boolean);

    res.json({
      success: true,
      data, // ✅ Chuẩn hóa về `data`
    });
  } catch (err) {
    console.error('❌ Lỗi trong getUserVouchers:', err);
    res.status(500).json({
      success: false,
      message: err.message,
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