import axios from 'axios';

const BUILD_TIMESTAMP = "20260122-PAYMENT-FLOW-UPDATE";
const API_BASE_URL = process.env.REACT_APP_API_URL 
  ? `${process.env.REACT_APP_API_URL}/api`
  : 'http://localhost:5000/api';

console.log('🔧 API Configuration:', {
  baseURL: API_BASE_URL,
  envVariable: process.env.REACT_APP_API_URL,
  isProduction: process.env.NODE_ENV === 'production',
  timestamp: BUILD_TIMESTAMP
});

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

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
};

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

export const adminAPI = {
  getAllOrders: () => api.get('/admin/orders'),
  getStats: () => api.get('/admin/stats'),
  getUserStats: (userId) => api.get(`/admin/users/${userId}/stats`),
  updateOrderStatus: (orderId, status) => 
    api.patch(`/admin/orders/${orderId}/status`, { status }),
};

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
  
  getDashboardStats: () => api.get('/users/dashboard-stats'),
};

export const networksAPI = {
  mtn: {
    testConnection: () => api.get('/mtn/test'),
    transferData: (data) => {
      console.log('📱 MTN Data Transfer:', data);
      return api.post('/mtn/transfer', data);
    },
    checkBalance: () => api.get('/mtn/balance'),
  },
  
  telecel: {
    testConnection: () => api.get('/telecel/test'),
    transferData: (data) => api.post('/telecel/transfer', data),
  },
  
  airteltigo: {
    testConnection: () => api.get('/airteltigo/test'),
    transferData: (data) => api.post('/airteltigo/transfer', data),
  },
};

export const toDouble = (num) => {
  if (num === null || num === undefined) return 0;
  const parsed = typeof num === 'string' ? parseFloat(num) : Number(num);
  return Math.round(parsed * 100) / 100;
};

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
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const ghanaRegex = /^(020|023|024|025|026|027|028|029|030|050|054|055|056|057|058|059|053)\d{7}$/;
  return ghanaRegex.test(cleanPhone);
};

export default api;