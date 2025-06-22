const Product = require('../models/Product');

const generateProductId = async () => {
  const lastProduct = await Product.findOne().sort({ createdAt: -1 });

  let number = 1;
  if (lastProduct && lastProduct.id?.startsWith('DOLA')) {
    const lastNumber = parseInt(lastProduct.id.replace('DOLA', ''), 10);
    if (!isNaN(lastNumber)) number = lastNumber + 1;
  }

  return `DOLA${String(number).padStart(4, '0')}`;
};

module.exports = generateProductId;
