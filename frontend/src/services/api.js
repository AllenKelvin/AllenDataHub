import axios from 'axios';

const BUILD_TIMESTAMP = "20260122-PAYMENT-FLOW-UPDATE";
// CRITICAL FIX: Use environment variable for production
const API_BASE_URL = process.env.REACT_APP_API_URL 
  ? `${process.env.REACT_APP_API_URL}/api`
  : 'http://localhost:5000/api';

console.log('🔧 API Configuration:', {
  baseURL: API_BASE_URL,
  envVariable: process.env.REACT_APP_API_URL,
  isProduction: process.env.NODE_ENV === 'production',
  timestamp: BUILD_TIMESTAMP
});

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('🔐 API Request to:', config.url, 'Token:', !!token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Success:', response.config.url, response.status);
    return response;
  },
  (error) => {
    const errorDetails = {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      data: error.response?.data
    };
    
    console.error('❌ API Error:', errorDetails);
    
    // Handle network errors
    if (error.message === 'Network Error') {
      console.error('🌐 Network Error - Check:');
      console.error('1. Is backend running?', API_BASE_URL);
      console.error('2. CORS configured?');
      console.error('3. Internet connection?');
    }
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      console.warn('⚠️ Session expired, redirecting to login...');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// API Endpoints
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
};

export const plansAPI = {
  getAll: () => api.get('/plans'),
  getByNetwork: (network) => api.get(`/plans/network/${network}`),
};

export const ordersAPI = {
  // Order Verification (Step 1 in checkout)
  verify: (orderData) => {
    console.log('✅ Verifying order with backend:', orderData);
    return api.post('/orders/verify', orderData);
  },
  
  // Create Order (Step 2 in checkout)
  create: (orderData) => {
    console.log('🛒 Creating order:', orderData);
    return api.post('/orders', orderData);
  },
  
  // Get user's orders
  getMyOrders: () => {
    console.log('📋 Fetching user orders');
    return api.get('/orders/my-orders');
  },
  
  // Get single order
  getOrder: (id) => api.get(`/orders/${id}`),
  
  // Get order by TRX code
  getOrderByTrx: (trxCode) => api.get(`/orders/trx/${trxCode}`),
  
  // Cancel order
  cancel: (id) => api.delete(`/orders/${id}`),
  
  // Get recent transactions for dashboard
  getRecentTransactions: (limit = 10) => 
    api.get(`/orders/recent?limit=${limit}`),
};

export const paymentAPI = {
  // Initialize payment with Paystack (opens in new window)
  initialize: (paymentData) => {
    console.log('💰 Initializing payment:', paymentData);
    return api.post('/payment/initialize', paymentData);
  },
  
  // Verify payment status (polling from frontend)
  verify: (reference) => {
    console.log('🔍 Verifying payment status for reference:', reference);
    return api.get(`/payment/verify/${reference}`);
  },
  
  // Check payment status without auth (for webhook/callback)
  checkStatus: (reference) => {
    console.log('📊 Checking payment status:', reference);
    return api.get(`/payment/status/${reference}`);
  }
};

export const adminAPI = {
  getAllOrders: () => api.get('/admin/orders'),
  getStats: () => api.get('/admin/stats'),
  getUserStats: (userId) => api.get(`/admin/users/${userId}/stats`),
  updateOrderStatus: (orderId, status) => 
    api.patch(`/admin/orders/${orderId}/status`, { status }),
};

export const userAPI = {
  // Get user profile
  getProfile: () => {
    console.log('👤 Fetching user profile');
    return api.get('/users/profile');
  },
  
  // Update user profile
  updateProfile: (data) => {
    console.log('✏️ Updating user profile:', data);
    return api.put('/users/profile', data);
  },
  
  // Change password
  changePassword: (data) => api.post('/users/change-password', data),
  
  // Contact support
  contactSupport: (data) => {
    console.log('📞 Contacting support:', data);
    return api.post('/users/contact', data);
  },
  
  // Get user transaction history
  getTransactionHistory: (page = 1, limit = 10) => 
    api.get(`/users/transactions?page=${page}&limit=${limit}`),
  
  // Get user dashboard stats
  getDashboardStats: () => api.get('/users/dashboard-stats'),
};

export const networksAPI = {
  // MTN API
  mtn: {
    testConnection: () => api.get('/mtn/test'),
    transferData: (data) => {
      console.log('📱 MTN Data Transfer:', data);
      return api.post('/mtn/transfer', data);
    },
    checkBalance: () => api.get('/mtn/balance'),
  },
  
  // Telecel API
  telecel: {
    testConnection: () => api.get('/telecel/test'),
    transferData: (data) => api.post('/telecel/transfer', data),
  },
  
  // AirtelTigo API
  airteltigo: {
    testConnection: () => api.get('/airteltigo/test'),
    transferData: (data) => api.post('/airteltigo/transfer', data),
  },
};

// Helper function for Double precision handling
export const toDouble = (num) => {
  if (num === null || num === undefined) return 0;
  // Convert to number and ensure 2 decimal places
  const parsed = typeof num === 'string' ? parseFloat(num) : Number(num);
  return Math.round(parsed * 100) / 100; // Keep 2 decimal places
};

// Test functions
export const testConnection = async () => {
  try {
    console.log('🧪 Testing API connection to:', API_BASE_URL);
    const response = await api.get('/health');
    console.log('✅ API Connection Test:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ API Connection Test Failed:', error.message);
    return { 
      success: false, 
      error: error.message,
      url: API_BASE_URL 
    };
  }
};

// Helper function to generate TRX code
export const generateTRXCode = (orderId) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `TRX${timestamp}${randomStr}`.slice(0, 12);
};

// Helper function to format Ghana phone numbers
export const formatGhanaPhone = (phone) => {
  if (!phone) return '';
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If starts with 0, convert to +233
  if (digits.startsWith('0') && digits.length === 10) {
    return `+233${digits.slice(1)}`;
  }
  
  // If already has country code
  if (digits.startsWith('233') && digits.length === 12) {
    return `+${digits}`;
  }
  
  // Return as is with + if needed
  return digits.startsWith('+') ? phone : `+${digits}`;
};

// Helper function to validate Ghana phone number
export const isValidGhanaNumber = (phone) => {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const ghanaRegex = /^(020|023|024|025|026|027|028|029|030|050|054|055|056|057|058|059|053)\d{7}$/;
  return ghanaRegex.test(cleanPhone);
};

export default api;