const express = require('express');
const router = express.Router();
const ProductController = require('./productController');
const verifyToken = require('../middleware/jwtConfig');
const multerConfig = require('../middleware/multerConfig');
const cloudinaryMapper = require("../middleware/cloudinaryMapper");

router.post('/create', verifyToken(['admin']),cloudinaryMapper, multerConfig.array('images'), ProductController.createProduct);
router.get('/view', verifyToken(['admin']), ProductController.getAllProducts);
router.get('/view/:id', verifyToken(['admin']), ProductController.getProductById);
router.patch('/update/:id', verifyToken(['admin']),cloudinaryMapper, multerConfig.array('images'), ProductController.updateProduct);
router.delete('/delete/:id', verifyToken(['admin']), ProductController.deleteProduct);
router.delete('/delete-image/:productId', verifyToken(['admin']), ProductController.deleteImage);
router.post('/:id/reviews', verifyToken(['admin']), ProductController.addReview);

module.exports = router;