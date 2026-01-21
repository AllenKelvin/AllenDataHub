const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
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

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected Successfully');
  } catch (err) {
    console.log('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️ Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

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

const orderSchema = new mongoose.Schema({
  trxCode: { type: String, required: true }, // Removed unique constraint
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    planId: { type: String, required: true },
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

// Generate unique TRX code using UUID
const generateTRXCode = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const uniqueId = uuidv4().split('-')[0].toUpperCase();
  return `TRX-${dateStr}-${uniqueId}`;
};

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
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database temporarily unavailable' });
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
    
    if (mongoose.connection.readyState !== 1) {
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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    service: 'AllenDataHub API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
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

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
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

    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB not connected, returning fallback plans');
      return getFallbackPlans(network, res);
    }

    const plans = await DataPlan.find(query).sort({ price: 1 });
    
    if (plans.length === 0) {
      const defaultPlans = [
        { network: 'MTN', size: '1GB', price: 4.60, validity: '30 days', description: 'MTN Non Expiry', popular: true },
        { network: 'MTN', size: '2GB', price: 8.30, validity: '30 days', description: 'MTN Non Expiry' },
        { network: 'MTN', size: '3GB', price: 12.45, validity: '30 days', description: 'MTN Non Expiry' },
        { network: 'MTN', size: '5GB', price: 20.75, validity: '30 days', description: 'MTN Non Expiry' },
        { network: 'MTN', size: '10GB', price: 41.50, validity: '30 days', description: 'MTN Non Expiry' },
        { network: 'Telecel', size: '2GB', price: 7.18, validity: '30 days', description: 'Telecel', popular: true },
        { network: 'Telecel', size: '5GB', price: 17.95, validity: '30 days', description: 'Telecel' },
        { network: 'Telecel', size: '10GB', price: 35.90, validity: '30 days', description: 'Telecel' },
        { network: 'Telecel', size: '15GB', price: 52.90, validity: '30 days', description: 'Telecel' },
        { network: 'AirtelTigo', size: '1GB', price: 5.00, validity: '7 days', description: 'AirtelTigo 7-Day Bundle', popular: true },
        { network: 'AirtelTigo', size: '2GB', price: 9.50, validity: '7 days', description: 'AirtelTigo 7-Day Bundle' },
        { network: 'AirtelTigo', size: '3GB', price: 12.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
        { network: 'AirtelTigo', size: '5GB', price: 18.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
        { network: 'AirtelTigo', size: '6GB', price: 22.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
        { network: 'AirtelTigo', size: '10GB', price: 35.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
        { network: 'AirtelTigo', size: '15GB', price: 50.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' }
      ];
      
      await DataPlan.insertMany(defaultPlans);
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
    { _id: 'mtn1', network: 'MTN', size: '1GB', price: 4.15, validity: '30 days', description: 'MTN Non Expiry', popular: true },
    { _id: 'mtn2', network: 'MTN', size: '2GB', price: 8.30, validity: '30 days', description: 'MTN Non Expiry' },
    { _id: 'mtn3', network: 'MTN', size: '3GB', price: 12.45, validity: '30 days', description: 'MTN Non Expiry' },
    { _id: 'mtn4', network: 'MTN', size: '5GB', price: 20.75, validity: '30 days', description: 'MTN Non Expiry' },
    { _id: 'mtn5', network: 'MTN', size: '10GB', price: 41.50, validity: '30 days', description: 'MTN Non Expiry' },
    { _id: 'telecel1', network: 'Telecel', size: '2GB', price: 7.18, validity: '30 days', description: 'Telecel', popular: true },
    { _id: 'telecel2', network: 'Telecel', size: '5GB', price: 17.95, validity: '30 days', description: 'Telecel' },
    { _id: 'telecel3', network: 'Telecel', size: '10GB', price: 35.90, validity: '30 days', description: 'Telecel' },
    { _id: 'telecel4', network: 'Telecel', size: '15GB', price: 52.90, validity: '30 days', description: 'Telecel' },
    { _id: 'airteltigo1', network: 'AirtelTigo', size: '1GB', price: 5.00, validity: '7 days', description: 'AirtelTigo 7-Day Bundle', popular: true },
    { _id: 'airteltigo2', network: 'AirtelTigo', size: '2GB', price: 9.50, validity: '7 days', description: 'AirtelTigo 7-Day Bundle' },
    { _id: 'airteltigo3', network: 'AirtelTigo', size: '3GB', price: 12.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
    { _id: 'airteltigo4', network: 'AirtelTigo', size: '5GB', price: 18.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
    { _id: 'airteltigo5', network: 'AirtelTigo', size: '6GB', price: 22.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
    { _id: 'airteltigo6', network: 'AirtelTigo', size: '10GB', price: 35.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
    { _id: 'airteltigo7', network: 'AirtelTigo', size: '15GB', price: 50.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' }
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
    
    if (mongoose.connection.readyState !== 1) {
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
      verificationId: `VERIFY-${uuidv4()}`,
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

// FIXED: Create Order - No duplicate TRX code issues
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

    if (mongoose.connection.readyState !== 1) {
      console.log('❌ Database not connected');
      return res.status(503).json({ 
        success: false,
        error: 'Database temporarily unavailable. Please try again.' 
      });
    }

    const trxCode = generateTRXCode();
    console.log('🆕 Generated TRX Code:', trxCode);

    const preparedItems = items.map(item => ({
      planId: item.planId || 'default-plan-id',
      network: item.network,
      size: item.size,
      price: parseFloat(item.price) || 0,
      recipientPhone: item.recipientPhone,
      quantity: parseInt(item.quantity) || 1
    }));

    console.log('💾 Prepared items:', preparedItems);

    const order = new Order({
      trxCode,
      userId: req.userId,
      items: preparedItems,
      totalAmount: parseFloat(totalAmount) || 0,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
      paymentMethod: paymentMethod || 'paystack',
      paymentStatus: 'pending',
      status: 'placed'
    });

    await order.save();
    console.log('✅ Order saved successfully. ID:', order._id, 'TRX:', order.trxCode);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      orderId: order._id,
      trxCode: order.trxCode,
      order: {
        _id: order._id,
        trxCode: order.trxCode,
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

    const orders = await Order.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalOrders = await Order.countDocuments({ userId: req.userId });

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
    
    const orders = await Order.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const recentTransactions = orders.map(order => ({
      id: order.trxCode,
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

// Get Order by TRX Code
app.get('/api/orders/trx/:trxCode', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      trxCode: req.params.trxCode,
      userId: req.userId 
    }).lean();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Order fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
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
    const userId = req.userId;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userOrders = await Order.find({ userId: new mongoose.Types.ObjectId(userId) })
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
      id: order.trxCode,
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

    const orders = await Order.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalOrders = await Order.countDocuments({ userId: req.userId });

    const transactions = orders.map(order => ({
      trxCode: order.trxCode,
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

// Initialize Payment (Paystack)
app.post('/api/payment/initialize', authMiddleware, async (req, res) => {
  try {
    const { orderId, email, amount } = req.body;
    console.log('💰 Payment initialization request:', { orderId, email, amount });

    if (!orderId || !email || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ error: 'Payment service not configured' });
    }

    const validatedAmount = parseFloat(amount);
    const amountInKobo = Math.round(validatedAmount * 100);

    const reference = `ALLEN-${orderId}-${uuidv4().split('-')[0]}`;

    const response = await paystack.post('/transaction/initialize', {
      email,
      amount: amountInKobo,
      reference: reference,
      callback_url: `${FRONTEND_URL}/payment-success`,
      metadata: {
        orderId,
        userId: req.userId,
        trxAmount: validatedAmount
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

      console.log(`✅ Payment successful for order ${order.trxCode}`);

      res.json({
        success: true,
        message: 'Payment verified successfully',
        order: order,
        trxCode: order.trxCode,
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
  console.log(`📊 Database Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
  console.log(`🔑 TRX Generation: Using UUID for guaranteed unique transaction codes`);
});