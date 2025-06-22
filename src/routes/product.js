const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const generateProductId = require('../utils/generateProductId');

const router = express.Router();

/**
 * @route   GET /api/products
 * @desc    Lấy danh sách sản phẩm có phân trang, lọc, sắp xếp
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { _start = 0, _end = 10, _sort = 'createdAt', _order = 'DESC', ...filters } = req.query;

    const start = Number(_start);
    const end = Number(_end);
    const limit = end - start;
    const sortField = _sort === 'id' ? '_id' : _sort;
    const sortOrder = _order === 'ASC' ? 1 : -1;

    const query = {};
    for (let key in filters) {
      query[key] = new RegExp(filters[key], 'i'); // Tìm kiếm mờ (case-insensitive)
    }

    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(start)
      .limit(limit);

    res.setHeader('Content-Range', `products ${start}-${end - 1}/${total}`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');

    res.json(products);
  } catch (err) {
    console.error('❌ Lỗi GET /products:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Lấy thông tin sản phẩm theo ID (tuỳ chỉnh: mã sản phẩm như DOLA3901)
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id }); // <-- sửa chỗ này
    if (!product) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   POST /api/products
 * @desc    Thêm sản phẩm mới (tự động sinh mã ID)
 * @access  Private (cần xác thực nếu áp dụng middleware sau này)
 */
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Tên sản phẩm là bắt buộc'),
    body('brand').notEmpty().withMessage('Thương hiệu là bắt buộc'),
    body('price').isFloat({ min: 0 }).withMessage('Giá phải là số dương'),
    body('originalPrice').isFloat({ min: 0 }).withMessage('Giá gốc phải là số dương'),
    body('category').notEmpty().withMessage('Danh mục là bắt buộc'),
    body('type').notEmpty().withMessage('Loại sản phẩm là bắt buộc'),
    body('style').notEmpty().withMessage('Phong cách là bắt buộc'),
    body('delivery').notEmpty().withMessage('Phương thức giao hàng là bắt buộc'),
    body('total').isInt({ min: 0 }).withMessage('Tổng số lượng phải là số nguyên dương'),
    body('colors').isArray({ min: 1 }).withMessage('Phải chọn ít nhất 1 màu'),
    body('sizes').isArray({ min: 1 }).withMessage('Phải chọn ít nhất 1 kích cỡ')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Lỗi validation:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const id = await generateProductId();
      const productData = {
        ...req.body,
        id,
        sold: req.body.sold || 0,
        status: req.body.status || 'selling',
        thumbnail: req.body.thumbnail || 'default-thumbnail.jpg',
        images: req.body.images || ['default-image.jpg'],
        createdAt: new Date()
      };

      console.log('Dữ liệu sản phẩm sẽ lưu:', productData);
      
      const newProduct = new Product(productData);
      await newProduct.save();
      
      res.status(201).json(newProduct);
    } catch (err) {
      console.error('Lỗi khi lưu sản phẩm:', err);
      res.status(500).json({ 
        error: 'Lỗi server khi tạo sản phẩm',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  }
);

/**
 * @route   PUT /api/products/:id
 * @desc    Cập nhật thông tin sản phẩm
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const updated = await Product.findOneAndUpdate({ id: req.params.id }, req.body, { new: true }); // sửa
    if (!updated) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
/**
 * @route   DELETE /api/products/:id
 * @desc    Xoá sản phẩm theo ID
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({ id: req.params.id }); // sửa
    if (!deleted) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    res.json({ message: 'Đã xoá sản phẩm' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
