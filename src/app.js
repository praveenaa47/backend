const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));









// adminRoutes
const adminRoutes = require('./admin/adminRoute')
const adminProductRoutes = require('./products/productRoute')



// userRoutes
const userAuthRoutes = require('./user/userRoute')
const userProductRoutes = require('./products/userProductRoute')
const userOrderRoutes = require('./order/orderRoute')
const userCartRoutes = require('./cart/cartRoute')
const userCheckoutRoutes = require('./checkout/checkoutRoute')



// ADMIN
app.use('/admin/auth',adminRoutes)
app.use('/admin/product',adminProductRoutes)


// USER
app.use('/user',userAuthRoutes)
app.use('/product',userProductRoutes)
app.use('/order',userOrderRoutes)
app.use('/cart',userCartRoutes)
app.use('/checkout',userCheckoutRoutes)





app.use(errorMiddleware);

module.exports = app;