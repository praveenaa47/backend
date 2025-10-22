const { body } = require('express-validator');
const User = require('./userModel');

const registerUserValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 3 })
    .withMessage('Name must be at least 3 characters long'),
  
  body()
    .custom((value, { req }) => {
      const { email, phone } = req.body;
      if (!email && !phone) {
        throw new Error('Either email or phone number is required');
      }
      return true;
    }),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Invalid email format')
    .custom(async (email) => {
      if (email) {
        const user = await User.findOne({ email });
        if (user) {
          throw new Error('Email already exists');
        }
      }
      return true;
    }),
  
  body('phone')
    .optional({ checkFalsy: true })
    .matches(/^[0-9]{10,15}$/)
    .withMessage('Phone number must be 10-15 digits')
    .custom(async (phone) => {
      if (phone) {
        const user = await User.findOne({ phone });
        if (user) {
          throw new Error('Phone number already exists');
        }
      }
      return true;
    }),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

const loginUserValidator = [
  body('emailOrPhone')
    .notEmpty()
    .withMessage('Email or phone is required')
    .custom((value) => {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const isPhone = /^[0-9]{10,15}$/.test(value);
      
      if (!isEmail && !isPhone) {
        throw new Error('Invalid email or phone format');
      }
      return true;
    }),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

module.exports = { registerUserValidator, loginUserValidator };