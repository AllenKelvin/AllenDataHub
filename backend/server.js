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
    enum: ['pending', 'paid', 'processing', 'delivered', 'failed', 'cancelled', 'partially_delivered'], 
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
  deliveryDetails: [{
    network: String,
    size: String,
    recipient: String,
    success: Boolean,
    transactionId: String,
    message: String,
    timestamp: Date
  }],
  deliveredAt: Date,
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

// Portal-02 Service
class Portal02Service {
  constructor() {
    this.apiKey = process.env.PORTAL02_API_KEY;
    this.baseURL = 'https://portal-02.com/api/v1';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
  }

  async testConnection() {
    try {
      console.log('🔍 Testing Portal-02.com API connection');
      const response = await this.client.get('/balance');
      
      return {
        success: true,
        platform: 'Portal-02.com',
        message: 'Connected successfully',
        data: response.data
      };
      
    } catch (error) {
      console.error('Portal-02 connection error:', error.response?.data || error.message);
      
      return {
        success: false,
        platform: 'Portal-02.com',
        error: error.message,
        details: error.response?.data
      };
    }
  }

  async purchaseDataBundle(phoneNumber, bundleSize, network) {
    try {
      console.log(`📦 Portal-02: Purchasing ${bundleSize} for ${phoneNumber} (${network})`);
      
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const payload = {
        network: network.toLowerCase(),
        amount: this.calculateAmount(bundleSize, network),
        mobile_number: formattedPhone,
        plan: `${network.toLowerCase()}-${bundleSize.toLowerCase().replace(' ', '-')}`,
        Ported_number: true,
        airtime_type: 'data'
      };
      
      const response = await this.client.post('/data', payload);
      
      return {
        success: response.data.status === 'success',
        transactionId: response.data.transaction_id || `PORTAL02_${Date.now()}`,
        reference: response.data.reference,
        status: response.data.status || 'pending',
        message: response.data.message || 'Data purchase initiated',
        raw: response.data
      };
      
    } catch (error) {
      console.error('Portal-02 purchase error:', error.response?.data || error.message);
      
      return {
        success: false,
        platform: 'Portal-02.com',
        error: error.response?.data?.message || error.message,
        code: error.response?.status || 500
      };
    }
  }

  async checkBalance() {
    try {
      const response = await this.client.get('/balance');
      
      return {
        success: true,
        balance: response.data.balance || response.data.amount || 0,
        currency: response.data.currency || 'GHS',
        raw: response.data
      };
    } catch (error) {
      console.error('Portal-02 balance error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = '233' + cleaned.substring(1);
    }
    
    if (cleaned.startsWith('+233')) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.length === 9) {
      cleaned = '233' + cleaned;
    }
    
    return cleaned;
  }

  calculateAmount(bundleSize, network) {
    const prices = {
      'MTN': { '1GB': 5, '2GB': 10, '5GB': 20 },
      'Telecel': { '1GB': 4, '2GB': 8, '5GB': 18 },
      'AirtelTigo': { '1GB': 4, '2GB': 8, '5GB': 18 }
    };
    
    return prices[network]?.[bundleSize] || 0;
  }
}

const portal02Service = new Portal02Service();

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
    timestamp: new Date().toISOString(),
    services: {
      paystack: PAYSTACK_SECRET_KEY ? 'Configured' : 'Not Configured',
      portal02: process.env.PORTAL02_API_KEY ? 'Configured' : 'Not Configured'
    }
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
      services: {
        paystack: PAYSTACK_SECRET_KEY ? 'Configured' : 'Not Configured',
        portal02: process.env.PORTAL02_API_KEY ? 'Configured' : 'Not Configured'
      },
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

// Portal-02 Test Connection
app.get('/api/portal02/test', async (req, res) => {
  try {
    const testResult = await portal02Service.testConnection();
    
    if (!testResult.success) {
      return res.status(500).json({
        error: 'Portal-02 API connection failed',
        details: testResult
      });
    }
    
    const balance = await portal02Service.checkBalance();
    
    res.json({
      platform: 'Portal-02.com',
      connection: 'SUCCESS',
      balance: balance,
      testResult: testResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Portal-02 API test failed',
      details: error.message
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

    // Check if Paystack is configured
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ 
        error: 'Payment system is temporarily unavailable' 
      });
    }

    // Create order
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
      userId: req.userId
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentStatus === 'success') {
      return res.status(400).json({ error: 'This order has already been paid' });
    }

    // Convert amount to kobo
    const amountInKobo = Math.round(order.total * 100);

    // Initialize Paystack transaction
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
    
    if (error.response?.status === 401) {
      return res.status(503).json({ 
        error: 'Payment service configuration error' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to initialize payment' 
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

    // Find order
    const order = await Order.findOne({ paystackReference: reference });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Security check
    if (order.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (data.status === 'success') {
      order.status = 'paid';
      order.paymentStatus = 'success';
      order.paymentReference = data.reference;
      
      // Mark as processing - will be delivered via Portal-02
      order.status = 'processing';
      await order.save();
      
      // AUTO-DELIVER via Portal-02 if configured
      if (process.env.PORTAL02_API_KEY) {
        try {
          const deliveries = [];
          for (const item of order.items) {
            const delivery = await portal02Service.purchaseDataBundle(
              item.recipientPhone || order.recipientPhone,
              item.size,
              item.network
            );
            
            deliveries.push({
              network: item.network,
              size: item.size,
              recipient: item.recipientPhone || order.recipientPhone,
              success: delivery.success,
              transactionId: delivery.transactionId,
              message: delivery.message,
              timestamp: new Date()
            });
            
            // Small delay between purchases
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          const allDelivered = deliveries.every(d => d.success);
          order.deliveryDetails = deliveries;
          
          if (allDelivered) {
            order.status = 'delivered';
            order.deliveredAt = new Date();
          } else {
            order.status = deliveries.some(d => d.success) ? 'partially_delivered' : 'processing';
          }
          
          await order.save();
          
        } catch (deliveryError) {
          console.error('Auto-delivery failed:', deliveryError);
          order.status = 'processing'; // Manual intervention needed
          await order.save();
        }
      }
      
      res.json({
        success: true,
        message: process.env.PORTAL02_API_KEY ? 
          'Payment successful! Data bundle is being delivered.' :
          'Payment successful! Data delivery pending.',
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

    } else {
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
      error: 'Failed to verify payment' 
    });
  }
});

// Deliver Data Bundle via Portal-02
app.post('/api/orders/:id/deliver', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find order
    const order = await Order.findOne({
      _id: id,
      userId: req.userId
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentStatus !== 'success') {
      return res.status(400).json({ error: 'Order not paid yet' });
    }

    if (order.status === 'delivered') {
      return res.status(400).json({ error: 'Order already delivered' });
    }

    // Check Portal-02 configuration
    if (!process.env.PORTAL02_API_KEY) {
      return res.status(503).json({ 
        error: 'Data delivery service is not configured' 
      });
    }

    // Check Portal-02 balance
    const balanceCheck = await portal02Service.checkBalance();
    if (!balanceCheck.success || balanceCheck.balance < order.total) {
      return res.status(402).json({ 
        error: 'Insufficient balance on data delivery account',
        balance: balanceCheck.balance,
        required: order.total
      });
    }

    // Process each item
    const deliveries = [];
    for (const item of order.items) {
      const delivery = await portal02Service.purchaseDataBundle(
        item.recipientPhone || order.recipientPhone,
        item.size,
        item.network
      );
      
      deliveries.push({
        network: item.network,
        size: item.size,
        recipient: item.recipientPhone || order.recipientPhone,
        success: delivery.success,
        transactionId: delivery.transactionId,
        message: delivery.message,
        timestamp: new Date()
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Update order status
    const allSuccessful = deliveries.every(d => d.success);
    order.deliveryDetails = deliveries;
    
    if (allSuccessful) {
      order.status = 'delivered';
      order.deliveredAt = new Date();
    } else {
      order.status = deliveries.some(d => d.success) ? 'partially_delivered' : 'processing';
    }
    
    await order.save();

    res.json({
      success: allSuccessful,
      platform: 'Portal-02.com',
      message: allSuccessful ? 
        'All data bundles delivered successfully!' :
        'Some bundles failed to deliver',
      deliveries: deliveries,
      order: {
        id: order._id,
        orderId: order.orderId,
        status: order.status,
        deliveredAt: order.deliveredAt
      }
    });

  } catch (error) {
    console.error('Delivery error:', error);
    res.status(500).json({ 
      error: 'Delivery failed',
      details: error.message 
    });
  }
});

// Get User Orders
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
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
      userId: req.userId
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

// Get User Dashboard
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(10);
    
    const stats = {
      totalOrders: await Order.countDocuments({ userId: req.userId }),
      pendingOrders: await Order.countDocuments({ 
        userId: req.userId, 
        status: 'pending' 
      }),
      deliveredOrders: await Order.countDocuments({ 
        userId: req.userId, 
        status: 'delivered' 
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

    // Handle payment events
    if (event.event === 'charge.success') {
      order.status = 'paid';
      order.paymentStatus = 'success';
      order.paymentReference = reference;
      
      // Auto-deliver via Portal-02 if configured
      if (process.env.PORTAL02_API_KEY) {
        try {
          const deliveries = [];
          for (const item of order.items) {
            const delivery = await portal02Service.purchaseDataBundle(
              item.recipientPhone || order.recipientPhone,
              item.size,
              item.network
            );
            
            deliveries.push({
              network: item.network,
              size: item.size,
              recipient: item.recipientPhone || order.recipientPhone,
              success: delivery.success,
              transactionId: delivery.transactionId,
              message: delivery.message,
              timestamp: new Date()
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          order.deliveryDetails = deliveries;
          const allDelivered = deliveries.every(d => d.success);
          
          if (allDelivered) {
            order.status = 'delivered';
            order.deliveredAt = new Date();
          } else {
            order.status = deliveries.some(d => d.success) ? 'partially_delivered' : 'processing';
          }
          
        } catch (deliveryError) {
          console.error('Webhook auto-delivery failed:', deliveryError);
          order.status = 'processing';
        }
      } else {
        order.status = 'processing';
      }
      
      await order.save();
      console.log(`✅ Payment successful via webhook for order ${order.orderId}`);
      
    } else if (event.event === 'charge.failed') {
      order.status = 'failed';
      order.paymentStatus = 'failed';
      await order.save();
      console.log(`❌ Payment failed via webhook for order ${order.orderId}`);
    }

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

// Portal-02 Purchase Test
app.post('/api/portal02/purchase-test', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber, network, size } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    if (!process.env.PORTAL02_API_KEY) {
      return res.status(503).json({ error: 'Portal-02 API key not configured' });
    }
    
    const testNetwork = network || 'MTN';
    const testSize = size || '1GB';
    
    const result = await portal02Service.purchaseDataBundle(
      phoneNumber,
      testSize,
      testNetwork
    );
    
    res.json({
      platform: 'Portal-02.com',
      test: 'Data Purchase Test',
      phone: phoneNumber,
      network: testNetwork,
      size: testSize,
      result: result
    });
    
  } catch (error) {
    console.error('Portal-02 purchase test error:', error);
    res.status(500).json({ 
      error: 'Purchase test failed', 
      details: error.message 
    });
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
  console.log(`💳 Paystack: ${PAYSTACK_SECRET_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`📦 Portal-02: ${process.env.PORTAL02_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`🔐 User Data Isolation: ACTIVE`);
});