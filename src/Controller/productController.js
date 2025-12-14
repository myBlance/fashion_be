const Product = require('../models/Product');
const generateProductId = require('../utils/generateProductId');

exports.getAllProducts = async (req, res) => {
    try {
        const { _start = 0, _end = 10, _sort = 'createdAt', _order = 'DESC' } = req.query;

        const total = await Product.countDocuments();
        const sort = {};
        sort[_sort] = _order === 'DESC' ? -1 : 1;

        const products = await Product.find()
            .sort(sort)
            .skip(Number(_start))
            .limit(Number(_end) - Number(_start));

        // Format URL ảnh đầy đủ
        const formatProductImage = (p) => {
            const obj = p.toObject();
            obj.id = obj.id || obj._id;

            // Xử lý thumbnail
            if (obj.thumbnail && obj.thumbnail.startsWith('/uploads/')) {
                obj.thumbnail = `${req.protocol}://${req.get('host')}${obj.thumbnail}`;
            }

            // Xử lý images
            if (obj.images && Array.isArray(obj.images)) {
                obj.images = obj.images.map(img =>
                    img.startsWith('/uploads/') ? `${req.protocol}://${req.get('host')}${img}` : img
                );
            }
            return obj;
        };

        const formatted = products.map(formatProductImage);

        res.set('Access-Control-Expose-Headers', 'Content-Range');
        res.set('Content-Range', `products ${_start}-${_end}/${total}`);
        res.status(200).json(formatted);
    } catch (err) {
        console.error('❌ Lỗi GET products:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const product =
            (await Product.findOne({ id: req.params.id })) ||
            (await Product.findById(req.params.id)); // fallback theo _id

        if (!product) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });

        const clean = product.toObject();
        clean.id = clean.id || clean._id;

        // Format thumbnail
        if (clean.thumbnail && clean.thumbnail.startsWith('/uploads/')) {
            clean.thumbnail = `${req.protocol}://${req.get('host')}${clean.thumbnail}`;
        }

        // Format images
        if (clean.images && Array.isArray(clean.images)) {
            clean.images = clean.images.map(img =>
                img.startsWith('/uploads/') ? `${req.protocol}://${req.get('host')}${img}` : img
            );
        }

        res.json(clean);
    } catch (err) {
        console.error('❌ Lỗi GET product:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createProduct = async (req, res) => {
    try {
        // Validation số âm
        const price = Number(req.body.price);
        const importPrice = Number(req.body.importPrice); // Added importPrice
        const originalPrice = Number(req.body.originalPrice);
        const total = Number(req.body.total);
        const sold = Number(req.body.sold);

        if (price < 0 || importPrice < 0 || originalPrice < 0 || total < 0 || sold < 0) {
            return res.status(400).json({ error: 'Giá và số lượng không được là số âm' });
        }

        const id = await generateProductId();

        //  Ảnh đại diện (lưu path relative)
        const thumbnailUrl = req.files?.thumbnail?.[0]
            ? `/uploads/${req.files.thumbnail[0].filename}`
            : null;

        //  Ảnh phụ (lưu path relative)
        const imagesUrls = req.files?.images
            ? req.files.images.map((f) => `/uploads/${f.filename}`)
            : [];

        //  Parse an toàn
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

        // Bắt buộc có tên sản phẩm
        if (!req.body.name) {
            return res.status(400).json({ error: 'Thiếu tên sản phẩm' });
        }

        const productData = {
            id,
            name: req.body.name,
            brand: req.body.brand || '',
            type: req.body.type || '',
            style: parseArray(req.body.style),
            style: parseArray(req.body.style),
            price: price || 0,
            importPrice: importPrice || 0, // Added importPrice
            originalPrice: originalPrice || 0,
            total: total || 0,
            sold: sold || 0,
            status: req.body.status || 'selling',
            thumbnail: thumbnailUrl,
            images: imagesUrls,
            colors: parseArray(req.body.colors),
            sizes: parseArray(req.body.sizes),
            variants: parseArray(req.body.variants), // 🔹 Added variants
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
};

exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ id: req.params.id });
        if (!product) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });

        const updateData = { ...req.body };
        delete updateData.id;
        delete updateData._id;

        //  Thumbnail
        if (req.body.deleteThumbnail === 'true') {
            updateData.thumbnail = null;
        } else if (req.files?.thumbnail?.[0]) {
            // Store relative path
            updateData.thumbnail = `/uploads/${req.files.thumbnail[0].filename}`;
        }

        //  Images 
        let finalImages = [];

        // 1. Lấy ảnh cũ (nếu có gửi lên)
        if (req.body.images) {
            if (Array.isArray(req.body.images)) {
                finalImages = req.body.images.filter(img => typeof img === 'string' && img.length > 0);
            } else if (typeof req.body.images === 'string' && req.body.images.length > 0) {
                finalImages = [req.body.images];
            }

            // Nếu ảnh cũ là full URL (từ server gửi xuống trước đó), cần chuyển về relative nếu muốn lưu thống nhất
            // Tuy nhiên logic hiện tại cứ để nguyên string client gửi lên, 
            // nhưng nếu client gửi full URL thì ta có thể cắt bớt nếu cần.
            // Để đơn giản, ta giả định client gửi gì lưu nấy, hoặc client tự xử lý. 
            // Nhưng tốt nhất nên clean:
            finalImages = finalImages.map(img => {
                const HOST_URL = `${req.protocol}://${req.get('host')}`;
                if (img.startsWith(HOST_URL)) {
                    return img.replace(HOST_URL, '');
                }
                return img;
            });
        }

        // 2. Lấy ảnh mới (nếu có upload)
        if (req.files?.images?.length > 0) {
            const newImageUrls = req.files.images.map(
                (f) => `/uploads/${f.filename}`
            );
            finalImages = [...finalImages, ...newImageUrls];
        }

        if (req.body.images || (req.files?.images?.length > 0)) {
            updateData.images = finalImages;
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
        updateData.style = safeParse(updateData.style);
        updateData.variants = safeParse(updateData.variants); // 🔹 Added variants parsing

        // Parse description và details
        updateData.description = updateData.description || '';
        // Gửi details dưới dạng string
        updateData.details = updateData.details || '';

        ['price', 'importPrice', 'originalPrice', 'total', 'sold'].forEach((key) => {
            if (updateData[key] !== undefined) {
                const num = Number(updateData[key]);
                if (num < 0) {
                    throw new Error(`${key} không được nhỏ hơn 0`);
                }
                updateData[key] = num;
            }
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
};

exports.deleteProduct = async (req, res) => {
    try {
        const deleted = await Product.findOneAndDelete({ id: req.params.id });
        if (!deleted) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
        res.json({ message: 'Đã xoá sản phẩm' });
    } catch (err) {
        console.error('❌ Lỗi xoá sản phẩm:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get trending products (top 10 best-selling in last 7 days)
exports.getTrendingProducts = async (req, res) => {
    try {
        const Order = require('../models/Order');
        const validStatuses = ['confirmed', 'paid', 'processing', 'shipped', 'delivered'];

        // Calculate last 7 days
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);
        last7Days.setHours(0, 0, 0, 0);

        // Aggregate top selling products from orders in last 7 days
        const trendingProducts = await Order.aggregate([
            {
                $match: {
                    status: { $in: validStatuses },
                    createdAt: { $gte: last7Days }
                }
            },
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.product',
                    soldQuantity: { $sum: '$products.quantity' }
                }
            },
            { $sort: { soldQuantity: -1 } },
            { $limit: 10 }
        ]);

        // Populate product details
        const populatedProducts = await Promise.all(
            trendingProducts.map(async (item) => {
                const product = await Product.findById(item._id);
                if (!product) return null;

                const clean = product.toObject();
                clean.id = clean.id || clean._id;
                clean.trendingSold = item.soldQuantity; // Add trending sold count

                // Format thumbnail
                if (clean.thumbnail && clean.thumbnail.startsWith('/uploads/')) {
                    clean.thumbnail = `${req.protocol}://${req.get('host')}${clean.thumbnail}`;
                }

                // Format images
                if (clean.images && Array.isArray(clean.images)) {
                    clean.images = clean.images.map(img =>
                        img.startsWith('/uploads/') ? `${req.protocol}://${req.get('host')}${img}` : img
                    );
                }

                return clean;
            })
        );

        // Filter out null products (deleted products)
        const validProducts = populatedProducts.filter(p => p !== null);

        res.json(validProducts);
    } catch (err) {
        console.error('❌ Lỗi lấy sản phẩm trending:', err);
        res.status(500).json({ error: err.message });
    }
};
