const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fosterConsoleService = require('./services/fosterConsoleService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
app.use(cors({
  origin: ['https://allendatahub.com', 'https://allen-data-hub.vercel.app'],
  credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`🌐 ${new Date().toISOString()} ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.url.includes('/api/orders')) {
    console.log('📥 Request Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  try {
    console.log('🔌 Attempting MongoDB connection...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('✅ MongoDB Connected Successfully');
    console.log(`📊 Host: ${mongoose.connection.host}`);
    console.log(`🗃️ Database: ${mongoose.connection.name}`);
    
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
    console.log('⚠️ Retrying connection in 10 seconds...');
    setTimeout(connectDB, 10000);
  }
};

// Initialize data plans with agent pricing
async function initializeDataPlans() {
  try {
    const existingPlans = await DataPlan.countDocuments();
    if (existingPlans === 0) {
      console.log('📊 Initializing data plans...');
      
      const dataPlans = [
        // MTN Plans - Regular and Agent Prices
        { network: 'MTN', size: '1GB', price: 4.30, agentPrice: 4.10, validity: '30 days', description: 'MTN Non-Expiry', popular: true },
        { network: 'MTN', size: '2GB', price: 8.50, agentPrice: 8.20, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '3GB', price: 12.50, agentPrice: 12.20, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '4GB', price: 16.50, agentPrice: 16.20, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '5GB', price: 20.60, agentPrice: 20.30, validity: '30 days', description: 'MTN Non-Expiry', popular: true },
        { network: 'MTN', size: '6GB', price: 24.70, agentPrice: 24.40, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '7GB', price: 28.80, agentPrice: 28.50, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '8GB', price: 33.20, agentPrice: 32.90, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '10GB', price: 39.70, agentPrice: 39.40, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '15GB', price: 58.50, agentPrice: 58.20, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '20GB', price: 77.50, agentPrice: 77.20, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '25GB', price: 97.10, agentPrice: 96.80, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '30GB', price: 117.10, agentPrice: 116.80, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '40GB', price: 155.00, agentPrice: 154.70, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '50GB', price: 186.00, agentPrice: 185.70, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '100GB', price: 364.00, agentPrice: 363.70, validity: '30 days', description: 'MTN Non-Expiry' },
        
        // Telecel Plans
        { network: 'Telecel', size: '5GB', price: 19.60, agentPrice: 19.30, validity: '30 days', description: 'Telecel Bundle', popular: true },
        { network: 'Telecel', size: '10GB', price: 37.30, agentPrice: 37.00, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '15GB', price: 53.60, agentPrice: 53.30, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '20GB', price: 70.60, agentPrice: 70.30, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '25GB', price: 88.30, agentPrice: 88.00, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '30GB', price: 107.00, agentPrice: 106.70, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '40GB', price: 141.00, agentPrice: 140.70, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '50GB', price: 176.00, agentPrice: 175.70, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '100GB', price: 348.00, agentPrice: 347.70, validity: '30 days', description: 'Telecel Bundle' },
        
        // AirtelTigo Plans
        { network: 'AirtelTigo', size: '1GB', price: 3.95, agentPrice: 3.75, validity: '30 days', description: 'AirtelTigo Bundle', popular: true },
        { network: 'AirtelTigo', size: '2GB', price: 7.70, agentPrice: 7.50, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '3GB', price: 11.70, agentPrice: 11.50, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '4GB', price: 15.50, agentPrice: 15.30, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '5GB', price: 19.50, agentPrice: 19.30, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '6GB', price: 23.70, agentPrice: 23.50, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '7GB', price: 27.50, agentPrice: 27.30, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '8GB', price: 31.10, agentPrice: 30.90, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '9GB', price: 35.00, agentPrice: 34.80, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '10GB', price: 39.00, agentPrice: 38.80, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '11GB', price: 42.50, agentPrice: 42.30, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '12GB', price: 47.00, agentPrice: 46.80, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '13GB', price: 51.00, agentPrice: 50.80, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '14GB', price: 55.00, agentPrice: 54.80, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '15GB', price: 60.00, agentPrice: 59.80, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '20GB', price: 78.00, agentPrice: 77.80, validity: '30 days', description: 'AirtelTigo Bundle' }
      ];
      
      await DataPlan.insertMany(dataPlans);
      console.log(`✅ ${dataPlans.length} data plans initialized with agent pricing`);
    }
  } catch (error) {
    console.error('❌ Error initializing data plans:', error);
  }
}

connectDB();

// Setup cron jobs for transaction cleanup
const setupCronJobs = () => {
  const TransactionCleaner = require('./services/transactionCleaner');
  const cleaner = new TransactionCleaner(Order);
  
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;

  setInterval(async () => {
    try {
      console.log('⏰ [Scheduled Task] Running 12-hour transaction cleanup...');
      await cleaner.cleanOldTransactions();
    } catch (error) {
      console.error('❌ Scheduled cleanup failed:', error);
    }
  }, TWELVE_HOURS);
  
  console.log('✅ Scheduled transaction cleanup initialized (runs every 12 hours)');
};

mongoose.connection.once('open', () => {
  setupCronJobs();
});

// Helper functions
const toDouble = (num) => {
  if (num === null || num === undefined) return 0;
  const value = typeof num === 'string' ? parseFloat(num) : Number(num);
  return Math.round(value * 100) / 100;
};

const isValidGhanaNumber = (phone) => {
  if (!phone) return false;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const ghanaRegex = /^(020|023|024|025|026|027|028|029|030|050|054|055|056|057|058|059|053)\d{7}$/;
  return ghanaRegex.test(cleanPhone);
};

function validateOrderItems(items) {
  const availableVolumes = {
    'MTN': [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100],
    'Telecel': [5, 10, 15, 20, 25, 30, 40, 50, 60, 100],
    'AirtelTigo': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20]
  };

  for (const item of items) {
    const sizeStr = item.size || '';
    const match = sizeStr.match(/(\d+)/);
    const volume = match ? parseInt(match[1], 10) : 0;
    
    if (volume === 0) {
      return { valid: false, error: `Invalid size format: ${item.size}` };
    }
    
    const network = item.network;
    const available = availableVolumes[network];
    
    if (!available) {
      return { valid: false, error: `Network not supported: ${network}` };
    }
    
    if (!available.includes(volume)) {
      return { 
        valid: false, 
        error: `${volume}GB is not available for ${network}. Available: ${available.join(', ')}GB` 
      };
    }
  }
  
  return { valid: true };
}

// ==================== MONGODB SCHEMAS ====================

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  address: { type: String },
  password: { type: String, required: true },
  role: { type: String, enum: ['client', 'admin', 'agent'], default: 'client' },
  status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'active' },
  walletBalance: { type: Number, default: 0 },
  agentCommission: { type: Number, default: 0.05 }, // 5% commission
  totalSales: { type: Number, default: 0 },
  totalCommission: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    network: { type: String, required: true },
    size: { type: String, required: true },
    price: { type: Number, required: true },
    agentPrice: { type: Number },
    recipientPhone: { type: String, required: true },
    quantity: { type: Number, default: 1 }
  }],
  totalAmount: { type: Number, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },
  paymentMethod: { type: String, enum: ['paystack', 'cash', 'mobile_money', 'wallet'], default: 'paystack' },
  paymentStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  paymentReference: { type: String },
  vendorOrderId: { type: String },
  status: { 
    type: String, 
    enum: ['placed', 'processing', 'delivered', 'failed', 'cancelled'], 
    default: 'placed' 
  },
  processingResults: [{
    itemIndex: Number,
    success: Boolean,
    transactionId: String,
    reference: String,
    message: String,
    error: String,
    status: String,
    processedAt: { type: Date, default: Date.now }
  }],
  isVisibleToUser: { type: Boolean, default: true },
  archived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const dataPlanSchema = new mongoose.Schema({
  network: { type: String, required: true },
  size: { type: String, required: true },
  price: { type: Number, required: true },
  agentPrice: { type: Number },
  validity: { type: String, required: true },
  description: { type: String },
  popular: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const walletTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'purchase', 'commission', 'admin_load'], required: true },
  description: { type: String },
  reference: { type: String, unique: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  balanceBefore: { type: Number },
  balanceAfter: { type: Number },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For admin loads
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

// Register Models
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const DataPlan = mongoose.model('DataPlan', dataPlanSchema);
const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
const Contact = mongoose.model('Contact', contactSchema);

// Configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://allen-data-hub.vercel.app';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production';

const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

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
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
};

const adminMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
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

const agentMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'agent') {
      return res.status(403).json({ error: 'Agent access required' });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your agent account is not active. Please contact admin.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// ==================== ROUTES ====================

// Health Check
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  
  res.json({ 
    status: 'OK',
    service: 'AllenDataHub API',
    timestamp: new Date().toISOString(),
    database: {
      state: states[dbState] || 'unknown',
      readyState: dbState
    },
    fosterConsole: {
      configured: !!process.env.FOSTER_CONSOLE_API_KEY,
      baseUrl: process.env.FOSTER_CONSOLE_BASE_URL || 'Not configured'
    }
  });
});

// Test MongoDB connection
app.get('/api/test-db', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    
    if (dbState === 1) {
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

// Test Foster Console setup
app.get('/api/test/foster-console-setup', authMiddleware, async (req, res) => {
  try {
    const connection = await fosterConsoleService.testConnection();
    
    res.json({
      success: true,
      message: 'Foster Console Setup Verification',
      connection,
      baseUrl: process.env.FOSTER_CONSOLE_BASE_URL,
      apiKeyConfigured: !!process.env.FOSTER_CONSOLE_API_KEY,
      webhookUrl: `${process.env.BACKEND_URL || 'https://allen-data-hub-backend.onrender.com'}/api/webhooks/foster-console`
    });
    
  } catch (error) {
    console.error('Foster Console setup test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== AUTHENTICATION ROUTES ====================

// User Registration (with agent approval system)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, phone, role = 'client', referralCode } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Validate role and set status
    const validRoles = ['client', 'agent', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Determine user status based on role
    let userStatus = 'active';
    if (role === 'agent') {
      userStatus = 'pending'; // Agents need admin approval
    } else if (role === 'admin' && !email.includes('admin')) {
      // Only allow admin registration from admin emails
      return res.status(400).json({ error: 'Admin registration requires admin email' });
    }

    const user = new User({
      username,
      email,
      phone,
      password: hashedPassword,
      role: role,
      status: userStatus,
      walletBalance: 0,
      agentCommission: role === 'agent' ? 0.05 : 0
    });

    await user.save();

    const token = jwt.sign({ 
      userId: user._id,
      role: user.role 
    }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User created successfully',
      requiresVerification: role === 'agent',
      verificationMessage: role === 'agent' ? 'Your agent account requires admin approval. You will be notified once approved.' : null,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        walletBalance: user.walletBalance
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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended. Contact admin.' });
    }

    // For agents, check if they're approved
    if (user.role === 'agent' && user.status === 'pending') {
      return res.status(403).json({ 
        error: 'Agent account pending approval. Please wait for admin verification.' 
      });
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
        walletBalance: user.walletBalance,
        agentCommission: user.agentCommission,
        totalSales: user.totalSales,
        totalCommission: user.totalCommission,
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

// ==================== DATA PLANS ROUTES ====================

// Get Data Plans (with agent pricing)
app.get('/api/plans', authMiddleware, async (req, res) => {
  try {
    const { network } = req.query;
    let query = {};
    
    if (network && network !== 'All') {
      query.network = network;
    }

    const plans = await DataPlan.find(query).sort({ price: 1 });
    
    // Return agent price if user is agent
    const plansWithPricing = plans.map(plan => {
      const planObj = plan.toObject();
      if (req.user.role === 'agent' && plan.agentPrice) {
        planObj.displayPrice = plan.agentPrice;
        planObj.isAgentPrice = true;
        planObj.regularPrice = plan.price; // Show regular price for comparison
      } else {
        planObj.displayPrice = plan.price;
        planObj.isAgentPrice = false;
      }
      return planObj;
    });

    res.json(plansWithPricing);
  } catch (error) {
    console.error('Plans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// ==================== ORDER ROUTES ====================

// Order Verification
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

    const volumeValidation = validateOrderItems(items);
    if (!volumeValidation.valid) {
      return res.status(400).json({
        valid: false,
        message: volumeValidation.error
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
      const itemPrice = req.user.role === 'agent' && item.agentPrice ? item.agentPrice : parseFloat(item.price) || 0;
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

// Create Order (with wallet payment support)
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { items, totalAmount, customerEmail, customerPhone, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Order must contain at least one item' 
      });
    }

    // Validate wallet payment
    if (paymentMethod === 'wallet') {
      if (req.user.walletBalance < totalAmount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient wallet balance. You have GH₵${req.user.walletBalance.toFixed(2)} but need GH₵${totalAmount}`
        });
      }
    }

    const preparedItems = items.map(item => {
      const price = req.user.role === 'agent' && item.agentPrice ? item.agentPrice : parseFloat(item.price) || 0;
      return {
        network: item.network,
        size: item.size,
        price: price,
        agentPrice: req.user.role === 'agent' && item.agentPrice ? item.agentPrice : undefined,
        recipientPhone: item.recipientPhone,
        quantity: parseInt(item.quantity) || 1
      };
    });

    const order = new Order({
      userId: req.userId,
      items: preparedItems,
      totalAmount: parseFloat(totalAmount) || 0,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
      paymentMethod: paymentMethod || 'paystack',
      paymentStatus: paymentMethod === 'wallet' ? 'success' : 'pending',
      status: paymentMethod === 'wallet' ? 'placed' : 'placed',
      isVisibleToUser: true,
      archived: false
    });

    await order.save();

    // Process wallet payment immediately if using wallet
    if (paymentMethod === 'wallet') {
      const user = await User.findById(req.userId);
      const balanceBefore = user.walletBalance;
      user.walletBalance -= totalAmount;
      user.totalSales = (user.totalSales || 0) + totalAmount;
      
      if (user.role === 'agent') {
        const commission = totalAmount * (user.agentCommission || 0.05);
        user.totalCommission = (user.totalCommission || 0) + commission;
        user.walletBalance += commission; // Add commission to wallet
        
        // Record commission transaction
        await WalletTransaction.create({
          userId: req.userId,
          amount: commission,
          type: 'commission',
          description: `Commission for order #${order._id}`,
          reference: `COMM-${order._id}-${Date.now()}`,
          status: 'completed',
          balanceBefore: balanceBefore - totalAmount,
          balanceAfter: user.walletBalance
        });
      }
      
      await user.save();

      // Record purchase transaction
      await WalletTransaction.create({
        userId: req.userId,
        amount: -totalAmount,
        type: 'purchase',
        description: `Purchase order #${order._id}`,
        reference: `WALLET-${order._id}-${Date.now()}`,
        status: 'completed',
        balanceBefore: balanceBefore,
        balanceAfter: user.walletBalance + totalAmount // Balance before commission
      });

      // Process with vendor immediately
      try {
        const processingResults = [];
        for (const [index, item] of order.items.entries()) {
          const itemReference = `ALLEN-${order._id}-${index}-${Date.now()}`;
          const result = await fosterConsoleService.purchaseDataBundle(
            item.recipientPhone,
            item.size,
            item.network,
            itemReference
          );
          
          processingResults.push({
            itemIndex: index,
            success: result.success,
            transactionId: result.transactionId,
            reference: result.reference,
            message: result.message,
            error: result.error,
            status: result.status || 'pending'
          });
          
          if (index < order.items.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        order.processingResults = processingResults;
        const successfulItems = processingResults.filter(r => r.success);
        order.status = successfulItems.length > 0 ? 'processing' : 'failed';
        await order.save();
        
        console.log(`✅ Wallet order ${order._id} processed successfully`);
      } catch (vendorError) {
        console.error('❌ Vendor processing error:', vendorError);
        order.status = 'failed';
        order.processingError = vendorError.message;
        await order.save();
      }
    }

    res.status(201).json({
      success: true,
      message: paymentMethod === 'wallet' ? 'Order placed successfully using wallet balance' : 'Order created successfully',
      orderId: order._id,
      order: {
        _id: order._id,
        items: order.items,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod
      }
    });

  } catch (error) {
    console.error('❌ Order creation error:', error.message);
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
    const { page = 1, limit = 10, showAll = false } = req.query;
    const skip = (page - 1) * limit;

    const query = { 
      userId: req.userId 
    };
    
    if (!showAll) {
      query.isVisibleToUser = true;
      query.archived = false;
    }

    const orders = await Order.find(query)
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

// Cancel Order
app.delete('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot cancel delivered order' });
    }

    // Refund wallet if payment was made with wallet
    if (order.paymentMethod === 'wallet' && order.paymentStatus === 'success') {
      const user = await User.findById(req.userId);
      user.walletBalance += order.totalAmount;
      await user.save();
      
      // Record refund transaction
      await WalletTransaction.create({
        userId: req.userId,
        amount: order.totalAmount,
        type: 'deposit',
        description: `Refund for cancelled order #${order._id}`,
        reference: `REFUND-${order._id}-${Date.now()}`,
        status: 'completed'
      });
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

// ==================== WALLET ROUTES ====================

// Get wallet balance
app.get('/api/wallet/balance', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('walletBalance username email role totalSales totalCommission');
    res.json({
      success: true,
      balance: user.walletBalance,
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
        totalSales: user.totalSales,
        totalCommission: user.totalCommission
      }
    });
  } catch (error) {
    console.error('Wallet balance error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch wallet balance' });
  }
});

// Deposit to wallet (Paystack)
app.post('/api/wallet/deposit', authMiddleware, async (req, res) => {
  try {
    const { amount, email } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ error: 'Payment service not configured' });
    }

    const amountInKobo = Math.round(amount * 100);
    const reference = `WALLET-${req.userId}-${Date.now()}`;

    const response = await paystack.post('/transaction/initialize', {
      email: email || req.user.email,
      amount: amountInKobo,
      reference: reference,
      callback_url: `${FRONTEND_URL}/wallet-return`,
      metadata: {
        userId: req.userId,
        type: 'wallet_deposit',
        amount: amount
      }
    });

    const { data } = response.data;

    // Create pending wallet transaction
    await WalletTransaction.create({
      userId: req.userId,
      amount: amount,
      type: 'deposit',
      description: 'Wallet deposit',
      reference: data.reference,
      status: 'pending'
    });

    res.json({
      success: true,
      paymentUrl: data.authorization_url,
      reference: data.reference,
      amount: amount
    });
  } catch (error) {
    console.error('Wallet deposit error:', error);
    res.status(500).json({ 
      error: 'Failed to initialize deposit',
      details: error.response?.data?.message || error.message 
    });
  }
});

// Verify wallet deposit
app.get('/api/wallet/verify/:reference', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await paystack.get(`/transaction/verify/${reference}`);
    const { data } = response.data;

    if (data.status === 'success') {
      // Find and update wallet transaction
      const transaction = await WalletTransaction.findOne({ reference });
      
      if (transaction && transaction.status === 'pending') {
        const user = await User.findById(req.userId);
        const balanceBefore = user.walletBalance;
        user.walletBalance += data.amount / 100;
        await user.save();

        transaction.status = 'completed';
        transaction.balanceBefore = balanceBefore;
        transaction.balanceAfter = user.walletBalance;
        await transaction.save();

        res.json({
          success: true,
          message: 'Deposit successful',
          amount: data.amount / 100,
          newBalance: user.walletBalance
        });
      } else {
        res.json({ success: true, message: 'Deposit already processed' });
      }
    } else {
      // Update transaction status to failed
      await WalletTransaction.findOneAndUpdate(
        { reference },
        { status: 'failed' }
      );
      
      res.json({ success: false, message: 'Deposit verification failed' });
    }
  } catch (error) {
    console.error('Wallet verify error:', error);
    res.status(500).json({ error: 'Failed to verify deposit' });
  }
});

// Get wallet transactions
app.get('/api/wallet/transactions', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const transactions = await WalletTransaction.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await WalletTransaction.countDocuments({ userId: req.userId });

    res.json({
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Wallet transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ==================== AGENT ROUTES ====================

// Agent dashboard stats
app.get('/api/agent/dashboard', agentMiddleware, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Agent orders
    const agentOrders = await Order.find({ 
      userId: req.userId,
      paymentStatus: 'success'
    });

    const totalOrders = agentOrders.length;
    const todayOrders = agentOrders.filter(order => order.createdAt >= today).length;
    
    const totalSales = agentOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalCommission = totalSales * req.user.agentCommission;
    
    const successfulOrders = agentOrders.filter(order => order.status === 'delivered').length;
    const successRate = totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0;

    // Today's sales
    const todaySales = agentOrders
      .filter(order => order.createdAt >= today)
      .reduce((sum, order) => sum + order.totalAmount, 0);

    res.json({
      success: true,
      stats: {
        walletBalance: req.user.walletBalance,
        totalOrders,
        todayOrders,
        totalSales: parseFloat(totalSales.toFixed(2)),
        todaySales: parseFloat(todaySales.toFixed(2)),
        totalCommission: parseFloat(totalCommission.toFixed(2)),
        successRate: parseFloat(successRate.toFixed(1)),
        agentCommission: req.user.agentCommission * 100 // Convert to percentage
      },
      recentOrders: agentOrders.slice(0, 5).map(order => ({
        id: order._id,
        items: order.items.map(item => `${item.network} ${item.size}`).join(', '),
        amount: order.totalAmount,
        status: order.status,
        date: order.createdAt
      }))
    });
  } catch (error) {
    console.error('Agent dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agent dashboard' });
  }
});

// ==================== ADMIN ROUTES ====================

// Admin dashboard stats
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
  try {
    const totalAgents = await User.countDocuments({ role: 'agent' });
    const activeAgents = await User.countDocuments({ role: 'agent', status: 'active' });
    const pendingAgents = await User.countDocuments({ role: 'agent', status: 'pending' });
    
    const agents = await User.find({ role: 'agent' });
    const totalWalletBalance = agents.reduce((sum, agent) => sum + (agent.walletBalance || 0), 0);
    
    const agentOrders = await Order.find({ 
      'userId': { $in: agents.map(a => a._id) },
      paymentStatus: 'success'
    });
    
    const totalSales = agentOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalCommission = agents.reduce((sum, agent) => sum + (agent.totalCommission || 0), 0);
    
    // Client stats
    const totalClients = await User.countDocuments({ role: 'client' });
    const clientOrders = await Order.find({ 
      'userId': { $in: await User.find({ role: 'client' }).distinct('_id') },
      paymentStatus: 'success'
    });
    const clientSales = clientOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    
    res.json({
      success: true,
      stats: {
        totalAgents,
        activeAgents,
        pendingAgents,
        totalClients,
        totalSales: parseFloat(totalSales.toFixed(2)),
        clientSales: parseFloat(clientSales.toFixed(2)),
        totalCommission: parseFloat(totalCommission.toFixed(2)),
        totalWalletBalance: parseFloat(totalWalletBalance.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch admin stats' });
  }
});

// Get all agents
app.get('/api/admin/agents', adminMiddleware, async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    
    // Calculate agent stats
    const agentsWithStats = await Promise.all(agents.map(async (agent) => {
      const orders = await Order.find({ 
        userId: agent._id,
        paymentStatus: 'success'
      });
      
      const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const totalCommission = totalSales * (agent.agentCommission || 0.05);
      
      return {
        ...agent,
        totalSales: parseFloat(totalSales.toFixed(2)),
        totalCommission: parseFloat(totalCommission.toFixed(2))
      };
    }));
    
    res.json({
      success: true,
      agents: agentsWithStats
    });
  } catch (error) {
    console.error('Agents fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

// Verify/approve agent
app.post('/api/admin/verify-agent', adminMiddleware, async (req, res) => {
  try {
    const { agentId, approve } = req.body;
    
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    
    agent.status = approve ? 'active' : 'suspended';
    agent.updatedAt = new Date();
    await agent.save();
    
    res.json({
      success: true,
      message: `Agent ${approve ? 'approved and activated' : 'suspended'} successfully`
    });
  } catch (error) {
    console.error('Verify agent error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify agent' });
  }
});

// Load agent wallet (admin)
app.post('/api/admin/load-wallet', adminMiddleware, async (req, res) => {
  try {
    const { agentId, amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    
    const balanceBefore = agent.walletBalance;
    agent.walletBalance += amount;
    await agent.save();
    
    // Record transaction
    await WalletTransaction.create({
      userId: agentId,
      amount: amount,
      type: 'admin_load',
      description: 'Admin wallet load',
      reference: `ADMIN-${Date.now()}`,
      status: 'completed',
      balanceBefore,
      balanceAfter: agent.walletBalance,
      adminId: req.userId
    });
    
    res.json({
      success: true,
      message: `Successfully loaded GH₵${amount} to agent wallet`,
      newBalance: agent.walletBalance
    });
  } catch (error) {
    console.error('Load wallet error:', error);
    res.status(500).json({ success: false, error: 'Failed to load wallet' });
  }
});

// Update agent prices
app.post('/api/admin/update-prices', adminMiddleware, async (req, res) => {
  try {
    const { network, updates } = req.body;
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid price updates' });
    }
    
    // Update agent prices in database
    for (const [planId, newPrice] of Object.entries(updates)) {
      await DataPlan.findByIdAndUpdate(planId, {
        agentPrice: newPrice,
        updatedAt: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'Agent prices updated successfully'
    });
  } catch (error) {
    console.error('Update prices error:', error);
    res.status(500).json({ success: false, error: 'Failed to update prices' });
  }
});

// ==================== DASHBOARD STATS ROUTES ====================

// Get user dashboard stats
app.get('/api/users/dashboard-stats', authMiddleware, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userOrders = await Order.find({ 
      userId: req.userId,
      isVisibleToUser: true,
      archived: false
    });

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
      }
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard stats',
      stats: {
        totalOrders: 0,
        todayOrders: 0,
        deliveredOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        totalDataGB: 0,
        totalDataMB: 0,
        totalDataFormatted: '0 GB',
        orderSuccessRate: 0
      }
    });
  }
});

// ==================== PAYMENT ROUTES ====================

// Initialize Payment
app.post('/api/payment/initialize', authMiddleware, async (req, res) => {
  try {
    const { orderId, email, amount, redirectUrl } = req.body;

    if (!orderId || !email || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ error: 'Payment service not configured' });
    }

    const validatedAmount = parseFloat(amount);
    const amountInKobo = Math.round(validatedAmount * 100);

    const reference = `ALLEN-${orderId}-${Date.now()}`;
    const callbackUrl = redirectUrl || `${FRONTEND_URL}/payment-return`;

    const response = await paystack.post('/transaction/initialize', {
      email,
      amount: amountInKobo,
      reference: reference,
      callback_url: callbackUrl,
      metadata: {
        orderId,
        userId: req.userId,
        type: 'order_payment'
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
      if (order.paymentStatus !== 'success') {
        order.paymentStatus = 'success';
        order.status = 'placed';
        order.updatedAt = new Date();
        await order.save();

        // Update user sales if agent
        if (order.userId.toString() === req.userId && req.user.role === 'agent') {
          const user = await User.findById(req.userId);
          user.totalSales = (user.totalSales || 0) + order.totalAmount;
          const commission = order.totalAmount * (user.agentCommission || 0.05);
          user.totalCommission = (user.totalCommission || 0) + commission;
          user.walletBalance += commission; // Add commission to wallet
          
          // Record commission transaction
          await WalletTransaction.create({
            userId: req.userId,
            amount: commission,
            type: 'commission',
            description: `Commission for order #${order._id}`,
            reference: `COMM-${order._id}-${Date.now()}`,
            status: 'completed',
            balanceBefore: user.walletBalance - commission,
            balanceAfter: user.walletBalance
          });
          
          await user.save();
        }

        // Process with vendor
        try {
          const processingResults = [];
          for (const [index, item] of order.items.entries()) {
            const itemReference = `ALLEN-${order._id}-${index}-${Date.now()}`;
            const result = await fosterConsoleService.purchaseDataBundle(
              item.recipientPhone,
              item.size,
              item.network,
              itemReference
            );
            
            processingResults.push({
              itemIndex: index,
              success: result.success,
              transactionId: result.transactionId,
              reference: result.reference,
              message: result.message,
              error: result.error,
              status: result.status || 'pending'
            });
            
            if (index < order.items.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          order.processingResults = processingResults;
          const successfulItems = processingResults.filter(r => r.success);
          order.status = successfulItems.length > 0 ? 'processing' : 'failed';
          await order.save();
          
        } catch (vendorError) {
          console.error('❌ Vendor processing error:', vendorError);
          order.status = 'failed';
          order.processingError = vendorError.message;
          await order.save();
        }

        res.json({
          success: true,
          message: 'Payment successful! Order processing started.',
          orderId: order._id,
          status: order.status,
          commissionAdded: req.user.role === 'agent'
        });
      } else {
        res.json({ success: true, message: 'Payment already verified' });
      }
    } else {
      order.paymentStatus = 'failed';
      order.status = 'failed';
      await order.save();
      res.json({ success: false, message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ==================== WEBHOOK ROUTES ====================

// Paystack webhook
app.post('/api/payment/webhook', async (req, res) => {
  const crypto = require('crypto');
  const secret = process.env.PAYSTACK_SECRET_KEY;
  
  if (!secret) {
    console.error('❌ Paystack secret key not configured');
    return res.sendStatus(400);
  }

  // 1. Verify Paystack Signature
  const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) {
    console.error('❌ Invalid Paystack signature');
    return res.sendStatus(400);
  }

  const { event, data } = req.body;
  const { reference, metadata } = data;
  console.log(`💰 Paystack Webhook Received: ${event}`);

  if (event === 'charge.success') {
    try {
      // CASE A: WALLET DEPOSIT
      if (metadata?.type === 'wallet_deposit') {
        const WalletTransaction = mongoose.model('WalletTransaction');
        const User = mongoose.model('User');
        
        const transaction = await WalletTransaction.findOne({ reference });
        if (transaction && transaction.status === 'pending') {
          const user = await User.findById(metadata.userId);
          if (user) {
            const balanceBefore = user.walletBalance;
            user.walletBalance += data.amount / 100;
            await user.save();

            transaction.status = 'completed';
            transaction.balanceBefore = balanceBefore;
            transaction.balanceAfter = user.walletBalance;
            await transaction.save();
            
            console.log(`✅ Wallet deposit completed for user ${user.email}`);
          }
        }
      }

      // CASE B: DIRECT ORDER PAYMENT (Calls Vendor API)
      else if (metadata?.type === 'order_payment' || metadata?.orderId) {
        const orderId = metadata.orderId;
        const Order = mongoose.model('Order');
        const order = await Order.findById(orderId);

        if (order && order.paymentStatus !== 'success') {
          console.log(`✅ Order ${orderId} confirmed paid. Triggering fulfillment...`);
          
          order.paymentStatus = 'success';
          order.status = 'processing';
          order.updatedAt = new Date();
          await order.save();

          // LOOP THROUGH ITEMS AND SEND DATA VIA FOSTER SERVICE
          for (const item of order.items) {
            console.log(`📡 Sending ${item.size} to ${item.recipientPhone} (${item.network})...`);
            
            const result = await fosterConsoleService.purchaseDataBundle(
              item.recipientPhone,
              item.size,
              item.network,
              order._id.toString()
            );

            console.log(`🔄 Vendor Response for ${item.recipientPhone}:`, result.success ? '✅ SUCCESS' : '❌ FAILED');
          }

         order.status = 'delivered';
          await order.save();
          console.log(`🏁 Order ${orderId} fully processed.`);
        }
      }
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      // We still send 200 to Paystack so they stop retrying, even if our internal logic fails
    }
  }
  
  res.status(200).send('OK');
});
// Foster Console webhook
app.post('/api/webhooks/foster-console', async (req, res) => {
  console.log('🔔 Foster Console Webhook Received:', JSON.stringify(req.body, null, 2));
  
  try {
    const processed = fosterConsoleService.processWebhookPayload(req.body);
    
    if (processed.success) {
      const { orderId, reference, status } = processed;
      
      // Find order by reference or transaction ID
      const order = await Order.findOne({
        $or: [
          { 'processingResults.transactionId': orderId },
          { 'processingResults.reference': reference },
          { paymentReference: reference },
          { _id: orderId }
        ]
      });
      
      if (order) {
        // Update order status
        order.status = status;
        order.updatedAt = new Date();
        
        // Update processing results
        if (order.processingResults && order.processingResults.length > 0) {
          order.processingResults = order.processingResults.map(result => {
            if (result.transactionId === orderId || result.reference === reference) {
              return {
                ...result,
                status: status,
                lastUpdated: new Date()
              };
            }
            return result;
          });
        }
        
        await order.save();
        console.log(`✅ Order ${order._id} status updated to ${status} via Foster Console webhook`);
      } else {
        console.log(`⚠️ Order not found for reference: ${reference}`);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing Foster Console webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ==================== CONTACT ROUTES ====================

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

// ==================== ERROR HANDLERS ====================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path, method: req.method });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`\n🚀 AllenDataHub Backend Server Started!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💳 Paystack: ${PAYSTACK_SECRET_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`🔐 JWT: ${JWT_SECRET ? 'Configured' : 'Using default'}`);
  console.log(`🔗 MongoDB URI: ${process.env.MONGODB_URI ? 'Set' : 'NOT SET - Check .env file'}`);
  console.log(`📊 Database Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
  console.log(`🔄 Foster Console API: ${process.env.FOSTER_CONSOLE_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`👑 Agent System: ENABLED`);
  console.log(`👑 Admin Dashboard: ENABLED`);
  console.log(`💰 Wallet System: ENABLED`);
  
  setTimeout(() => {
    if (mongoose.connection.readyState === 1) {
      initializeDataPlans();
    }
  }, 2000);
});