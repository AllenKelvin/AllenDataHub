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

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret';

// ==================== VENDOR SERVICE: FOSTER CONSOLE ====================

class FosterService {
  constructor() {
    this.apiKey = process.env.FOSTER_API_KEY || 'a57a2c2bbc8ed0f7c526d316f3a5c8b4580f0d73';
    this.baseURL = 'https://fgamall.researchershubgh.com/api/v1';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': this.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    this.networkIds = { 'AirtelTigo': 1, 'Telecel': 2, 'MTN': 3 };
  }

 // ✅ RETRY LOGIC: Automatically retries 3 times on failure
  async purchaseData(phoneNumber, bundleSize, network, reference, retries = 3) {
    try {
      const volumeMatch = bundleSize.match(/(\d+(\.\d+)?)/);
      let volume = volumeMatch ? parseFloat(volumeMatch[1]) : 0;
      if (bundleSize.toUpperCase().includes('GB')) volume = volume * 1000;

      const networkId = this.networkIds[network];
      const endpoint = network === 'AirtelTigo' ? '/buy-ishare-package' : '/buy-other-package';
      
      const payload = {
        recipient_msisdn: this.formatPhone(phoneNumber),
        shared_bundle: volume,
        order_reference: reference
      };
      if (network !== 'AirtelTigo') payload.network_id = networkId;

      console.log(`🚀 Foster Request (${network}) [Attempt ${4 - retries}]:`, payload);
      const response = await this.client.post(endpoint, payload);
      
      return {
        success: response.data.success || response.data.response_code === "200",
        message: response.data.message || response.data.response_msg
      };
    } catch (error) {
      if (retries > 0) {
        console.log(`⚠️ Failed. Retrying in 2 seconds... (${retries} left)`);
        await new Promise(res => setTimeout(res, 2000));
        return this.purchaseData(phoneNumber, bundleSize, network, reference, retries - 1);
      }
      console.error('❌ Foster API Fatal Error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  formatPhone(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('233')) return cleaned;
    if (cleaned.startsWith('0')) return '233' + cleaned.substring(1);
    return cleaned;
  }
}

const foster = new FosterService();

// ==================== MIDDLEWARE & DATABASE ====================

app.use(cors({
  origin: ['https://allendatahub.com', 'https://allen-data-hub.vercel.app'],
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`🌐 ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ MongoDB Connected'));

// ==================== MODELS ====================

const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  role: { type: String, default: 'client' },
  createdAt: { type: Date, default: Date.now }
}));

const Order = mongoose.model('Order', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{ network: String, size: String, price: Number, recipientPhone: String, quantity: { type: Number, default: 1 } }],
  totalAmount: Number,
  customerEmail: String,
  paymentStatus: { type: String, default: 'pending' },
  status: { type: String, default: 'placed' }, // Blue Clock Icon
  createdAt: { type: Date, default: Date.now }
}));

const DataPlan = mongoose.model('DataPlan', new mongoose.Schema({
  network: String, size: String, price: Number, validity: String, description: String, popular: Boolean
}));

// ==================== AUTH & ROUTES ====================

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) { res.status(401).json({ error: 'Auth failed' }); }
};

app.post('/api/users/signup', async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword, phone });
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.status(201).json({ token, user: { username, email } });
  } catch (err) { res.status(400).json({ error: 'Signup failed' }); }
});

app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid' });
  const token = jwt.sign({ userId: user._id }, JWT_SECRET);
  res.json({ token, user: { username: user.username, email: user.email } });
});

app.get('/api/plans', async (req, res) => res.json(await DataPlan.find()));

app.post('/api/orders', auth, async (req, res) => {
  const order = new Order({ ...req.body, userId: req.userId, status: 'placed' });
  await order.save();
  res.status(201).json(order);
});

app.get('/api/orders/my-orders', auth, async (req, res) => {
  const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json({ orders });
});

app.get('/api/users/dashboard-stats', auth, async (req, res) => {
  const total = await Order.countDocuments({ userId: req.userId });
  const success = await Order.countDocuments({ userId: req.userId, paymentStatus: 'success' });
  res.json({ stats: { totalOrders: total, successfulOrders: success } });
});

// ==================== PAYSTACK WEBHOOK ====================

app.post('/api/payment/webhook', async (req, res) => {
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) return res.sendStatus(400);

  if (req.body.event === 'charge.success') {
    const order = await Order.findById(req.body.data.metadata?.orderId);
    if (order && order.paymentStatus !== 'success') {
      order.paymentStatus = 'success';
      order.status = 'processing'; // Spinning Gear Icon
      await order.save();

      for (const item of order.items) {
        await foster.purchaseData(item.recipientPhone, item.size, item.network, order._id.toString());
      }
      order.status = 'completed'; // Green Checkmark
      await order.save();
    }
  }
  res.status(200).send('OK');
});

// ==================== INITIALIZE DATA PLANS ====================

async function initializeDataPlans() {
  if (await DataPlan.countDocuments() === 0) {
    const dataPlans = [
        // MTN Plans
        { network: 'MTN', size: '1GB', price: 4.00, validity: '30 days', description: 'MTN Non-Expiry', popular: true },
        { network: 'MTN', size: '2GB', price: 8.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '3GB', price: 11.90, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '4GB', price: 16.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '5GB', price: 20.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '6GB', price: 24.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '8GB', price: 31.80, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '10GB', price: 38.60, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '15GB', price: 58.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '20GB', price: 77.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '25GB', price: 97.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '30GB', price: 117.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '40GB', price: 154.00, validity: '30 days', description: 'MTN Non-Expiry' },
        { network: 'MTN', size: '50GB', price: 188.10, validity: '30 days', description: 'MTN Non-Expiry' },
        // Telecel Plans
        { network: 'Telecel', size: '2GB', price: 8.30, validity: '30 days', description: 'Telecel Bundle', popular: true },
        { network: 'Telecel', size: '3GB', price: 12.40, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '5GB', price: 18.60, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '10GB', price: 37.00, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '15GB', price: 53.00, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '20GB', price: 70.10, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '25GB', price: 87.00, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '30GB', price: 104.00, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '40GB', price: 138.00, validity: '30 days', description: 'Telecel Bundle' },
        { network: 'Telecel', size: '50GB', price: 172.00, validity: '30 days', description: 'Telecel Bundle' },
        // AirtelTigo Plans
        { network: 'AirtelTigo', size: '15GB', price: 43.00, validity: '30 days', description: 'AirtelTigo Bundle', popular: true },
        { network: 'AirtelTigo', size: '20GB', price: 51.00, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '25GB', price: 56.00, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '40GB', price: 73.00, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '50GB', price: 82.00, validity: '30 days', description: 'AirtelTigo Bundle' },
        { network: 'AirtelTigo', size: '60GB', price: 99.00, validity: '30 days', description: 'AirtelTigo Bundle' }
    ];
    await DataPlan.insertMany(dataPlans);
    console.log(`✅ Data plans seeded`);
  }
}

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`\n🚀 AllenDataHub Backend Server Started!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💳 Paystack: ${PAYSTACK_SECRET_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`🔐 JWT: ${JWT_SECRET ? 'Configured' : 'Using default'}`);
  console.log(`🔗 MongoDB URI: ${process.env.MONGODB_URI ? 'Set' : 'NOT SET - Check .env file'}`);
  console.log(`📊 Database Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
  console.log(`🔄 Vendor: Foster Console`);
  console.log(`🔑 Foster API Key: ${foster.apiKey ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`📦 Foster Base URL: ${foster.baseURL}`);
  console.log(`🔔 Webhook URL: https://allen-data-hub-backend.onrender.com/api/payment/webhook`);
  
  setTimeout(() => {
    if (mongoose.connection.readyState === 1) {
      initializeDataPlans();
    }
  }, 2000);
});