const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('./userController');
const { registerUserValidator, loginUserValidator } = require('../../validators');
const validationHandler = require('../middleware/validationHandler');

// Register User
router.post('/register', registerUserValidator, validationHandler, userController.registerUser);

// Login User
router.post('/login', validationHandler, userController.loginUser);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
}));

router.get('/google/callback', userController.googleLoginCallback);

// Token-based Google login (for web and mobile)
router.post('/google', userController.googleLoginWeb);

module.exports = router;