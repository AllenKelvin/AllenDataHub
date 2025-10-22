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
    
    // If no plans in database, create comprehensive data plans
    if (plans.length === 0) {
      const samplePlans = [
        // MTN Data Plans (No Expiry)
        { network: 'MTN', size: '1GB', price: 4.30, validity: 'No Expiry', popular: true },
        { network: 'MTN', size: '2GB', price: 8.60, validity: 'No Expiry' },
        { network: 'MTN', size: '3GB', price: 12.90, validity: 'No Expiry' },
        { network: 'MTN', size: '4GB', price: 17.00, validity: 'No Expiry' },
        { network: 'MTN', size: '5GB', price: 20.95, validity: 'No Expiry' },
        { network: 'MTN', size: '6GB', price: 25.00, validity: 'No Expiry' },
        { network: 'MTN', size: '8GB', price: 33.95, validity: 'No Expiry' },
        { network: 'MTN', size: '10GB', price: 40.25, validity: 'No Expiry' },
        { network: 'MTN', size: '15GB', price: 58.95, validity: 'No Expiry' },
        { network: 'MTN', size: '20GB', price: 78.95, validity: 'No Expiry' },
        { network: 'MTN', size: '25GB', price: 97.00, validity: 'No Expiry' },
        { network: 'MTN', size: '30GB', price: 117.50, validity: 'No Expiry' },
        { network: 'MTN', size: '40GB', price: 154.50, validity: 'No Expiry' },
        { network: 'MTN', size: '50GB', price: 190.00, validity: 'No Expiry' },
        { network: 'MTN', size: '100GB', price: 373.00, validity: 'No Expiry' },
        
        // Telecel Data Plans (No Expiry)
        { network: 'Telecel', size: '5GB', price: 18.50, validity: 'No Expiry', popular: true },
        { network: 'Telecel', size: '10GB', price: 35.00, validity: 'No Expiry' },
        { network: 'Telecel', size: '15GB', price: 52.00, validity: 'No Expiry' },
        { network: 'Telecel', size: '20GB', price: 69.00, validity: 'No Expiry' },
        { network: 'Telecel', size: '25GB', price: 86.00, validity: 'No Expiry' },
        { network: 'Telecel', size: '30GB', price: 103.00, validity: 'No Expiry' },
        { network: 'Telecel', size: '35GB', price: 120.00, validity: 'No Expiry' },
        { network: 'Telecel', size: '40GB', price: 137.00, validity: 'No Expiry' },
        { network: 'Telecel', size: '45GB', price: 155.00, validity: 'No Expiry' },
        { network: 'Telecel', size: '50GB', price: 171.00, validity: 'No Expiry' },
        { network: 'Telecel', size: '100GB', price: 342.00, validity: 'No Expiry' }
      ];
      
      await DataPlan.insertMany(samplePlans);
      plans = await DataPlan.find();
      console.log(`✅ Loaded ${plans.length} data plans into database`);
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
  console.log(`📊 Available Data Plans: MTN (1GB - 100GB) & Telecel (5GB - 100GB)`);
});
