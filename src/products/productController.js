const Product = require('./productModel');
const fs = require('fs');
const path = require('path');

// CREATE PRODUCT
exports.createProduct = async (req, res) => {
  const { 
    name, brand, price, discount_price, description, stock, featured 
  } = req.body;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'At least one product image is required' });
  }

  try {
    const newProduct = new Product({
      name,
      brand,
      price: parseFloat(price),
      discount_price: discount_price ? parseFloat(discount_price) : undefined,
      description,
      stock: parseInt(stock),
      featured: featured === 'true' || featured === true,
      images: req.files.map(file => file.filename)
    });

    await newProduct.save();

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating product', error: err.message });
  }
};

// GET ALL PRODUCTS (Admin)
exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, featured, search } = req.query;

    const filter = {};
    if (featured !== undefined) filter.featured = featured === 'true';
    if (search) filter.$text = { $search: search };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      message: 'Products retrieved successfully',
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalProducts: total
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving products', error: err.message });
  }
};

// GET SINGLE PRODUCT (Admin)
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('reviews.user', 'name email');

    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.status(200).json({ message: 'Product retrieved successfully', product });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving product', error: err.message });
  }
};

// UPDATE PRODUCT
exports.updateProduct = async (req, res) => {
  try {
    const { name, brand, price, discount_price, description, stock, featured } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Update images if new ones are uploaded
    let updatedImages = product.images;
    if (req.files && req.files.length > 0) {
      updatedImages = [...updatedImages, ...req.files.map(f => f.filename)];
    }

    const updateData = {
      ...(name && { name }),
      ...(brand && { brand }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(discount_price !== undefined && { discount_price: parseFloat(discount_price) }),
      ...(description !== undefined && { description }),
      ...(stock !== undefined && { stock: parseInt(stock) }),
      ...(featured !== undefined && { featured: featured === 'true' || featured === true }),
      images: updatedImages
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true, runValidators: true }
    );

    res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });

  } catch (err) {
    res.status(500).json({ message: 'Error updating product', error: err.message });
  }
};

// DELETE PRODUCT
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Delete associated images
    product.images.forEach(imageName => {
      const imagePath = path.join(__dirname, '../../uploads', imageName);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    });

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting product', error: err.message });
  }
};

// DELETE IMAGE
exports.deleteImage = async (req, res) => {
  try {
    const { productId } = req.params;
    const { imageName } = req.body;
    
    if (!imageName) return res.status(400).json({ message: 'Image name is required' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (!product.images.includes(imageName)) return res.status(404).json({ message: 'Image not found' });

    product.images = product.images.filter(img => img !== imageName);

    const imagePath = path.join(__dirname, '../../uploads', imageName);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    await product.save();
    res.status(200).json({ message: 'Image deleted successfully', product });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting image', error: err.message });
  }
};

// ADD REVIEW (Admin can manage reviews)
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) return res.status(404).json({ message: 'Product not found' });

    await product.addReview(req.user.id, rating, comment);
    
    res.status(200).json({ message: 'Review added successfully', product });
  } catch (err) {
    res.status(500).json({ message: 'Error adding review', error: err.message });
  }
};