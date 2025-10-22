const express = require('express');
const router = express.Router();
const UserProductController = require('./userProductController');
const verifyToken = require('../middleware/jwtConfig');

router.get('/', UserProductController.getAllProducts);
router.get('/featured', UserProductController.getFeaturedProducts);
router.get('/search/:query', UserProductController.searchProducts);
router.get('/:id', UserProductController.getProductById);
router.post('/:id/reviews', verifyToken(), UserProductController.addReview);

module.exports = router;