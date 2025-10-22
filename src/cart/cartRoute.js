const express = require('express');
const router = express.Router();
const CartController = require('./cartController');
const verifyToken = require('../middleware/jwtConfig');

// Cart Routes
router.get('/', verifyToken(), CartController.getCart);
router.post('/add', verifyToken(), CartController.addToCart);
router.patch('/update/:itemId', verifyToken(), CartController.updateCartItem);
router.delete('/remove/:itemId', verifyToken(), CartController.removeFromCart);
router.delete('/clear', verifyToken(), CartController.clearCart);

module.exports = router;