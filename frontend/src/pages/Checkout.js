import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';

const Checkout = () => {
  const { cartItems, clearCart, createOrder } = useCart();
  const navigate = useNavigate();
  const [paymentData, setPaymentData] = useState({
    email: '',
    phone: '',
    paymentMethod: 'mobile_money'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  // Check if user is logged in
  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    console.log('🔐 Checkout - User logged in:', !!userData);
    console.log('🔐 Checkout - Token available:', !!token);
    
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      setError('Please login to complete your order');
    }
  }, []);

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);

  const handleInputChange = (e) => {
    setPaymentData({
      ...paymentData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handlePaystackPayment = async () => {
    // Check if user is logged in
    if (!user) {
      setError('Please login to complete your order');
      navigate('/login');
      return;
    }

    if (!paymentData.email || !paymentData.phone) {
      setError('Please fill in all required fields');
      return;
    }

    const isValidGhanaNumber = (phone) => {
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      const ghanaRegex = /^(020|023|024|025|026|027|028|029|030|050|054|055|056|057|058|059)\d{7}$/;
      return ghanaRegex.test(cleanPhone);
    };

    if (!isValidGhanaNumber(paymentData.phone)) {
      setError('Please enter a valid Ghanaian phone number');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(paymentData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('💰 Starting payment process...');
      console.log('📦 Cart items:', cartItems);
      console.log('👤 User:', user.username);
      
      // Prepare order data
      const orderData = {
        items: cartItems.map(item => ({
          network: item.network,
          size: item.size,
          price: item.price,
          recipientPhone: item.recipientPhone,
          validity: item.validity
        })),
        total: total,
        recipientEmail: paymentData.email,
        recipientPhone: paymentData.phone,
        paymentMethod: paymentData.paymentMethod
      };

      console.log('🛒 Sending order data:', orderData);

      // Create order in backend
      const order = await createOrder(orderData);

      console.log('✅ Order created successfully:', order);

      // Show success message
      alert(`🎉 Order #${order.orderId} created successfully!\n\nTotal: GH₵${total}\n\nRedirecting to order tracking...`);
      
      // Clear cart and redirect to order tracking
      clearCart();
      navigate('/order-tracking');

    } catch (error) {
      console.error('❌ Payment/Order creation error:', error);
      
      let errorMessage = 'Order creation failed. Please try again.';
      
      if (error.message.includes('Network error')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('authentication') || error.message.includes('token')) {
        errorMessage = 'Session expired. Please login again.';
        // Redirect to login
        setTimeout(() => navigate('/login'), 2000);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      alert(`❌ Order Failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Your cart is empty</h2>
        <button 
          onClick={() => navigate('/plans')}
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
    );
  }

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Authentication Required</h2>
        <p>Please login to complete your order.</p>
        <button 
          onClick={() => navigate('/login')}
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
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#1890ff' }}>
        Checkout & Payment
      </h1>

      {error && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fff2f0', 
          border: '1px solid #ffccc7',
          borderRadius: '5px',
          marginBottom: '2rem',
          color: '#a8071a'
        }}>
          ❌ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Order Summary */}
        <div>
          <h3 style={{ borderBottom: '2px solid #1890ff', paddingBottom: '0.5rem' }}>
            Order Summary
          </h3>
          
          <div style={{ marginBottom: '1.5rem' }}>
            {cartItems.map((item, index) => (
              <div key={index} style={{ 
                border: '1px solid #e8e8e8', 
                padding: '1rem', 
                marginBottom: '0.5rem',
                borderRadius: '5px',
                backgroundColor: '#fafafa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong>{item.network} {item.size}</strong>
                  <span style={{ color: '#1890ff', fontWeight: 'bold' }}>GH₵{item.price}</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  To: {item.recipientPhone}
                </div>
              </div>
            ))}
          </div>

          <div style={{ 
            borderTop: '2px solid #e8e8e8', 
            paddingTop: '1rem',
            fontSize: '1.2rem',
            fontWeight: 'bold'
          }}>
            Total: GH₵{total}
          </div>
        </div>

        {/* Payment Details */}
        <div>
          <h3 style={{ borderBottom: '2px solid #1890ff', paddingBottom: '0.5rem' }}>
            Payment Details
          </h3>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={paymentData.email}
              onChange={handleInputChange}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.8rem',
                border: '1px solid #d9d9d9',
                borderRadius: '5px',
                fontSize: '1rem'
              }}
              placeholder="your@email.com"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={paymentData.phone}
              onChange={handleInputChange}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.8rem',
                border: '1px solid #d9d9d9',
                borderRadius: '5px',
                fontSize: '1rem'
              }}
              placeholder="0551234567"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Payment Method *
            </label>
            <select
              name="paymentMethod"
              value={paymentData.paymentMethod}
              onChange={handleInputChange}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.8rem',
                border: '1px solid #d9d9d9',
                borderRadius: '5px',
                fontSize: '1rem'
              }}
            >
              <option value="mobile_money">Mobile Money</option>
              <option value="card">Credit/Debit Card</option>
            </select>
          </div>

          <button 
            onClick={handlePaystackPayment}
            disabled={loading}
            style={{
              width: '100%',
              padding: '1.2rem',
              backgroundColor: loading ? '#d9d9d9' : '#52c41a',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '1rem'
            }}
          >
            {loading ? 'Processing...' : `Pay with Paystack - GH₵${total}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
