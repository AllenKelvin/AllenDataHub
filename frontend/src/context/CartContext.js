import React, { createContext, useContext, useReducer } from 'react';
import { ordersAPI } from '../services/api';

const CartContext = createContext();

export const ORDER_STATUS = {
  PLACED: 'placed',
  PROCESSING: 'processing', 
  DELIVERED: 'delivered'
};

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TO_CART':
      return {
        ...state,
        items: [...state.items, action.payload]
      };
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };
    case 'CLEAR_CART':
      return {
        ...state,
        items: []
      };
    case 'SET_ORDERS':
      return {
        ...state,
        orders: action.payload
      };
    case 'ADD_ORDER':
      return {
        ...state,
        orders: [action.payload, ...state.orders]
      };
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map(order => 
          order._id === action.payload.orderId 
            ? { ...order, status: action.payload.status }
            : order
        )
      };
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {
  const [cartState, dispatch] = useReducer(cartReducer, {
    items: [],
    orders: []
  });

  const addToCart = (plan) => {
    dispatch({
      type: 'ADD_TO_CART',
      payload: { ...plan, id: Date.now() }
    });
  };

  const removeFromCart = (itemId) => {
    dispatch({
      type: 'REMOVE_FROM_CART',
      payload: itemId
    });
  };

  const clearCart = () => {
    dispatch({
      type: 'CLEAR_CART'
    });
  };

  // Create order in backend - IMPROVED VERSION
  const createOrder = async (orderData) => {
    try {
      console.log('🛒 Creating order in backend...');
      console.log('📦 Order data:', orderData);
      
      // Check if user is logged in
      const user = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      if (!user || !token) {
        throw new Error('User not authenticated. Please login again.');
      }
      
      console.log('👤 User making order:', JSON.parse(user).username);
      console.log('🔐 Token available:', !!token);
      
      const response = await ordersAPI.create(orderData);
      console.log('✅ Order created successfully:', response.data);
      
      // Add the new order to local state
      dispatch({
        type: 'ADD_ORDER',
        payload: response.data.order
      });
      
      return response.data.order;
    } catch (error) {
      console.error('❌ Error creating order:', error);
      
      // Provide more specific error messages
      if (error.response) {
        // Server responded with error status
        throw new Error(error.response.data.error || 'Order creation failed');
      } else if (error.request) {
        // Request was made but no response received
        throw new Error('Network error. Please check your connection.');
      } else {
        // Something else happened
        throw new Error(error.message || 'Order creation failed');
      }
    }
  };

  // Fetch user orders from backend
  const fetchUserOrders = async () => {
    try {
      const response = await ordersAPI.getMyOrders();
      dispatch({
        type: 'SET_ORDERS',
        payload: response.data
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  };

  const updateOrderStatus = (orderId, status) => {
    dispatch({
      type: 'UPDATE_ORDER_STATUS',
      payload: { orderId, status }
    });
  };

  const getDailyStats = () => {
    const today = new Date().toDateString();
    const todayOrders = cartState.orders.filter(order => {
      const orderDate = new Date(order.createdAt).toDateString();
      return orderDate === today;
    });

    const totalOrders = todayOrders.length;
    const totalAmount = todayOrders.reduce((sum, order) => sum + order.total, 0);
    
    const totalDataVolume = todayOrders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => {
        const size = parseInt(item.size);
        return itemSum + (isNaN(size) ? 0 : size);
      }, 0);
    }, 0);

    return {
      totalOrders,
      totalAmount,
      totalDataVolume: `${totalDataVolume}GB`
    };
  };

  return (
    <CartContext.Provider value={{
      cartItems: cartState.items,
      orders: cartState.orders,
      addToCart,
      removeFromCart,
      clearCart,
      createOrder,
      fetchUserOrders,
      updateOrderStatus,
      getDailyStats,
      ORDER_STATUS
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
