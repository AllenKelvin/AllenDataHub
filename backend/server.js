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
    req.userId = decoded.userId;
    
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
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
    timestamp: new Date().toISOString()
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
    
    // If no plans in database, create default plans (ONLY SHOW PLANS - NO AUTO ORDER)
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

// ==================== ORDER & PAYMENT FLOW ====================

// Create Order (REAL - No test mode)
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

    // Check if Paystack is configured
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ 
        error: 'Payment system is temporarily unavailable. Please try again later.' 
      });
    }

    // Create order with PENDING status
    const order = new Order({
      orderId: 'ORD' + Date.now() + Math.random().toString(36).substr(2, 9),
      userId: req.userId,
      items: items,
      total: total,
      recipientEmail: recipientEmail,
      recipientPhone: recipientPhone,
      status: 'pending',
      paymentStatus: 'pending'
    });

    await order.save();

    res.status(201).json({
      message: 'Order created successfully. Please proceed to payment.',
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

// Initialize Paystack Payment (REAL - No test mode)
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
      userId: req.userId  // ✅ CRITICAL: Check user ownership
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order is already paid
    if (order.paymentStatus === 'success') {
      return res.status(400).json({ error: 'This order has already been paid' });
    }

    // Convert amount to kobo (Paystack uses kobo)
    const amountInKobo = Math.round(order.total * 100);

    // Initialize REAL Paystack transaction
    const paystackResponse = await paystack.post('/transaction/initialize', {
      email: email,
      amount: amountInKobo,
      reference: order.orderId,
      callback_url: `${FRONTEND_URL}/payment/verify`,
      metadata: {
        orderId: order.orderId,
        userId: req.userId.toString(),
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
    
    // Check if Paystack key is invalid
    if (error.response?.status === 401) {
      return res.status(503).json({ 
        error: 'Payment service configuration error. Please contact support.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to initialize payment. Please try again.' 
    });
  }
});

// Verify Paystack Payment (REAL - No auto-delivery simulation)
app.get('/api/payments/verify/:reference', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;

    // Verify payment with REAL Paystack API
    const verificationResponse = await paystack.get(`/transaction/verify/${reference}`);
    const { data } = verificationResponse.data;

    // Find order by Paystack reference
    const order = await Order.findOne({ paystackReference: reference });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // ✅ CRITICAL SECURITY CHECK: Ensure user owns this order
    if (order.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update order based on REAL payment status
    if (data.status === 'success') {
      order.status = 'paid';
      order.paymentStatus = 'success';
      order.paymentReference = data.reference;
      
      // Order is paid but NOT delivered yet (needs telecom API)
      order.status = 'processing'; // Waiting for telecom API integration
      await order.save();
      
      res.json({
        success: true,
        message: 'Payment successful! Your order is being processed.',
        note: 'Data delivery will begin once telecom API is integrated.',
        order: {
          _id: order._id,
          orderId: order.orderId,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: order.total,
          items: order.items,
          recipientPhone: order.recipientPhone
        }
      });

      // NO AUTO-DELIVERY SIMULATION - WAITING FOR REAL TELECOM API
      console.log(`💰 Payment successful for order ${order.orderId}. Waiting for telecom API integration.`);

    } else {
      // Payment failed
      order.status = 'failed';
      order.paymentStatus = 'failed';
      await order.save();

      res.json({
        success: false,
        message: 'Payment failed or was cancelled.',
        order: {
          _id: order._id,
          orderId: order.orderId,
          status: order.status,
          paymentStatus: order.paymentStatus
        }
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify payment. Please check your payment status in your dashboard.' 
    });
  }
});

// ==================== USER DATA ISOLATION ====================

// Get User Orders (ONLY user's own orders)
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get Single Order (WITH OWNERSHIP CHECK)
app.get('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.userId  // ✅ CRITICAL: Only return if user owns it
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

// Get User Dashboard (ONLY user's data)
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(10);
    
    const stats = {
      totalOrders: await Order.countDocuments({ userId: req.userId }),
      pendingOrders: await Order.countDocuments({ 
        userId: req.userId, 
        status: 'pending' 
      }),
      completedOrders: await Order.countDocuments({ 
        userId: req.userId, 
        status: { $in: ['delivered', 'processing'] } 
      }),
      totalSpent: await Order.aggregate([
        { $match: { userId: req.userId, paymentStatus: 'success' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]).then(result => result.length > 0 ? result[0].total : 0)
    };

    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        phone: req.user.phone
      },
      recentOrders: orders,
      stats: stats
    });
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
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

// ==================== ADMIN ROUTES (WITH SECURITY) ====================

// Admin Middleware (Add isAdmin field to userSchema first)
const adminMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Admin: Get All Orders (Protected)
app.get('/api/admin/orders', adminMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Admin orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Admin: Get Dashboard Statistics
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
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
      { $match: { paymentStatus: 'success' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const stats = {
      today: {
        totalOrders: todayOrders.length,
        totalRevenue: todayOrders.reduce((sum, order) => sum + order.total, 0),
        successfulPayments: todayOrders.filter(o => o.paymentStatus === 'success').length
      },
      allTime: {
        totalOrders,
        totalRevenue: totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0,
        successfulPayments: await Order.countDocuments({ paymentStatus: 'success' })
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ==================== OTHER ROUTES ====================

// Get Paystack Public Key
app.get('/api/payments/public-key', (req, res) => {
  res.json({
    publicKey: PAYSTACK_PUBLIC_KEY
  });
});

// Paystack Webhook
app.post('/api/webhook/paystack', async (req, res) => {
  try {
    // Verify webhook signature
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) {
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

    // Handle REAL payment events
    if (event.event === 'charge.success') {
      order.status = 'paid';
      order.paymentStatus = 'success';
      order.paymentReference = reference;
      order.status = 'processing'; // Waiting for telecom API
      await order.save();
      console.log(`✅ REAL Payment successful for order ${order.orderId}`);
      
    } else if (event.event === 'charge.failed') {
      order.status = 'failed';
      order.paymentStatus = 'failed';
      await order.save();
      console.log(`❌ REAL Payment failed for order ${order.orderId}`);
    }

    res.sendStatus(200);

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
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
  console.log(`💳 Paystack: ${PAYSTACK_SECRET_KEY ? 'REAL PAYMENTS' : 'NOT CONFIGURED'}`);
  console.log(`🔐 User Data Isolation: ACTIVE`);
  console.log(`🚫 No Test/Bypass Modes: ACTIVE`);
});