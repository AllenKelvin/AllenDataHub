const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/allendatahub';

console.log('🔗 Attempting to connect to MongoDB...');
console.log('📁 Connection string:', MONGODB_URI.replace(/:[^:]*@/, ':****@'));

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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
    enum: ['placed', 'processing', 'delivered'], 
    default: 'placed' 
  },
  recipientEmail: String,
  recipientPhone: String,
  paymentMethod: String,
  paymentReference: String,
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

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'allendatahub-super-secret-jwt-key-2024';

// Auth Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log('🔐 Auth middleware - Token received:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token decoded, user ID:', decoded.userId);
    
    req.user = await User.findById(decoded.userId).select('-password');
    
    if (!req.user) {
      console.log('❌ User not found for ID:', decoded.userId);
      return res.status(401).json({ error: 'User not found' });
    }
    
    console.log('✅ User authenticated:', req.user.username);
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    res.status(401).json({ error: 'Token is not valid' });
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

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

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
    let plans = await DataPlan.find();
    
    // If no plans in database, create sample data
    if (plans.length === 0) {
      const samplePlans = [
        { network: 'MTN', size: '1GB', price: 5, validity: '30 days', popular: true },
        { network: 'MTN', size: '2GB', price: 10, validity: '30 days' },
        { network: 'MTN', size: '5GB', price: 20, validity: '30 days' },
        { network: 'Telecel', size: '1GB', price: 4, validity: '30 days', popular: true },
        { network: 'Telecel', size: '2GB', price: 8, validity: '30 days' },
        { network: 'Telecel', size: '5GB', price: 18, validity: '30 days' }
      ];
      
      await DataPlan.insertMany(samplePlans);
      plans = await DataPlan.find();
    }

    res.json(plans);
  } catch (error) {
    console.error('Plans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch data plans' });
  }
});

// Create Order - FIXED VERSION
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    console.log('🛒 Order creation request received');
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User making order:', req.user.username);

    const { items, total, recipientEmail, recipientPhone, paymentMethod } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    if (!total || total <= 0) {
      return res.status(400).json({ error: 'Invalid order total' });
    }

    // Create order
    const order = new Order({
      orderId: 'ORD' + Date.now(),
      userId: req.user._id,
      items: items,
      total: total,
      recipientEmail: recipientEmail,
      recipientPhone: recipientPhone,
      paymentMethod: paymentMethod || 'mobile_money',
      status: 'placed'
    });

    await order.save();
    console.log(`✅ Order created successfully: ${order.orderId}`);

    // Return the complete order data
    res.status(201).json({
      message: 'Order created successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        userId: order.userId,
        items: order.items,
        total: order.total,
        status: order.status,
        recipientEmail: order.recipientEmail,
        recipientPhone: order.recipientPhone,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt
      }
    });

    // Simulate order processing (in background)
    setTimeout(async () => {
      try {
        order.status = 'processing';
        await order.save();
        console.log(`🔄 Order status updated to processing: ${order.orderId}`);
      } catch (error) {
        console.error('Error updating order status to processing:', error);
      }
    }, 5000);

    setTimeout(async () => {
      try {
        order.status = 'delivered';
        await order.save();
        console.log(`🎉 Order status updated to delivered: ${order.orderId}`);
      } catch (error) {
        console.error('Error updating order status to delivered:', error);
      }
    }, 15000);

  } catch (error) {
    console.error('❌ Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order: ' + error.message });
  }
});

// ==================== ENHANCED MTN CALLBACK ROUTE ====================

// MTN API Webhook Callback
app.post('/api/mtn/callback', (req, res) => {
  const callbackId = 'CB_' + Date.now();
  
  console.log('\n📞 ======== MTN CALLBACK RECEIVED ========');
  console.log(`🆔 Callback ID: ${callbackId}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
  console.log(`📨 Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
  console.log('=========================================\n');

  try {
    // Validate required fields
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log(`❌ ${callbackId}: Empty request body`);
      return res.status(400).json({ 
        status: 'error',
        message: 'Empty request body',
        callbackId: callbackId
      });
    }

    // Handle different MTN webhook types
    switch (req.body.type) {
      case 'payment':
        console.log(`💰 ${callbackId}: Processing payment notification`);
        handlePaymentCallback(req.body, callbackId);
        break;
        
      case 'sms_delivery':
        console.log(`📱 ${callbackId}: Processing SMS delivery report`);
        handleSmsCallback(req.body, callbackId);
        break;
        
      case 'ussd':
        console.log(`🔘 ${callbackId}: Processing USSD interaction`);
        handleUssdCallback(req.body, callbackId);
        break;
        
      default:
        console.log(`🔍 ${callbackId}: Unknown callback type: ${req.body.type}`);
        console.log(`📋 ${callbackId}: Full payload:`, JSON.stringify(req.body, null, 2));
    }

    // Always respond quickly (MTN requirement)
    const response = {
      status: 'success',
      message: 'Callback processed successfully',
      callbackId: callbackId,
      timestamp: new Date().toISOString(),
      receivedType: req.body.type || 'unknown'
    };

    console.log(`✅ ${callbackId}: Responding with:`, JSON.stringify(response, null, 2));
    
    res.status(200).json(response);

  } catch (error) {
    console.error(`❌ ${callbackId}: Callback processing error:`, error);
    
    // Still return 200 to prevent MTN from retrying excessively
    res.status(200).json({ 
      status: 'error_handled',
      message: 'Error processed internally',
      callbackId: callbackId,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions for different callback types
function handlePaymentCallback(data, callbackId) {
  const { transactionId, amount, status, phoneNumber } = data;
  
  console.log(`💳 ${callbackId}: Payment Details:`, {
    transactionId,
    amount,
    currency: data.currency || 'GHS',
    status,
    phoneNumber,
    customerName: data.customerName || 'N/A'
  });

  // TODO: Update your database here
  // Example: Update order status based on transactionId
  if (status === 'success') {
    console.log(`🎉 ${callbackId}: Payment successful, updating order status`);
    // await Order.findOneAndUpdate(
    //   { paymentReference: transactionId },
    //   { status: 'paid', paymentStatus: 'completed' }
    // );
  } else {
    console.log(`⚠️ ${callbackId}: Payment failed or pending`);
  }
}

function handleSmsCallback(data, callbackId) {
  const { messageId, status, recipient } = data;
  
  console.log(`✉️ ${callbackId}: SMS Delivery Report:`, {
    messageId,
    status,
    recipient,
    deliveryTime: data.timestamp || new Date().toISOString()
  });

  // TODO: Update SMS delivery status in your database
}

function handleUssdCallback(data, callbackId) {
  const { sessionId, phoneNumber, input } = data;
  
  console.log(`*️⃣ ${callbackId}: USSD Interaction:`, {
    sessionId,
    phoneNumber,
    input,
    serviceCode: data.serviceCode || 'N/A'
  });

  // TODO: Handle USSD interactions
}

// Test endpoint to verify callback configuration
app.get('/api/mtn/debug', (req, res) => {
  const testData = {
    endpoint: 'http://localhost:5000/api/mtn/callback',
    status: 'active',
    serverTime: new Date().toISOString(),
    testPayloads: {
      payment: {
        type: 'payment',
        transactionId: 'TEST_' + Date.now(),
        amount: 100,
        currency: 'GHS',
        status: 'success',
        phoneNumber: '233123456789'
      },
      sms: {
        type: 'sms_delivery',
        messageId: 'MSG_TEST_' + Date.now(),
        status: 'delivered',
        recipient: '233123456789'
      }
    }
  };
  
  res.json(testData);
});
const mtnService = require('./services/mtnService');

// Add these routes AFTER your existing routes but BEFORE app.listen()

// Test MTN Connection
app.get('/api/mtn/test', async (req, res) => {
  try {
    console.log('🧪 Testing MTN API connection...');
    const result = await mtnService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test Data Transfer
app.post('/api/mtn/transfer', async (req, res) => {
  try {
    const { receiverPhone, productCode, amount } = req.body;
    
    const result = await mtnService.transferData(
      process.env.MTN_SENDER_MSISDN,
      receiverPhone,
      productCode,
      amount
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Server status
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      mtnTest: 'GET /api/mtn/test',
      mtnTransfer: 'POST /api/mtn/transfer'
    }
  });
});

// services/mtnService.js - SIMPLE VERSION
class MTNService {
  async testConnection() {
    console.log('🧪 MTN Test connection called');
    return {
      success: true,
      message: '✅ Mock MTN API connection successful!',
      environment: 'MOCK',
      hasToken: true
    };
  }

  async transferData(senderPhone, receiverPhone, productCode, amount) {
    console.log('🔄 Mock data transfer called');
    return {
      success: true,
      data: {
        statusCode: '2000',
        statusMessage: 'Success',
        transactionId: 'MOCK_' + Date.now()
      }
    };
  }
}

module.exports = new MTNService();

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

// Admin: Get All Orders (for dashboard)
app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Admin orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Admin: Get Dashboard Statistics
app.get('/api/admin/stats', async (req, res) => {
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

    const stats = {
      today: {
        totalOrders: todayOrders.length,
        totalRevenue: todayOrders.reduce((sum, order) => sum + order.total, 0),
        totalDataVolume: todayOrders.reduce((sum, order) => {
          return sum + order.items.reduce((itemSum, item) => {
            const size = parseInt(item.size);
            return itemSum + (isNaN(size) ? 0 : size);
          }, 0);
        }, 0) + 'GB'
      },
      allTime: {
        totalOrders,
        totalRevenue: totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0
      },
      networkStats: networkStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };

    res.json(stats);
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
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
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message 
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 AllenDataHub Backend Server Started!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}`);
  console.log(`🌐 MongoDB: ${MONGODB_URI.replace(/:[^:]*@/, ':****@')}`);
});

// Replace current CORS setup with:
const corsOptions = {
  origin: [
    'http://localhost:3000',  // Local development
    'https://your-vercel-app.vercel.app',  // Your Vercel URL
    'https://allendatahub.com'  // Your custom domain (if you have one)
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));