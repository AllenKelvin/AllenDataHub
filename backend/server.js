const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
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

// Request logging middleware
app.use((req, res, next) => {
  console.log(`🌐 ${new Date().toISOString()} ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.url.includes('/api/orders')) {
    console.log('📥 Request Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// IMPROVED MongoDB Connection with better error handling
const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  try {
    console.log('🔌 Attempting MongoDB connection...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Increased timeout
      socketTimeoutMS: 45000,
      maxPoolSize: 10, // Connection pool
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('✅ MongoDB Connected Successfully');
    console.log(`📊 Host: ${mongoose.connection.host}`);
    console.log(`🗃️ Database: ${mongoose.connection.name}`);
    
    // Monitor connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });
    
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.error('🔗 Connection URI:', MONGODB_URI ? 'Set' : 'NOT SET');
    console.log('⚠️ Retrying connection in 10 seconds...');
    setTimeout(connectDB, 10000);
  }
};

// Initialize data plans with your exact prices
async function initializeDataPlans() {
  try {
    const existingPlans = await DataPlan.countDocuments();
    if (existingPlans === 0) {
      console.log('📊 Initializing data plans with your pricing...');
      
      const dataPlans = [
        // MTN Plans
        { network: 'MTN', size: '1GB', price: 4.30, validity: '30 days', description: 'MTN Non-Expiry', popular: true },
        { network: 'MTN', size: '2GB', price: 8.50, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '3GB', price: 12.50, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '4GB', price: 16.50, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '5GB', price: 20.60, validity: '30 days', description: 'MTN Non-Expiry', popular: true },
        { network: 'MTN', size: '6GB', price: 24.70, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '7GB', price: 28.80, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '8GB', price: 33.20, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '10GB', price: 39.70, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '15GB', price: 58.50, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '20GB', price: 77.50, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '25GB', price: 97.10, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '30GB', price: 117.10, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '40GB', price: 155.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '50GB', price: 186.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '100GB', price: 364.00, validity: '30 days', description: 'MTN Non-Expiry' },
        
        // Telecel Plans
        { network: 'Telecel', size: '5GB', price: 19.60, validity: '30 days', description: 'Telecel Bundle', popular: true },
        { network: 'Telecel', size: '10GB', price: 37.30, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '15GB', price: 53.60, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '20GB', price: 70.60, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '25GB', price: 88.30, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '30GB', price: 107.00, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '40GB', price: 141.00, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '50GB', price: 176.00, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '100GB', price: 348.00, validity: '30 days', description: 'Telecel Bundle' },
        
        // AirtelTigo Plans
        { network: 'AirtelTigo', size: '1GB', price: 3.95, validity: '30 days', description: 'AirtelTigo Bundle', popular: true },
        { network: 'AirtelTigo', size: '2GB', price: 7.70, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '3GB', price: 11.70, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '4GB', price: 15.50, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '5GB', price: 19.50, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '6GB', price: 23.70, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '7GB', price: 27.50, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '8GB', price: 31.10, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '9GB', price: 35.00, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '10GB', price: 39.00, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '12GB', price: 47.00, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '15GB', price: 60.00, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '20GB', price: 78.00, validity: '30 days', description: 'AirtelTigo Bundle' }
      ];
      
      await DataPlan.insertMany(dataPlans);
      console.log(`✅ ${dataPlans.length} data plans initialized`);
    }
  } catch (error) {
    console.error('❌ Error initializing data plans:', error);
  }
}

connectDB();

// Helper function to normalize numbers to Double precision
const toDouble = (num) => {
  if (num === null || num === undefined) return 0;
  const value = typeof num === 'string' ? parseFloat(num) : Number(num);
  return Math.round(value * 100) / 100;
};

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  address: { type: String },
  password: { type: String, required: true },
  role: { type: String, enum: ['client', 'admin'], default: 'client' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// FIXED: Order schema - REMOVED planId completely
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    network: { type: String, required: true },
    size: { type: String, required: true },
    price: { type: Number, required: true },
    recipientPhone: { type: String, required: true },
    quantity: { type: Number, default: 1 }
  }],
  totalAmount: { type: Number, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },
  paymentMethod: { type: String, enum: ['paystack', 'cash', 'mobile_money'], default: 'paystack' },
  paymentStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  paymentReference: { type: String },
  status: { type: String, enum: ['placed', 'processing', 'delivered', 'cancelled'], default: 'placed' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const dataPlanSchema = new mongoose.Schema({
  network: { type: String, required: true },
  size: { type: String, required: true },
  price: { type: Number, required: true },
  validity: { type: String, required: true },
  description: { type: String },
  popular: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String },
  email: { type: String, required: true },
  phone: { type: String },
  message: { type: String, required: true },
  status: { type: String, enum: ['new', 'in_progress', 'resolved'], default: 'new' },
  response: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// MongoDB Models
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const DataPlan = mongoose.model('DataPlan', dataPlanSchema);
const Contact = mongoose.model('Contact', contactSchema);

// Paystack Configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Initialize Paystack API
const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production';

// Helper function to validate Ghana phone number
const isValidGhanaNumber = (phone) => {
  if (!phone) return false;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const ghanaRegex = /^(020|023|024|025|026|027|028|029|030|050|054|055|056|057|058|059|053)\d{7}$/;
  return ghanaRegex.test(cleanPhone);
};

// Auth Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    
    // Check MongoDB connection
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      console.log(`⚠️ Database state: ${dbState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`);
      return res.status(503).json({ 
        error: 'Database temporarily unavailable',
        status: dbState 
      });
    }
    
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Admin Middleware
const adminMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      return res.status(503).json({ error: 'Database temporarily unavailable' });
    }
    
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// ==================== ROUTES ====================

// Health Check with detailed DB info
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  
  res.json({ 
    status: 'OK',
    service: 'AllenDataHub API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: {
      state: states[dbState] || 'unknown',
      readyState: dbState,
      host: mongoose.connection.host || 'unknown',
      name: mongoose.connection.name || 'unknown'
    }
  });
});

// Test MongoDB connection
app.get('/api/test-db', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    
    if (dbState === 1) {
      // Try a simple query
      const userCount = await User.countDocuments();
      const planCount = await DataPlan.countDocuments();
      
      res.json({
        connected: true,
        message: 'MongoDB is connected and responding',
        stats: {
          users: userCount,
          plans: planCount
        },
        connection: {
          host: mongoose.connection.host,
          database: mongoose.connection.name
        }
      });
    } else {
      res.json({
        connected: false,
        message: `MongoDB is not connected (state: ${dbState})`,
        connectionString: process.env.MONGODB_URI ? 'Set' : 'NOT SET'
      });
    }
  } catch (error) {
    res.json({
      connected: false,
      message: 'MongoDB test failed',
      error: error.message
    });
  }
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      return res.status(503).json({ 
        error: 'Database temporarily unavailable. Please try again.',
        dbState: dbState
      });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      phone,
      password: hashedPassword,
      role: email.includes('admin') ? 'admin' : 'client'
    });

    await user.save();

    const token = jwt.sign({ 
      userId: user._id,
      role: user.role 
    }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'MongoServerError' && error.code === 11000) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      return res.status(503).json({ 
        error: 'Database temporarily unavailable. Please try again.',
        dbState: dbState
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    const token = jwt.sign({ 
      userId: user._id,
      role: user.role 
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get User Profile
app.get('/api/users/profile', authMiddleware, async (req, res) => {
  try {
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update User Profile
app.put('/api/users/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;

    const updateData = {};
    if (name) updateData.username = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    updateData.updatedAt = new Date();

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change Password
app.post('/api/users/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const user = await User.findById(req.userId);
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Contact Support
app.post('/api/users/contact', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const contact = new Contact({
      userId: req.userId,
      name: req.user.username,
      email: req.user.email,
      phone: req.user.phone,
      message: message
    });

    await contact.save();

    console.log(`📧 New contact message from ${req.user.email}: ${message}`);

    res.json({
      success: true,
      message: 'Your message has been sent successfully',
      contactId: contact._id
    });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get Data Plans
app.get('/api/plans', async (req, res) => {
  try {
    const { network } = req.query;
    let query = {};
    
    if (network && network !== 'All') {
      query.network = network;
    }

    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      console.log('⚠️ MongoDB not connected, returning fallback plans');
      return getFallbackPlans(network, res);
    }

    const plans = await DataPlan.find(query).sort({ price: 1 });
    
    if (plans.length === 0) {
      // If no plans exist, initialize them
      await initializeDataPlans();
      const updatedPlans = await DataPlan.find(query).sort({ price: 1 });
      return res.json(updatedPlans);
    }

    res.json(plans);
  } catch (error) {
    console.error('Plans fetch error:', error);
    getFallbackPlans(req.query.network, res);
  }
});

// Helper function for fallback plans
function getFallbackPlans(network, res) {
  const fallbackPlans = [
    // MTN Plans
    { network: 'MTN', size: '1GB', price: 4.30, validity: '30 days', description: 'MTN Non-Expiry', popular: true },
    { network: 'MTN', size: '2GB', price: 8.50, validity: '30 days', description: 'MTN Non-Expiry' },
    { network: 'MTN', size: '3GB', price: 12.50, validity: '30 days', description: 'MTN Non-Expiry' },
    { network: 'MTN', size: '5GB', price: 20.60, validity: '30 days', description: 'MTN Non-Expiry' },
    { network: 'MTN', size: '10GB', price: 39.70, validity: '30 days', description: 'MTN Non-Expiry' },
    
    // Telecel Plans
    { network: 'Telecel', size: '5GB', price: 19.60, validity: '30 days', description: 'Telecel Bundle', popular: true },
    { network: 'Telecel', size: '10GB', price: 37.30, validity: '30 days', description: 'Telecel Bundle' },
    
    // AirtelTigo Plans
    { network: 'AirtelTigo', size: '1GB', price: 3.95, validity: '30 days', description: 'AirtelTigo Bundle', popular: true },
    { network: 'AirtelTigo', size: '2GB', price: 7.70, validity: '30 days', description: 'AirtelTigo Bundle' },
    { network: 'AirtelTigo', size: '5GB', price: 19.50, validity: '30 days', description: 'AirtelTigo Bundle' }
  ];

  let filteredPlans = fallbackPlans;
  if (network && network !== 'All') {
    filteredPlans = fallbackPlans.filter(plan => plan.network === network);
  }

  res.json(filteredPlans);
}

// Get Plans by Network
app.get('/api/plans/network/:network', async (req, res) => {
  try {
    const { network } = req.params;
    
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      console.log('⚠️ MongoDB not connected, returning fallback network plans');
      getFallbackPlans(network, res);
      return;
    }
    
    const plans = await DataPlan.find({ network }).sort({ price: 1 });
    res.json(plans);
  } catch (error) {
    console.error('Network plans fetch error:', error);
    getFallbackPlans(req.params.network, res);
  }
});

// ORDER VERIFICATION
app.post('/api/orders/verify', authMiddleware, async (req, res) => {
  try {
    const { items, totalAmount, customerEmail, customerPhone } = req.body;

    console.log('🔍 Order verification request received:', {
      itemsCount: items?.length,
      totalAmount,
      customerEmail,
      customerPhone
    });

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        valid: false,
        message: 'Order must contain at least one item' 
      });
    }

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ 
        valid: false,
        message: 'Invalid order total' 
      });
    }

    if (!customerEmail || !customerPhone) {
      return res.status(400).json({ 
        valid: false,
        message: 'Customer email and phone are required' 
      });
    }

    for (const item of items) {
      if (!item.recipientPhone) {
        return res.status(400).json({
          valid: false,
          message: 'Recipient phone number is required for all items'
        });
      }

      if (!isValidGhanaNumber(item.recipientPhone)) {
        return res.status(400).json({
          valid: false,
          message: `Invalid Ghana phone number: ${item.recipientPhone}. Format: 0241234567`
        });
      }
    }

    let calculatedTotal = 0;
    for (const item of items) {
      const itemPrice = parseFloat(item.price) || 0;
      const itemQuantity = parseInt(item.quantity) || 1;
      calculatedTotal += itemPrice * itemQuantity;
    }

    const serviceFee = 0.50;
    const finalTotal = toDouble(calculatedTotal + serviceFee);

    const difference = Math.abs(finalTotal - totalAmount);
    if (difference > 0.01) {
      console.log(`Total mismatch: Calculated=${finalTotal}, Received=${totalAmount}, Difference=${difference}`);
      
      return res.status(400).json({
        valid: false,
        message: `Total amount mismatch. Expected: GH₵${finalTotal.toFixed(2)}, Received: GH₵${totalAmount}`,
        calculatedTotal: finalTotal,
        receivedTotal: totalAmount,
        difference: difference.toFixed(2),
        serviceFee: serviceFee
      });
    }

    console.log('✅ Order verification successful:', {
      itemsCount: items.length,
      calculatedTotal: finalTotal
    });

    res.json({
      valid: true,
      message: 'Order verified successfully',
      totalAmount: finalTotal,
      calculatedAmount: calculatedTotal,
      serviceFee: serviceFee,
      items: items,
      verificationId: `VERIFY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Order verification error:', error);
    res.status(500).json({ 
      valid: false,
      message: 'Failed to verify order',
      error: error.message
    });
  }
});

// FIXED: Create Order - planId REMOVED completely
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    console.log('📦 Order Creation Request Body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User ID:', req.userId);
    
    const { items, totalAmount, customerEmail, customerPhone, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log('❌ Validation failed: No items in order');
      return res.status(400).json({ 
        success: false,
        error: 'Order must contain at least one item' 
      });
    }

    for (const item of items) {
      if (!item.network || !item.size || item.price === undefined || !item.recipientPhone) {
        console.log('❌ Invalid item:', item);
        return res.status(400).json({
          success: false,
          error: 'Each item must have network, size, price, and recipientPhone'
        });
      }
    }

    if (!totalAmount || isNaN(totalAmount) || totalAmount <= 0) {
      console.log('❌ Validation failed: Invalid total amount', totalAmount);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid order total' 
      });
    }

    if (!customerEmail || !customerPhone) {
      console.log('❌ Validation failed: Missing customer info', { customerEmail, customerPhone });
      return res.status(400).json({ 
        success: false,
        error: 'Customer email and phone are required' 
      });
    }

    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      console.log('❌ Database not connected');
      return res.status(503).json({ 
        success: false,
        error: 'Database temporarily unavailable. Please try again.' 
      });
    }

    // Validate userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.userId)) {
      console.log('❌ Invalid user ID:', req.userId);
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    // FIXED: planId REMOVED completely
    const preparedItems = items.map(item => ({
      network: item.network,
      size: item.size,
      price: parseFloat(item.price) || 0,
      recipientPhone: item.recipientPhone,
      quantity: parseInt(item.quantity) || 1
    }));

    console.log('💾 Prepared items:', preparedItems);

    const order = new Order({
      userId: new mongoose.Types.ObjectId(req.userId),
      items: preparedItems,
      totalAmount: parseFloat(totalAmount) || 0,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
      paymentMethod: paymentMethod || 'paystack',
      paymentStatus: 'pending',
      status: 'placed'
    });

    await order.save();
    console.log('✅ Order saved successfully. ID:', order._id);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      orderId: order._id,
      order: {
        _id: order._id,
        items: order.items,
        totalAmount: order.totalAmount,
        status: order.status,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Order creation error:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        details: 'The user ID is not valid'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to create order',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get User Orders
app.get('/api/orders/my-orders', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const orders = await Order.find({ userId: new mongoose.Types.ObjectId(req.userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalOrders = await Order.countDocuments({ userId: new mongoose.Types.ObjectId(req.userId) });

    res.json({
      orders,
      pagination: {
        total: totalOrders,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalOrders / limit)
      }
    });
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get Recent Transactions
app.get('/api/orders/recent', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    if (!mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const orders = await Order.find({ userId: new mongoose.Types.ObjectId(req.userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const recentTransactions = orders.map(order => ({
      id: order._id,
      package: order.items[0]?.network + '-' + order.items[0]?.size,
      description: order.items[0]?.description || `${order.items[0]?.network} Data Bundle`,
      amount: order.totalAmount,
      beneficiary: order.items[0]?.recipientPhone || order.customerPhone,
      paymentSource: order.paymentMethod || 'Paystack',
      paymentStatus: order.paymentStatus || 'pending',
      date: order.createdAt,
      status: order.status || 'placed'
    }));

    res.json(recentTransactions);
  } catch (error) {
    console.error('Recent transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch recent transactions' });
  }
});

// Get Single Order
app.get('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: new mongoose.Types.ObjectId(req.userId)
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

// Cancel Order
app.delete('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: new mongoose.Types.ObjectId(req.userId)
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot cancel delivered order' });
    }

    order.status = 'cancelled';
    order.updatedAt = new Date();
    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: order
    });
  } catch (error) {
    console.error('Order cancellation error:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// Get User Dashboard Stats
app.get('/api/users/dashboard-stats', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const userId = new mongoose.Types.ObjectId(req.userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userOrders = await Order.find({ userId: userId })
      .sort({ createdAt: -1 })
      .lean();
    
    const totalOrders = userOrders.length;
    const todayOrders = userOrders.filter(order => order.createdAt >= today).length;
    
    const totalSpent = userOrders
      .filter(order => order.paymentStatus === 'success')
      .reduce((sum, order) => sum + order.totalAmount, 0);
    
    let totalDataGB = 0;
    let totalDataMB = 0;
    
    userOrders.forEach(order => {
      order.items.forEach(item => {
        const quantity = item.quantity || 1;
        const size = item.size || '';
        
        if (size.includes('GB')) {
          const gbValue = parseFloat(size.replace('GB', '').trim());
          if (!isNaN(gbValue)) {
            totalDataGB += gbValue * quantity;
          }
        } else if (size.includes('MB')) {
          const mbValue = parseFloat(size.replace('MB', '').trim());
          if (!isNaN(mbValue)) {
            totalDataMB += mbValue * quantity;
          }
        }
      });
    });
    
    const totalDataFromMB = totalDataMB / 1024;
    const totalDataVolume = totalDataGB + totalDataFromMB;
    
    const deliveredOrders = userOrders.filter(order => order.status === 'delivered').length;
    const successfulOrders = userOrders.filter(order => order.paymentStatus === 'success');
    const averageOrderValue = successfulOrders.length > 0 ? totalSpent / successfulOrders.length : 0;
    
    const recentOrders = userOrders.slice(0, 5).map(order => ({
      id: order._id,
      package: order.items[0]?.network + '-' + order.items[0]?.size,
      amount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      date: order.createdAt,
      items: order.items.map(item => ({
        network: item.network,
        size: item.size,
        price: item.price
      }))
    }));
    
    res.json({
      stats: {
        totalOrders,
        todayOrders,
        deliveredOrders,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        totalDataGB: parseFloat(totalDataVolume.toFixed(2)),
        totalDataMB: totalDataMB,
        totalDataFormatted: totalDataVolume >= 1 ? 
          `${totalDataVolume.toFixed(2)} GB` : 
          `${(totalDataVolume * 1024).toFixed(0)} MB`,
        orderSuccessRate: totalOrders > 0 ? 
          parseFloat(((deliveredOrders / totalOrders) * 100).toFixed(1)) : 0
      },
      recentOrders
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard stats',
      stats: getFallbackStats()
    });
  }
});

function getFallbackStats() {
  return {
    totalOrders: 0,
    todayOrders: 0,
    deliveredOrders: 0,
    totalSpent: 0,
    averageOrderValue: 0,
    totalDataGB: 0,
    totalDataMB: 0,
    totalDataFormatted: '0 GB',
    orderSuccessRate: 0
  };
}

// Get Transaction History
app.get('/api/users/transactions', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const orders = await Order.find({ userId: new mongoose.Types.ObjectId(req.userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalOrders = await Order.countDocuments({ userId: new mongoose.Types.ObjectId(req.userId) });

    const transactions = orders.map(order => ({
      id: order._id,
      package: order.items.map(item => `${item.network} ${item.size}`).join(', '),
      description: order.items[0]?.description || 'Data Bundle',
      amount: order.totalAmount,
      beneficiary: order.items.map(item => item.recipientPhone).join(', '),
      paymentSource: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      date: order.createdAt,
      status: order.status
    }));

    res.json({
      transactions,
      pagination: {
        total: totalOrders,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalOrders / limit)
      }
    });
  } catch (error) {
    console.error('Transactions history error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

// Initialize Payment (Paystack) - UPDATED for redirect flow
app.post('/api/payment/initialize', authMiddleware, async (req, res) => {
  try {
    const { orderId, email, amount, redirectUrl } = req.body;
    console.log('💰 Payment initialization request:', { orderId, email, amount, redirectUrl });

    if (!orderId || !email || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ error: 'Payment service not configured' });
    }

    const validatedAmount = parseFloat(amount);
    const amountInKobo = Math.round(validatedAmount * 100);

    const reference = `ALLEN-${orderId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Use provided redirectUrl or default to payment-success
    const callbackUrl = redirectUrl || `${FRONTEND_URL}/payment-return`;

    const response = await paystack.post('/transaction/initialize', {
      email,
      amount: amountInKobo,
      reference: reference,
      callback_url: callbackUrl,
      metadata: {
        orderId,
        userId: req.userId,
        trxAmount: validatedAmount,
        timestamp: new Date().toISOString()
      }
    });

    const { data } = response.data;

    await Order.findByIdAndUpdate(orderId, {
      paymentReference: data.reference,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      paymentUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference,
      amount: validatedAmount
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({ 
      error: 'Failed to initialize payment',
      details: error.response?.data?.message || error.message 
    });
  }
});

// Verify Payment
app.get('/api/payment/verify/:reference', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await paystack.get(`/transaction/verify/${reference}`);
    const { data } = response.data;

    const order = await Order.findOne({ paymentReference: reference });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (data.status === 'success') {
      order.paymentStatus = 'success';
      order.status = 'processing';
      order.updatedAt = new Date();
      await order.save();

      console.log(`✅ Payment successful for order ${order._id}`);

      res.json({
        success: true,
        message: 'Payment verified successfully',
        order: order,
        id: order._id,
        amount: data.amount / 100
      });
    } else {
      order.paymentStatus = 'failed';
      order.updatedAt = new Date();
      await order.save();

      res.json({
        success: false,
        message: 'Payment verification failed',
        order: order
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify payment',
      details: error.response?.data?.message || error.message 
    });
  }
});

// Add a new route for payment verification on return
app.post('/api/payment/verify-return', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ error: 'Payment reference is required' });
    }

    const response = await paystack.get(`/transaction/verify/${reference}`);
    const { data } = response.data;

    const order = await Order.findOne({ paymentReference: reference });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (data.status === 'success') {
      order.paymentStatus = 'success';
      order.status = 'processing';
      order.updatedAt = new Date();
      await order.save();

      console.log(`✅ Payment successful for order ${order._id}`);

      // Process the order through Portal-02
      try {
        const portal02Service = require('./services/portal02Service');
        
        for (const item of order.items) {
          const result = await portal02Service.purchaseDataBundle(
            item.recipientPhone,
            item.size,
            item.network
          );
          
          console.log(`📦 Portal-02 purchase result for ${item.recipientPhone}:`, result.success);
        }
        
        order.status = 'processing';
        await order.save();
      } catch (portalError) {
        console.error('❌ Portal-02 processing error:', portalError);
        // Order is still marked as paid, but portal processing failed
      }

      res.json({
        success: true,
        message: 'Payment verified and order processing',
        orderId: order._id,
        amount: data.amount / 100,
        status: 'success',
        redirectTo: '/clientdashboard?payment=success'
      });
    } else {
      order.paymentStatus = 'failed';
      order.updatedAt = new Date();
      await order.save();

      res.json({
        success: false,
        message: 'Payment verification failed',
        orderId: order._id,
        status: 'failed',
        redirectTo: '/clientdashboard?payment=failed'
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to verify payment',
      status: 'error',
      redirectTo: '/clientdashboard?payment=error'
    });
  }
});

// ==================== ADMIN ROUTES ====================

app.get('/api/admin/orders', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('userId', 'username email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalOrders = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        total: totalOrders,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalOrders / limit)
      }
    });
  } catch (error) {
    console.error('Admin orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      todayOrders,
      totalRevenueResult,
      todayRevenueResult,
      userCount,
      networkStats
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.aggregate([
        { $match: { paymentStatus: 'success' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Order.aggregate([
        { 
          $match: { 
            paymentStatus: 'success',
            createdAt: { $gte: today }
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      User.countDocuments(),
      Order.aggregate([
        { $unwind: '$items' },
        { $group: { 
          _id: '$items.network', 
          count: { $sum: 1 },
          revenue: { $sum: '$items.price' }
        } }
      ])
    ]);

    const totalRevenue = totalRevenueResult.length > 0 ? 
      totalRevenueResult[0].total : 0;
    const todayRevenue = todayRevenueResult.length > 0 ? 
      todayRevenueResult[0].total : 0;

    const formattedNetworkStats = networkStats.reduce((acc, stat) => {
      acc[stat._id] = {
        orders: stat.count,
        revenue: stat.revenue
      };
      return acc;
    }, {});

    res.json({
      today: {
        totalOrders: todayOrders,
        totalRevenue: todayRevenue
      },
      allTime: {
        totalOrders,
        totalRevenue,
        totalUsers: userCount
      },
      networkStats: formattedNetworkStats
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

app.patch('/api/admin/orders/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: order
    });
  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

app.get('/api/admin/users/:userId/stats', adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const [
      totalOrders,
      totalSpentResult,
      recentOrders
    ] = await Promise.all([
      Order.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
      Order.aggregate([
        { $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          paymentStatus: 'success'
        }},
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Order.find({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    const totalSpent = totalSpentResult.length > 0 ? totalSpentResult[0].total : 0;

    res.json({
      userId,
      totalOrders,
      totalSpent,
      averageOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
      recentOrders: recentOrders
    });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// ==================== ERROR HANDLERS ====================

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

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
  console.log(`🔐 JWT: ${JWT_SECRET ? 'Configured' : 'Using default'}`);
  console.log(`🔗 MongoDB URI: ${process.env.MONGODB_URI ? 'Set' : 'NOT SET - Check .env file'}`);
  console.log(`📊 Database Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
  console.log(`🔄 Order System: planId REMOVED completely`);
  
  // Initialize data plans after server starts
  setTimeout(() => {
    initializeDataPlans();
  }, 2000);
});