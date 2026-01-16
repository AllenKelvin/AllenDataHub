const BUILD_TIMESTAMP = "20260116-192449-FIX";

// ADD THIS EXACT LINE at the very top of api.js:
const BUILD_TIMESTAMP = '2024-01-16-1545-FIX';

import axios from 'axios';

// CRITICAL FIX: Use environment variable for production
const API_BASE_URL = process.env.REACT_APP_API_URL 
  ? `${process.env.REACT_APP_API_URL}/api`
  : 'http://localhost:5000/api';

console.log('🔧 API Configuration:', {
  baseURL: API_BASE_URL,
  envVariable: process.env.REACT_APP_API_URL,
  isProduction: process.env.NODE_ENV === 'production'
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
};

export const plansAPI = {
  getAll: () => api.get('/plans'),
};

export const ordersAPI = {
  create: (orderData) => {
    console.log('🛒 Creating order:', orderData);
    return api.post('/orders', orderData);
  },
  getMyOrders: () => api.get('/orders'),
  getOrder: (id) => api.get(`/orders/${id}`),
};

export const adminAPI = {
  getAllOrders: () => api.get('/admin/orders'),
  getStats: () => api.get('/admin/stats'),
};

export const paymentAPI = {
  initialize: (paymentData) => api.post('/payment/initialize', paymentData),
};

export const mtnAPI = {
  testConnection: () => api.get('/mtn/test'),
  transferData: (data) => api.post('/mtn/transfer', data),
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

export default api;
