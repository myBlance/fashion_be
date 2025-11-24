const express = require('express');
const Product = require('../models/Product');
const generateProductId = require('../utils/generateProductId');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// -------------------- MULTER CONFIG --------------------
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir); // ✅ đảm bảo thư mục tồn tại

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// ======================================================
// 🟢 GET all products
router.get('/', async (req, res) => {
  try {
    const { _start = 0, _end = 10, _sort = 'createdAt', _order = 'DESC' } = req.query;
    
    const total = await Product.countDocuments();
    const sort = {};
    sort[_sort] = _order === 'DESC' ? -1 : 1;

    const products = await Product.find()
      .sort(sort)
      .skip(Number(_start))
      .limit(Number(_end) - Number(_start));

    // ✅ ép tất cả có field id
    const formatted = products.map((p) => {
      const obj = p.toObject();
      obj.id = obj.id || obj._id;
      return obj;
    });

    res.set('Access-Control-Expose-Headers', 'Content-Range');
    res.set('Content-Range', `products ${_start}-${_end}/${total}`);
    res.status(200).json(formatted);
  } catch (err) {
    console.error('❌ Lỗi GET products:', err);
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// 🟢 GET product by ID
router.get('/:id', async (req, res) => {
  try {
    const product =
      (await Product.findOne({ id: req.params.id })) ||
      (await Product.findById(req.params.id)); // ✅ fallback theo _id

    if (!product) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });

    const clean = product.toObject();
    clean.id = clean.id || clean._id; // đảm bảo có id để frontend đọc
    res.json(clean);
  } catch (err) {
    console.error('❌ Lỗi GET product:', err);
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// 🟢 POST (create) product
router.post(
  '/',
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const id = await generateProductId();

      // 🖼 Ảnh đại diện
      const thumbnailUrl = req.files?.thumbnail?.[0]
        ? `${req.protocol}://${req.get('host')}/uploads/${req.files.thumbnail[0].filename}`
        : null;

      // 🖼 Ảnh phụ
      const imagesUrls = req.files?.images
        ? req.files.images.map((f) => `${req.protocol}://${req.get('host')}/uploads/${f.filename}`)
        : [];

      // 🧩 Parse an toàn
      const parseArray = (field) => {
        if (!field) return [];
        try {
          if (typeof field === 'string') return JSON.parse(field);
          if (Array.isArray(field)) return field.filter(Boolean);
          return [];
        } catch {
          return [];
        }
      };

      // ✅ Bắt buộc có tên sản phẩm
      if (!req.body.name) {
        return res.status(400).json({ error: 'Thiếu tên sản phẩm' });
      }

      const productData = {
        id,
        name: req.body.name,
        brand: req.body.brand || '',
        type: req.body.type || '',
        style: req.body.style || '',
        price: Number(req.body.price) || 0,
        originalPrice: Number(req.body.originalPrice) || 0,
        total: Number(req.body.total) || 0,
        sold: Number(req.body.sold) || 0,
        status: req.body.status || 'selling',
        thumbnail: thumbnailUrl,
        images: imagesUrls,
        colors: parseArray(req.body.colors),
        sizes: parseArray(req.body.sizes),
        description: req.body.description || '',
        details: req.body.details || '',
        createdAt: new Date(),
      };

      const newProduct = new Product(productData);
      await newProduct.save();

      const clean = newProduct.toObject();
      clean.id = clean.id || clean._id;

      res.status(201).json(clean);
    } catch (err) {
      console.error('❌ Lỗi khi tạo sản phẩm:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ======================================================
// 🟢 PUT (update) product
router.put(
  '/:id',
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const product = await Product.findOne({ id: req.params.id });
      if (!product) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });

      const updateData = { ...req.body };
      delete updateData.id;
      delete updateData._id;

      // 🖼 Thumbnail
      if (req.files?.thumbnail?.[0]) {
        updateData.thumbnail = `${req.protocol}://${req.get('host')}/uploads/${req.files.thumbnail[0].filename}`;
      }

      // 🖼 Images
      if (req.files?.images?.length > 0) {
        updateData.images = req.files.images.map(
          (f) => `${req.protocol}://${req.get('host')}/uploads/${f.filename}`
        );
      }

      const safeParse = (val) => {
        if (!val) return [];
        try {
          if (typeof val === 'string') return JSON.parse(val);
          if (Array.isArray(val)) return val.filter(Boolean);
          return [];
        } catch {
          return [];
        }
      };

      updateData.colors = safeParse(updateData.colors);
      updateData.sizes = safeParse(updateData.sizes);

      // ✅ Parse description và details
      updateData.description = updateData.description || '';
      // ✅ Gửi details dưới dạng string
      updateData.details = updateData.details || '';

      ['price', 'originalPrice', 'total', 'sold'].forEach((key) => {
        if (updateData[key] !== undefined) updateData[key] = Number(updateData[key]);
      });

      const updated = await Product.findOneAndUpdate({ id: req.params.id }, updateData, { new: true });
      if (!updated) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });

      const clean = updated.toObject();
      clean.id = clean.id || clean._id;

      res.json(clean);
    } catch (err) {
      console.error('❌ Lỗi cập nhật sản phẩm:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ======================================================
// 🟢 DELETE product
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    res.json({ message: 'Đã xoá sản phẩm' });
  } catch (err) {
    console.error('❌ Lỗi xoá sản phẩm:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;