const Product = require('./productModel');

// GET ALL PRODUCTS (User)
exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      featured,
      price_min,
      price_max,
      sort = "newest",
      search,
    } = req.query;

    const filter = { is_available: true };

    if (featured === "true") filter.featured = true;
    if (search) filter.name = { $regex: search, $options: "i" };

    // Price filtering
    if (price_min || price_max) {
      const priceConditions = [];
      if (price_min) priceConditions.push({ 
        $or: [
          { discount_price: { $gte: parseFloat(price_min) } },
          { price: { $gte: parseFloat(price_min) } }
        ]
      });
      if (price_max) priceConditions.push({ 
        $or: [
          { discount_price: { $lte: parseFloat(price_max) } },
          { price: { $lte: parseFloat(price_max) } }
        ]
      });
      
      if (priceConditions.length > 0) {
        Object.assign(filter, ...priceConditions);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let sortOptions = {};
    switch (sort) {
      case "price_low":
        sortOptions = { price: 1 };
        break;
      case "price_high":
        sortOptions = { price: -1 };
        break;
      case "name_asc":
        sortOptions = { name: 1 };
        break;
      case "name_desc":
        sortOptions = { name: -1 };
        break;
      case "rating":
        sortOptions = { 'ratings.average': -1 };
        break;
      case "popular":
        sortOptions = { 'ratings.count': -1 };
        break;
      default: // newest
        sortOptions = { createdAt: -1 };
    }

    const products = await Product.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalProducts: total,
          hasNext: skip + products.length < total,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving products",
      error: err.message,
    });
  }
};

// GET SINGLE PRODUCT (User)
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      is_available: true,
    }).populate('reviews.user', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: product,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving product",
      error: err.message,
    });
  }
};

// GET FEATURED PRODUCTS
exports.getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = await Product.find({ 
      featured: true, 
      is_available: true 
    })
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Featured products retrieved successfully",
      data: products
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving featured products",
      error: err.message,
    });
  }
};

// SEARCH PRODUCTS
exports.searchProducts = async (req, res) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 12 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const filter = {
      $text: { $search: query },
      is_available: true,
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(filter)
      .sort({ score: { $meta: "textScore" } })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Search results retrieved successfully",
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalProducts: total,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error searching products",
      error: err.message,
    });
  }
};

// ADD REVIEW (User)
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    await product.addReview(req.user.id, rating, comment);
    
    res.status(200).json({
      success: true,
      message: "Review added successfully",
      data: product
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error adding review",
      error: err.message
    });
  }
};