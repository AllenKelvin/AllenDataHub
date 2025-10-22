import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://allendatahub-backend.onrender.com';

console.log('API Base URL:', API_BASE_URL); // Add this for debugging

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  register: (userData) => api.post('/api/auth/register', userData),
  login: (credentials) => api.post('/api/auth/login', credentials),
};

// Data Plans API
export const plansAPI = {
  getPlans: () => api.get('/api/plans'),
};

// Orders API
export const ordersAPI = {
  createOrder: (orderData) => api.post('/api/orders', orderData),
  getUserOrders: () => api.get('/api/orders'),
};

// Admin API
export const adminAPI = {
  getAllOrders: () => api.get('/api/admin/orders'),
  getStats: () => api.get('/api/admin/stats'),
};

export default api;
