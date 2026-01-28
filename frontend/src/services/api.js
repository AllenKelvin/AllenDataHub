import axios from 'axios';

const BUILD_TIMESTAMP = "20260122-PAYMENT-FLOW-UPDATE";
const API_BASE_URL = process.env.REACT_APP_API_URL 
  ? `${process.env.REACT_APP_API_URL}/api`
  : 'https://allen-data-hub-backend.onrender.com/api';

console.log('🔧 API Configuration:', {
  baseURL: API_BASE_URL,
  envVariable: process.env.REACT_APP_API_URL,
  isProduction: process.env.NODE_ENV === 'production',
  timestamp: BUILD_TIMESTAMP
});

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Helper function to get auth headers
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('🔐 API Request:', config.method?.toUpperCase(), config.url);
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
    console.log('✅ API Success:', response.status, response.config.url);
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
    
    if (error.message === 'Network Error') {
      console.error('🌐 Network Error - Check:');
      console.error('1. Is backend running?', API_BASE_URL);
      console.error('2. CORS configured?');
      console.error('3. Internet connection?');
    }
    
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

// ==================== AUTHENTICATION API ====================
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
};

// ==================== PLANS API ====================
export const plansAPI = {
  getAll: () => api.get('/plans'),
  getByNetwork: (network) => api.get(`/plans/network/${network}`),
};

// ==================== ORDERS API ====================
export const ordersAPI = {
  verify: (orderData) => {
    console.log('✅ Verifying order with backend:', orderData);
    return api.post('/orders/verify', orderData);
  },
  
  create: (orderData) => {
    console.log('🛒 Creating order:', orderData);
    return api.post('/orders', orderData);
  },
  
  getMyOrders: (params) => {
    console.log('📋 Fetching user orders');
    return api.get('/orders/my-orders', { params });
  },
  
  getOrder: (id) => api.get(`/orders/${id}`),
  
  cancel: (id) => api.delete(`/orders/${id}`),
  
  getRecentTransactions: (limit = 10) => 
    api.get(`/orders/recent?limit=${limit}`),
  
  deliver: (id) => api.post(`/orders/${id}/deliver`),
  
  getPortal02Status: (id) => api.get(`/orders/${id}/portal02-status`),
};

// ==================== PAYMENT API ====================
export const paymentAPI = {
  initialize: (paymentData) => {
    console.log('💰 Initializing payment:', paymentData);
    return api.post('/payment/initialize', paymentData);
  },
  
  verify: (reference) => {
    console.log('🔍 Verifying payment status for reference:', reference);
    return api.get(`/payment/verify/${reference}`);
  },
  
  checkStatus: (reference) => {
    console.log('📊 Checking payment status:', reference);
    return api.get(`/payment/status/${reference}`);
  }
};

// ==================== WALLET API ====================
export const walletAPI = {
  getBalance: () => api.get('/wallet/balance'),
  
  deposit: (data) => {
    console.log('💰 Initializing wallet deposit:', data);
    return api.post('/wallet/deposit', data);
  },
  
  verifyDeposit: (reference) => {
    console.log('🔍 Verifying wallet deposit:', reference);
    return api.get(`/wallet/verify/${reference}`);
  },
  
  getTransactions: (params) => {
    console.log('📋 Fetching wallet transactions');
    return api.get('/wallet/transactions', { params });
  }
};

// ==================== USER API ====================
export const userAPI = {
  getProfile: () => {
    console.log('👤 Fetching user profile');
    return api.get('/users/profile');
  },
  
  updateProfile: (data) => {
    console.log('✏️ Updating user profile:', data);
    return api.put('/users/profile', data);
  },
  
  changePassword: (data) => api.post('/users/change-password', data),
  
  contactSupport: (data) => {
    console.log('📞 Contacting support:', data);
    return api.post('/users/contact', data);
  },
  
  getTransactionHistory: (page = 1, limit = 10) => 
    api.get(`/users/transactions?page=${page}&limit=${limit}`),
  
  getDashboardStats: () => {
    console.log('📊 Fetching dashboard stats');
    return api.get('/users/dashboard-stats');
  },
  
  getAgentDashboard: () => {
    console.log('👑 Fetching agent dashboard');
    return api.get('/agent/dashboard');
  }
};

// ==================== AGENT API ====================
export const agentAPI = {
  getDashboard: () => {
    console.log('👑 Fetching agent dashboard');
    return api.get('/agent/dashboard');
  }
};

// ==================== ADMIN API ====================
export const adminAPI = {
  getStats: () => {
    console.log('📊 Fetching admin stats');
    return api.get('/admin/stats');
  },
  
  getAgents: () => {
    console.log('👥 Fetching agents list');
    return api.get('/admin/users');
  },
  
  getPendingVerifications: () => {
    console.log('📋 Fetching pending verifications');
    return api.get('/admin/verifications');
  },
  
  updateAgentStatus: (agentId, status) => {
    console.log(`✅ Updating agent status:`, { agentId, status });
    return api.patch(`/admin/users/${agentId}/status`, { status });
  },
  
  updateDataPlan: (network, data) => {
    console.log('⚙️ Updating data plan:', { network, data });
    return api.put(`/admin/plans/${network}`, data);
  },
  
  getAllOrders: (params) => {
    console.log('📋 Fetching all orders (admin)');
    return api.get('/admin/orders', { params });
  },
  
  getUserStats: (userId) => api.get(`/admin/users/${userId}/stats`),
  
  updateOrderStatus: (orderId, status) => 
    api.patch(`/admin/orders/${orderId}/status`, { status }),
};

// ==================== TESTING UTILITIES ====================
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

// ==================== HELPER FUNCTIONS ====================
export const toDouble = (num) => {
  if (num === null || num === undefined) return 0;
  const parsed = typeof num === 'string' ? parseFloat(num) : Number(num);
  return Math.round(parsed * 100) / 100;
};

export const formatGhanaPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('0') && digits.length === 10) {
    return `+233${digits.slice(1)}`;
  }
  
  if (digits.startsWith('233') && digits.length === 12) {
    return `+${digits}`;
  }
  
  return digits.startsWith('+') ? phone : `+${digits}`;
};

export const isValidGhanaNumber = (phone) => {
  if (!phone) return false;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const ghanaRegex = /^(020|023|024|025|026|027|028|029|030|050|054|055|056|057|058|059|053)\d{7}$/;
  return ghanaRegex.test(cleanPhone);
};

export const formatCurrency = (amount) => {
  return `GH₵${toDouble(amount).toFixed(2)}`;
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const generateOrderReference = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `ALLEN-${timestamp}-${random}`;
};

export const calculateServiceFee = (subtotal) => {
  const fee = 0.50; // Fixed service fee of GH₵0.50
  return toDouble(subtotal + fee);
};

export const getStatusColor = (status) => {
  const statusMap = {
    'delivered': '#52c41a',
    'success': '#52c41a',
    'processing': '#faad14',
    'pending': '#faad14',
    'placed': '#1890ff',
    'active': '#1890ff',
    'failed': '#ff4d4f',
    'cancelled': '#ff4d4f',
    'rejected': '#ff4d4f'
  };
  return statusMap[status?.toLowerCase()] || '#666';
};

export const getPaymentStatusColor = (status) => {
  const statusMap = {
    'success': '#52c41a',
    'paid': '#52c41a',
    'pending': '#faad14',
    'processing': '#faad14',
    'failed': '#ff4d4f',
    'refunded': '#666'
  };
  return statusMap[status?.toLowerCase()] || '#666';
};

export const getUserInitials = (name) => {
  if (!name) return '👤';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const isAgent = (user) => {
  return user?.role === 'agent' && user?.status === 'active';
};

export const isAdmin = (user) => {
  return user?.role === 'admin';
};

export const isClient = (user) => {
  return user?.role === 'client';
};

export const hasAccessToAgentFeatures = (user) => {
  return user?.role === 'agent' && user?.status === 'active';
};

export default api;