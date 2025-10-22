const mongoose = require('mongoose');

// Review Schema
const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Product Schema (Ultra Simplified)
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Product name is required"],
    trim: true,
    index: true
  },
  brand: {
    type: String,
    required: [true, "Brand is required"],
    trim: true,
    index: true
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0, "Price cannot be negative"]
  },
  discount_price: {
    type: Number,
    min: [0, "Discount price cannot be negative"],
    validate: {
      validator: function(value) {
        return !value || value <= this.price;
      },
      message: 'Discount price must be <= regular price'
    }
  },
  images: [{
    type: String,
    required: true
  }],
  description: {
    type: String,
    trim: true
  },
  stock: {
    type: Number,
    required: [true, "Stock is required"],
    min: [0, "Stock cannot be negative"],
    default: 0
  },
  is_available: {
    type: Boolean,
    default: true,
    index: true
  },
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [reviewSchema]
}, { 
  timestamps: true 
});

productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ featured: 1, is_available: 1 });
productSchema.index({ 'ratings.average': -1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });

productSchema.virtual('discount_percentage').get(function() {
  if (this.discount_price && this.price > 0) {
    return Math.round(((this.price - this.discount_price) / this.price) * 100);
  }
  return 0;
});

// Virtual for current price (considers discount)
productSchema.virtual('current_price').get(function() {
  return this.discount_price && this.discount_price < this.price 
    ? this.discount_price 
    : this.price;
});

productSchema.methods.hasStock = function() {
  return this.stock > 0 && this.is_available;
};

productSchema.methods.addReview = function(userId, rating, comment) {
  const review = {
    user: userId,
    rating: rating,
    comment: comment
  };
  
  this.reviews.push(review);
  
  const totalRatings = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.ratings.average = totalRatings / this.reviews.length;
  this.ratings.count = this.reviews.length;
  
  return this.save();
};

productSchema.pre('save', function(next) {
  this.is_available = this.stock > 0;
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;