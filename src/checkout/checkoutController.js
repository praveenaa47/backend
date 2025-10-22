const Order = require('../order/orderModel');
const Cart = require('../cart/cartModel');
const Product = require('../products/productModel');
const mongoose = require('mongoose');

// GET CHECKOUT SUMMARY
exports.getCheckoutSummary = async (req, res) => {
  try {
    const cart = await Cart.findOne({ 
      user: req.user.id, 
      is_active: true 
    }).populate('items.product', 'name brand price discount_price images stock');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty"
      });
    }

    // Validate stock and calculate totals
    const summary = {
      items: [],
      subtotal: 0,
      shipping: 0,
      discount: 0,
      total: 0,
      total_items: 0
    };

    for (const cartItem of cart.items) {
      const product = cartItem.product;
      const currentPrice = product.discount_price && product.discount_price < product.price 
        ? product.discount_price 
        : product.price;
      
      const itemTotal = currentPrice * cartItem.quantity;

      summary.items.push({
        product: {
          _id: product._id,
          name: product.name,
          brand: product.brand,
          image: product.images[0],
          price: currentPrice
        },
        quantity: cartItem.quantity,
        total_price: itemTotal,
        in_stock: product.stock >= cartItem.quantity,
        available_stock: product.stock
      });

      summary.subtotal += itemTotal;
      summary.total_items += cartItem.quantity;
    }

    // Calculate shipping (free above ₹500)
    summary.shipping = summary.subtotal > 500 ? 0 : 40;
    summary.total = summary.subtotal + summary.shipping;

    // Check if any item is out of stock
    const outOfStockItems = summary.items.filter(item => !item.in_stock);
    if (outOfStockItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some items are out of stock",
        data: {
          out_of_stock: outOfStockItems,
          summary: summary
        }
      });
    }

    res.status(200).json({
      success: true,
      message: "Checkout summary retrieved successfully",
      data: summary
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving checkout summary",
      error: err.message
    });
  }
};

// CREATE ORDER FROM CART (CHECKOUT)
exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { shipping_address, payment_method } = req.body;

    // Validate required fields
    if (!shipping_address || !payment_method) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Shipping address and payment method are required"
      });
    }

    // Validate shipping address fields
    const requiredAddressFields = ['name', 'phone', 'address_line1', 'city', 'state', 'pincode'];
    const missingFields = requiredAddressFields.filter(field => !shipping_address[field]);
    
    if (missingFields.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Missing shipping address fields: ${missingFields.join(', ')}`
      });
    }

    // Get user's active cart
    const cart = await Cart.findOne({ 
      user: req.user.id, 
      is_active: true 
    }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cart is empty"
      });
    }

    // Validate stock and prepare order items
    const orderItems = [];
    let totalAmount = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.product;
      
      // Check stock availability
      if (product.stock < cartItem.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Only ${product.stock} available.`
        });
      }

      const currentPrice = product.discount_price && product.discount_price < product.price 
        ? product.discount_price 
        : product.price;

      const itemTotal = currentPrice * cartItem.quantity;
      
      orderItems.push({
        product: product._id,
        quantity: cartItem.quantity,
        price: currentPrice,
        total_price: itemTotal
      });

      totalAmount += itemTotal;

      // Reduce stock
      product.stock -= cartItem.quantity;
      await product.save({ session });
    }

    // Calculate amounts
    const shippingAmount = totalAmount > 500 ? 0 : 40;
    const discountAmount = 0; // Can be calculated based on coupons in future
    const finalAmount = totalAmount + shippingAmount - discountAmount;

    // Create order
    const order = new Order({
      user: req.user.id,
      items: orderItems,
      total_amount: totalAmount,
      shipping_amount: shippingAmount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      payment_method: payment_method,
      shipping_address: shipping_address,
      estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });

    await order.save({ session });

    // Clear cart after successful order creation
    cart.items = [];
    cart.is_active = false;
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    await order.populate('items.product', 'name brand images');

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    
    res.status(500).json({
      success: false,
      message: "Error during checkout",
      error: err.message
    });
  }
};

// VALIDATE CART BEFORE CHECKOUT
exports.validateCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ 
      user: req.user.id, 
      is_active: true 
    }).populate('items.product', 'name stock price discount_price');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
        valid: false
      });
    }

    const validationResults = {
      valid: true,
      issues: [],
      cart_summary: {
        total_items: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        total_amount: cart.items.reduce((sum, item) => {
          const product = item.product;
          const price = product.discount_price && product.discount_price < product.price 
            ? product.discount_price 
            : product.price;
          return sum + (price * item.quantity);
        }, 0)
      }
    };

    // Check each item for issues
    for (const cartItem of cart.items) {
      const product = cartItem.product;
      
      if (product.stock === 0) {
        validationResults.valid = false;
        validationResults.issues.push({
          product: product.name,
          issue: "out_of_stock",
          message: `${product.name} is out of stock`
        });
      } else if (product.stock < cartItem.quantity) {
        validationResults.valid = false;
        validationResults.issues.push({
          product: product.name,
          issue: "insufficient_stock",
          message: `Only ${product.stock} items available for ${product.name}`
        });
      }
    }

    res.status(200).json({
      success: true,
      message: validationResults.valid ? "Cart is valid for checkout" : "Cart has issues",
      data: validationResults
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error validating cart",
      error: err.message
    });
  }
};