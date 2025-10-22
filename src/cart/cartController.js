const Cart = require('./cartModel');
const Product = require('../products/productModel');

// GET CART
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id, is_active: true })
      .populate('items.product', 'name brand price discount_price images');

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        data: { items: [], total_amount: 0, total_items: 0 }
      });
    }

    res.status(200).json({
      success: true,
      message: "Cart retrieved successfully",
      data: cart
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving cart",
      error: err.message
    });
  }
};

// ADD TO CART
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // Validate product exists and is available
    const product = await Product.findOne({ 
      _id: productId, 
      is_available: true,
      stock: { $gt: 0 }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or out of stock"
      });
    }

    // Check stock availability
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`
      });
    }

    const currentPrice = product.discount_price && product.discount_price < product.price 
      ? product.discount_price 
      : product.price;

    let cart = await Cart.findOne({ user: req.user.id, is_active: true });

    if (!cart) {
      // Create new cart
      cart = new Cart({
        user: req.user.id,
        items: [{
          product: productId,
          quantity: quantity,
          price: currentPrice
        }]
      });
    } else {
      // Check if product already exists in cart
      const existingItemIndex = cart.items.findIndex(
        item => item.product.toString() === productId
      );

      if (existingItemIndex > -1) {
        // Update quantity if product exists
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        
        if (newQuantity > product.stock) {
          return res.status(400).json({
            success: false,
            message: `Cannot add more than available stock (${product.stock})`
          });
        }

        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].price = currentPrice;
      } else {
        // Add new item to cart
        cart.items.push({
          product: productId,
          quantity: quantity,
          price: currentPrice
        });
      }
    }

    await cart.save();
    await cart.populate('items.product', 'name brand price discount_price images');

    res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      data: cart
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error adding to cart",
      error: err.message
    });
  }
};

// UPDATE CART ITEM QUANTITY
exports.updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1"
      });
    }

    const cart = await Cart.findOne({ user: req.user.id, is_active: true });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    const cartItem = cart.items.id(itemId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

    // Check stock availability
    const product = await Product.findById(cartItem.product);
    if (!product || product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`
      });
    }

    cartItem.quantity = quantity;
    // Update price to current price
    const currentPrice = product.discount_price && product.discount_price < product.price 
      ? product.discount_price 
      : product.price;
    cartItem.price = currentPrice;

    await cart.save();
    await cart.populate('items.product', 'name brand price discount_price images');

    res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: cart
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating cart",
      error: err.message
    });
  }
};

// REMOVE FROM CART
exports.removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id, is_active: true });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    cart.items = cart.items.filter(item => item._id.toString() !== itemId);
    
    // If cart is empty after removal, deactivate it
    if (cart.items.length === 0) {
      cart.is_active = false;
    }

    await cart.save();
    
    if (cart.is_active) {
      await cart.populate('items.product', 'name brand price discount_price images');
    }

    res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      data: cart
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error removing from cart",
      error: err.message
    });
  }
};

// CLEAR CART
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id, is_active: true });
    
    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart is already empty"
      });
    }

    cart.items = [];
    cart.is_active = false;
    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error clearing cart",
      error: err.message
    });
  }
};