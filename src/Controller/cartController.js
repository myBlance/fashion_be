const mongoose = require('mongoose');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product'); // Import Product
const { ObjectId } = mongoose.Types;

exports.syncCart = async (req, res) => {
    try {
        const { userId, items } = req.body;
        if (!userId || !Array.isArray(items)) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const uid = new ObjectId(userId);

        for (const item of items) {
            const existing = await CartItem.findOne({
                userId: uid,
                productId: item.productId,
                color: item.color || '',
                size: item.size || ''
            });

            if (existing) {
                existing.quantity += item.quantity || 1;
                await existing.save();
            } else {
                const newItem = new CartItem({
                    userId: uid,
                    productId: item.productId,
                    name: item.name || 'Unknown',
                    color: item.color || '',
                    size: item.size || '',
                    price: item.price || 0,
                    quantity: item.quantity || 1,
                    image: item.image || ''
                });
                await newItem.save();
            }
        }

        // Fetch cart items and populate stock info
        const cartItems = await CartItem.find({ userId: uid });

        const result = await Promise.all(cartItems.map(async (item) => {
            const product = await Product.findOne({ id: item.productId });
            const stock = product ? (product.total || 0) - (product.sold || 0) : 0;
            return {
                ...item.toObject(),
                stock
            };
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error('Error syncing cart:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getCart = async (req, res) => {
    try {
        const uid = new ObjectId(req.params.userId);
        const items = await CartItem.find({ userId: uid });

        // Populate stock info
        const result = await Promise.all(items.map(async (item) => {
            const product = await Product.findOne({ id: item.productId });
            const stock = product ? (product.total || 0) - (product.sold || 0) : 0;
            return {
                ...item.toObject(),
                stock
            };
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.addToCart = async (req, res) => {
    try {
        let { userId, productId, name, color, size, price, quantity, image } = req.body;
        if (!userId || !productId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const uid = new ObjectId(userId);

        const existing = await CartItem.findOne({
            userId: uid,
            productId,
            color: color || '',
            size: size || ''
        });

        if (existing) {
            existing.quantity += quantity || 1;
            await existing.save();

            // Get stock info to return
            const product = await Product.findOne({ id: productId });
            const stock = product ? (product.total || 0) - (product.sold || 0) : 0;

            return res.status(200).json({ ...existing.toObject(), stock });
        }

        const newItem = new CartItem({
            userId: uid,
            productId,
            name: name || 'Unknown',
            color: color || '',
            size: size || '',
            price: price || 0,
            quantity: quantity || 1,
            image: image || ''
        });

        await newItem.save();

        // Get stock info to return
        const product = await Product.findOne({ id: productId });
        const stock = product ? (product.total || 0) - (product.sold || 0) : 0;

        res.status(201).json({ ...newItem.toObject(), stock });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updateCartItem = async (req, res) => {
    try {
        let { userId, productId, color, size, quantity } = req.body;
        if (!userId || !productId || quantity === undefined) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const uid = new ObjectId(userId);

        const item = await CartItem.findOne({
            userId: uid,
            productId,
            color: color || '',
            size: size || ''
        });

        if (!item) return res.status(404).json({ message: 'Item not found' });

        item.quantity = quantity;
        await item.save();
        res.status(200).json(item);
    } catch (error) {
        console.error('Error updating cart item:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


exports.deleteCartItem = async (req, res) => {
    try {
        let { userId, productId, color, size } = req.body;
        if (!userId || !productId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const uid = new ObjectId(userId);

        const result = await CartItem.deleteOne({
            userId: uid,
            productId,
            color: color || '',
            size: size || ''
        });

        if (result.deletedCount === 0) return res.status(404).json({ message: 'Item not found' });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting cart item:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updateCartItemVariant = async (req, res) => {
    try {
        const { userId, productId, oldColor, oldSize, newColor, newSize } = req.body;

        if (!userId || !productId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const uid = new ObjectId(userId);

        // Find the original item
        const itemToUpdate = await CartItem.findOne({
            userId: uid,
            productId,
            color: oldColor || '',
            size: oldSize || ''
        });

        if (!itemToUpdate) {
            return res.status(404).json({ message: 'Item to update not found' });
        }

        // Check if there is already an item with the new variant
        const existingTargetItem = await CartItem.findOne({
            userId: uid,
            productId,
            color: newColor,
            size: newSize
        });

        if (existingTargetItem) {
            // Merge logic: Add quantity to the existing target item and delete the old one
            existingTargetItem.quantity += itemToUpdate.quantity;
            await existingTargetItem.save();
            await CartItem.deleteOne({ _id: itemToUpdate._id });
        } else {
            // Update logic: Just update the variant fields
            itemToUpdate.color = newColor;
            itemToUpdate.size = newSize;
            await itemToUpdate.save();
        }

        // Return the full updated cart list as expected by the frontend service
        const cartItems = await CartItem.find({ userId: uid });

        // Populate stock info
        const result = await Promise.all(cartItems.map(async (item) => {
            const product = await Product.findOne({ id: item.productId });
            const stock = product ? (product.total || 0) - (product.sold || 0) : 0;
            return {
                ...item.toObject(),
                stock
            };
        }));

        res.status(200).json(result);

    } catch (error) {
        console.error('Error updating cart variant:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
