const express = require('express');
const router = express.Router();
const OrderController = require('./orderController');
const verifyToken = require('../middleware/jwtConfig');

// Order Routes
router.get('/', verifyToken(), OrderController.getUserOrders);
router.get('/statistics', verifyToken(), OrderController.getOrderStatistics);
router.get('/:orderId', verifyToken(), OrderController.getOrderDetails);
router.get('/:orderId/status', verifyToken(), OrderController.getOrderStatus);
router.get('/:orderId/track', verifyToken(), OrderController.trackOrder);
router.patch('/:orderId/cancel', verifyToken(), OrderController.cancelOrder);

module.exports = router;