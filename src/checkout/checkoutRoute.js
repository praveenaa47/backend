const express = require('express');
const router = express.Router();
const CheckoutController = require('./checkoutController');
const verifyToken = require('../middleware/jwtConfig');

// Checkout Routes
router.get('/summary', verifyToken(), CheckoutController.getCheckoutSummary);
router.post('/validate', verifyToken(), CheckoutController.validateCart);
router.post('/create-order', verifyToken(), CheckoutController.createOrder);

module.exports = router;