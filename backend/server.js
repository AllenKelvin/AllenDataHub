const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://allendatahub.com',
    'https://allen-data-hub.vercel.app'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
  console.log('❌ MongoDB Connection Error:', err.message);
});

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    network: String,
    size: String,
    price: Number,
    recipientPhone: String,
    validity: String
  }],
  total: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'processing', 'delivered', 'failed', 'cancelled'], 
    default: 'pending' 
  },
  recipientEmail: String,
  recipientPhone: String,
  paymentMethod: { type: String, default: 'paystack' },
  paymentReference: String,
  paymentStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  paystackReference: String,
  paystackAccessCode: String,
  paystackAuthorizationUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const dataPlanSchema = new mongoose.Schema({
  network: { type: String, required: true },
  size: { type: String, required: true },
  price: { type: Number, required: true },
  validity: { type: String, required: true },
  popular: { type: Boolean, default: false }
});

// MongoDB Models
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const DataPlan = mongoose.model('DataPlan', dataPlanSchema);

// Paystack Configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://allen-data-hub.vercel.app';

// Initialize Paystack API
const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

// Auth Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.userId).select('-password');
    
    if (!req.user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// ==================== ROUTES ====================

// Test Route
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 AllenDataHub API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    paystack: PAYSTACK_SECRET_KEY ? 'Configured' : 'Not Configured'
  });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const orderCount = await Order.countDocuments();
    const planCount = await DataPlan.countDocuments();
    
    res.json({ 
      status: 'OK', 
      database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      paystack: PAYSTACK_SECRET_KEY ? 'Configured' : 'Not Configured',
      collections: {
        users: userCount,
        orders: orderCount,
        dataPlans: planCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    // Validation
    if (!username || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email or username' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      username,
      email,
      phone,
      password: hashedPassword
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get Data Plans
app.get('/api/plans', async (req, res) => {
  try {
    const plans = await DataPlan.find().sort({ network: 1, price: 1 });
    
    // If no plans in database, create default plans
    if (plans.length === 0) {
      const defaultPlans = [
        { network: 'MTN', size: '1GB', price: 5, validity: '30 days', popular: true },
        { network: 'MTN', size: '2GB', price: 10, validity: '30 days' },
        { network: 'MTN', size: '5GB', price: 20, validity: '30 days' },
        { network: 'Telecel', size: '1GB', price: 4, validity: '30 days', popular: true },
        { network: 'Telecel', size: '2GB', price: 8, validity: '30 days' },
        { network: 'Telecel', size: '5GB', price: 18, validity: '30 days' }
      ];
      
      await DataPlan.insertMany(defaultPlans);
      const updatedPlans = await DataPlan.find().sort({ network: 1, price: 1 });
      return res.json(updatedPlans);
    }

    res.json(plans);
  } catch (error) {
    console.error('Plans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch data plans' });
  }
});

// Create Order
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { items, total, recipientEmail, recipientPhone } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    if (!total || total <= 0) {
      return res.status(400).json({ error: 'Invalid order total' });
    }

    if (!recipientPhone) {
      return res.status(400).json({ error: 'Recipient phone number is required' });
    }

    // Create order
    const order = new Order({
      orderId: 'ORD' + Date.now(),
      userId: req.user._id,
      items: items,
      total: total,
      recipientEmail: recipientEmail,
      recipientPhone: recipientPhone,
      status: 'pending',
      paymentStatus: 'pending'
    });

    await order.save();

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        items: order.items,
        total: order.total,
        status: order.status,
        recipientEmail: order.recipientEmail,
        recipientPhone: order.recipientPhone,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Initialize Paystack Payment
app.post('/api/payments/initialize', authMiddleware, async (req, res) => {
  try {
    const { orderId, email } = req.body;

    // Validate
    if (!orderId || !email) {
      return res.status(400).json({ error: 'Order ID and email are required' });
    }

    // Verify order exists and belongs to user
    const order = await Order.findOne({
      orderId: orderId,
      userId: req.user._id
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Convert amount to kobo (Paystack uses kobo)
    const amountInKobo = Math.round(order.total * 100);

    // Initialize Paystack transaction
    const paystackResponse = await paystack.post('/transaction/initialize', {
      email: email,
      amount: amountInKobo,
      reference: orderId,
      callback_url: `${FRONTEND_URL}/payment/verify`,
      metadata: {
        orderId: orderId,
        userId: req.user._id.toString(),
        customer_name: req.user.username
      }
    });

    const { data } = paystackResponse.data;

    // Update order with Paystack info
    order.paystackReference = data.reference;
    order.paystackAccessCode = data.access_code;
    order.paystackAuthorizationUrl = data.authorization_url;
    await order.save();

    res.json({
      success: true,
      authorization_url: data.authorization_url,
      access_code: data.access_code,
      reference: data.reference
    });

  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to initialize payment',
      details: error.response?.data?.message || error.message
    });
  }
});

// Verify Paystack Payment
app.get('/api/payments/verify/:reference', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;

    // Verify payment with Paystack
    const verificationResponse = await paystack.get(`/transaction/verify/${reference}`);
    const { data } = verificationResponse.data;

    // Find order by Paystack reference
    const order = await Order.findOne({ paystackReference: reference });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order belongs to user
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Update order based on payment status
    if (data.status === 'success') {
      order.status = 'paid';
      order.paymentStatus = 'success';
      order.paymentReference = data.reference;
      
      // Mark as processing (data will be delivered)
      order.status = 'processing';
      await order.save();
      
      res.json({
        success: true,
        message: 'Payment successful! Your data bundle is being processed.',
        order: order
      });

      // Simulate delivery after 10 seconds
      setTimeout(async () => {
        try {
          order.status = 'delivered';
          await order.save();
          console.log(`✅ Order ${order.orderId} marked as delivered`);
        } catch (error) {
          console.error('Error updating order to delivered:', error);
        }
      }, 10000);

    } else {
      order.status = 'failed';
      order.paymentStatus = 'failed';
      await order.save();

      res.json({
        success: false,
        message: 'Payment failed. Please try again.',
        order: order
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify payment'
    });
  }
});

// Paystack Webhook
app.post('/api/webhook/paystack', async (req, res) => {
  try {
    // Get the signature from header
    const signature = req.headers['x-paystack-signature'];
    
    // Verify signature
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (hash !== signature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    const { reference } = event.data;

    // Find order
    const order = await Order.findOne({ paystackReference: reference });
    
    if (!order) {
      console.error('Order not found for reference:', reference);
      return res.status(404).json({ error: 'Order not found' });
    }

    // Handle events
    if (event.event === 'charge.success') {
      order.status = 'paid';
      order.paymentStatus = 'success';
      order.paymentReference = reference;
      order.status = 'processing';
      await order.save();
      console.log(`✅ Payment successful via webhook for order ${order.orderId}`);
      
    } else if (event.event === 'charge.failed') {
      order.status = 'failed';
      order.paymentStatus = 'failed';
      await order.save();
      console.log(`❌ Payment failed via webhook for order ${order.orderId}`);
    }

    // Always respond with 200
    res.sendStatus(200);

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get Paystack Public Key
app.get('/api/payments/public-key', (req, res) => {
  res.json({
    publicKey: PAYSTACK_PUBLIC_KEY
  });
});

// Get User Orders
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get Single Order
app.get('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Order fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// User Profile
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    res.json({
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      phone: req.user.phone,
      createdAt: req.user.createdAt
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Admin: Get All Orders
app.get('/api/admin/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Admin orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Admin: Get Dashboard Statistics
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's orders
    const todayOrders = await Order.find({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // All-time stats
    const totalOrders = await Order.countDocuments();
    const totalRevenueResult = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    // Network distribution
    const networkStats = await Order.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.network', count: { $sum: 1 } } }
    ]);

    // Payment statistics
    const paymentStats = await Order.aggregate([
      { $group: { 
        _id: '$paymentStatus', 
        count: { $sum: 1 },
        totalAmount: { $sum: '$total' }
      } }
    ]);

    const stats = {
      today: {
        totalOrders: todayOrders.length,
        totalRevenue: todayOrders.reduce((sum, order) => sum + order.total, 0),
        successfulPayments: todayOrders.filter(o => o.paymentStatus === 'success').length
      },
      allTime: {
        totalOrders,
        totalRevenue: totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0
      },
      networkStats: networkStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      paymentStats: paymentStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount
        };
        return acc;
      }, {})
    };

    res.json(stats);
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 AllenDataHub Backend Server Started!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💳 Paystack: ${PAYSTACK_SECRET_KEY ? 'Configured' : 'NOT CONFIGURED - Set PAYSTACK_SECRET_KEY'}`);
});