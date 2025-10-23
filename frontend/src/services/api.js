import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance with better configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests - IMPROVED VERSION
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('🔐 API Request - Token available:', !!token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Token added to request headers');
    } else {
      console.log('❌ No token found in localStorage');
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response success:', response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ API Response error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
};

// Data Plans API
export const plansAPI = {
  getAll: () => api.get('/plans'),
};

// Orders API
export const ordersAPI = {
  create: (orderData) => {
    console.log('🛒 Creating order with data:', orderData);
    return api.post('/orders', orderData);
  },
  getMyOrders: () => api.get('/orders'),
  getOrder: (id) => api.get(`/orders/${id}`),
};

// Admin API
export const adminAPI = {
  getAllOrders: () => api.get('/admin/orders'),
  getStats: () => api.get('/admin/stats'),
};

// Test API connection
export const testAPI = {
  health: () => api.get('/health'),
  users: () => api.get('/users'),
};

export default api;
