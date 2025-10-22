const Order = require('./orderModel');
const Product = require('../products/productModel');
const mongoose = require('mongoose');

// GET USER ORDERS
exports.getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { user: req.user.id };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('items.product', 'name brand images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalOrders: total,
          hasNext: skip + orders.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving orders",
      error: err.message
    });
  }
};

// GET ORDER DETAILS
exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user.id
    }).populate('items.product', 'name brand images price discount_price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Order details retrieved successfully",
      data: order
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving order details",
      error: err.message
    });
  }
};

// CANCEL ORDER
exports.cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user.id
    });

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Only allow cancellation for pending or confirmed orders
    if (!['pending', 'confirmed'].includes(order.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}. Order can only be cancelled when pending or confirmed.`
      });
    }

    // Restore product stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save({ session });
      }
    }

    // Update order status
    order.status = 'cancelled';
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    await order.populate('items.product', 'name brand images');

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: order
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    
    res.status(500).json({
      success: false,
      message: "Error cancelling order",
      error: err.message
    });
  }
};

// GET ORDER STATUS
exports.getOrderStatus = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user.id
    }).select('order_id status payment_status estimated_delivery createdAt');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Order status retrieved successfully",
      data: order
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving order status",
      error: err.message
    });
  }
};

// TRACK ORDER
exports.trackOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user.id
    }).select('order_id status shipping_address estimated_delivery createdAt');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Mock tracking timeline (in real app, this would come from shipping provider)
    const timeline = [
      {
        status: 'ordered',
        description: 'Order placed',
        date: order.createdAt,
        completed: true
      },
      {
        status: 'confirmed',
        description: 'Order confirmed',
        date: new Date(order.createdAt.getTime() + 30 * 60 * 1000), // 30 mins later
        completed: order.status !== 'pending'
      },
      {
        status: 'processing',
        description: 'Preparing for shipment',
        date: new Date(order.createdAt.getTime() + 2 * 60 * 60 * 1000), // 2 hours later
        completed: ['processing', 'shipped', 'delivered'].includes(order.status)
      },
      {
        status: 'shipped',
        description: 'Shipped',
        date: order.estimated_delivery ? new Date(order.estimated_delivery.getTime() - 3 * 24 * 60 * 60 * 1000) : null, // 3 days before delivery
        completed: ['shipped', 'delivered'].includes(order.status)
      },
      {
        status: 'delivered',
        description: 'Delivered',
        date: order.estimated_delivery,
        completed: order.status === 'delivered'
      }
    ];

    const trackingInfo = {
      order_id: order.order_id,
      current_status: order.status,
      estimated_delivery: order.estimated_delivery,
      shipping_address: order.shipping_address,
      timeline: timeline
    };

    res.status(200).json({
      success: true,
      message: "Order tracking retrieved successfully",
      data: trackingInfo
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error tracking order",
      error: err.message
    });
  }
};

// GET ORDER STATISTICS
exports.getOrderStatistics = async (req, res) => {
  try {
    const statistics = await Order.aggregate([
      {
        $match: { user: mongoose.Types.ObjectId(req.user.id) }
      },
      {
        $group: {
          _id: null,
          total_orders: { $sum: 1 },
          total_spent: { $sum: "$final_amount" },
          pending_orders: {
            $sum: { $cond: [{ $in: ["$status", ["pending", "confirmed", "processing"]] }, 1, 0] }
          },
          delivered_orders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
          },
          cancelled_orders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = statistics.length > 0 ? statistics[0] : {
      total_orders: 0,
      total_spent: 0,
      pending_orders: 0,
      delivered_orders: 0,
      cancelled_orders: 0
    };

    delete stats._id;

    res.status(200).json({
      success: true,
      message: "Order statistics retrieved successfully",
      data: stats
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving order statistics",
      error: err.message
    });
  }
};