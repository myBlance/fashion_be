const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const productController = require('../Controller/productController');

// -------------------- MULTER CONFIG --------------------
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir); // đảm bảo thư mục tồn tại

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
router.get('/', productController.getAllProducts);

// ======================================================
// 🔥 GET trending products (top 10 in last 7 days)
router.get('/trending', productController.getTrendingProducts);

// ======================================================
// 🟢 GET product by ID
router.get('/:id', productController.getProductById);

// ======================================================
// 🟢 POST (create) product
router.post(
  '/',
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  productController.createProduct
);

// ======================================================
// 🟢 PUT (update) product
router.put(
  '/:id',
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  productController.updateProduct
);

// ======================================================
// 🟢 DELETE product
router.delete('/:id', productController.deleteProduct);

module.exports = router;