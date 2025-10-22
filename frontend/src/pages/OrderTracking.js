import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { ordersAPI } from '../services/api';

const ORDER_STATUS = {
  PLACED: 'placed',
  PROCESSING: 'processing', 
  DELIVERED: 'delivered'
};

const OrderTracking = () => {
  const { orders, updateOrderStatus } = useCart();
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch orders from backend on component mount
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        const response = await ordersAPI.getMyOrders();
        console.log('📋 Orders loaded from backend:', response.data.length);
      } catch (error) {
        console.error('Error loading orders:', error);
        alert('Failed to load orders. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  // Simulate order status progression
  useEffect(() => {
    if (!trackingOrder) return;

    const timers = [];

    if (trackingOrder.status === ORDER_STATUS.PLACED) {
      const timer = setTimeout(() => {
        updateOrderStatus(trackingOrder._id, ORDER_STATUS.PROCESSING);
        setTrackingOrder({ ...trackingOrder, status: ORDER_STATUS.PROCESSING });
      }, 5000);
      timers.push(timer);
    }

    if (trackingOrder.status === ORDER_STATUS.PROCESSING) {
      const timer = setTimeout(() => {
        updateOrderStatus(trackingOrder._id, ORDER_STATUS.DELIVERED);
        setTrackingOrder({ ...trackingOrder, status: ORDER_STATUS.DELIVERED });
      }, 10000);
      timers.push(timer);
    }

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [trackingOrder, updateOrderStatus]);

  const startTracking = (order) => {
    setTrackingOrder(order);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case ORDER_STATUS.PLACED: return '#faad14';
      case ORDER_STATUS.PROCESSING: return '#1890ff';
      case ORDER_STATUS.DELIVERED: return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case ORDER_STATUS.PLACED: return 'Order Placed';
      case ORDER_STATUS.PROCESSING: return 'Processing';
      case ORDER_STATUS.DELIVERED: return 'Delivered';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Loading your orders...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#1890ff' }}>
        Order Tracking
      </h1>

      {/* Real-time Tracking Section */}
      {trackingOrder && (
        <div style={{ 
          marginBottom: '3rem', 
          padding: '2rem', 
          border: '2px solid #1890ff',
          borderRadius: '10px',
          backgroundColor: '#f0f8ff'
        }}>
          <h2 style={{ color: '#1890ff', marginBottom: '1.5rem' }}>
            Tracking Order #{trackingOrder.orderId}
          </h2>
          
          {/* Status Progress Bar */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginBottom: '1rem',
              position: 'relative'
            }}>
              {[ORDER_STATUS.PLACED, ORDER_STATUS.PROCESSING, ORDER_STATUS.DELIVERED].map((status, index) => (
                <div key={status} style={{ textAlign: 'center', zIndex: 2 }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(status),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      margin: '0 auto 0.5rem',
                      border: trackingOrder.status === status ? '3px solid #fff' : 'none',
                      boxShadow: '0 0 0 2px ' + getStatusColor(status)
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ fontWeight: 'bold', color: getStatusColor(status) }}>
                    {getStatusText(status)}
                  </div>
                  {trackingOrder.status === status && (
                    <div style={{ 
                      marginTop: '0.5rem', 
                      fontSize: '0.9rem',
                      color: '#666',
                      fontWeight: 'bold'
                    }}>
                      ⏳ Current Status
                    </div>
                  )}
                </div>
              ))}
              
              {/* Progress Line */}
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '20%',
                right: '20%',
                height: '4px',
                backgroundColor: '#d9d9d9',
                zIndex: 1
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: '#52c41a',
                  width: trackingOrder.status === ORDER_STATUS.PLACED ? '0%' : 
                        trackingOrder.status === ORDER_STATUS.PROCESSING ? '50%' : '100%',
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <strong>Order Total:</strong> GH₵{trackingOrder.total}
            </div>
            <div>
              <strong>Recipient Email:</strong> {trackingOrder.recipientEmail}
            </div>
            <div>
              <strong>Recipient Phone:</strong> {trackingOrder.recipientPhone}
            </div>
            <div>
              <strong>Order Time:</strong> {new Date(trackingOrder.createdAt).toLocaleString()}
            </div>
          </div>

          {/* Items List */}
          <div>
            <strong>Items:</strong>
            {trackingOrder.items.map((item, index) => (
              <div key={index} style={{ 
                padding: '0.5rem', 
                margin: '0.5rem 0',
                backgroundColor: 'white',
                borderRadius: '5px',
                border: '1px solid #e8e8e8'
              }}>
                {item.network} {item.size} → {item.recipientPhone}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order History */}
      <div>
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Order History ({orders.length} orders)</h2>
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            <h3>No orders yet</h3>
            <p>Make your first purchase to see your order history here.</p>
            <button 
              onClick={() => window.location.href = '/plans'}
              style={{
                padding: '1rem 2rem',
                backgroundColor: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginTop: '1rem'
              }}
            >
              Browse Data Plans
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {orders.map(order => (
              <div key={order._id} style={{ 
                border: '1px solid #e8e8e8',
                borderRadius: '8px',
                padding: '1.5rem',
                backgroundColor: 'white',
                cursor: trackingOrder?._id === order._id ? 'default' : 'pointer',
                opacity: trackingOrder?._id === order._id ? 1 : 0.9
              }}
              onClick={() => trackingOrder?._id !== order._id && startTracking(order)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#1890ff' }}>Order #{order.orderId}</h3>
                    <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
                      {order.items.length} item(s) • GH₵{order.total}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      padding: '0.5rem 1rem',
                      backgroundColor: getStatusColor(order.status),
                      color: 'white',
                      borderRadius: '20px',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}>
                      {getStatusText(order.status)}
                    </div>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#666' }}>
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {trackingOrder?._id === order._id && (
                  <button 
                    onClick={() => setTrackingOrder(null)}
                    style={{
                      marginTop: '1rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Stop Tracking
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;
