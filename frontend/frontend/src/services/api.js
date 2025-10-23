import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
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
  create: (orderData) => api.post('/orders', orderData),
  getMyOrders: () => api.get('/orders'),
  getOrder: (id) => api.get(`/orders/${id}`),
};

// Admin API
export const adminAPI = {
  getAllOrders: () => api.get('/admin/orders'),
  getStats: () => api.get('/admin/stats'),
};

// Payment API
export const paymentAPI = {
  initialize: (paymentData) => api.post('/payment/initialize', paymentData),
};

export default api;
