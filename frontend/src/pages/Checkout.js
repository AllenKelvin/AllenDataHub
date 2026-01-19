import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { ordersAPI } from '../services/api';
import './Checkout.css';

const Checkout = () => {
  const { cartItems, clearCart } = useCart();
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    paymentMethod: 'paystack'
  });
  const [orderVerification, setOrderVerification] = useState({
    isValid: false,
    message: '',
    totalAmount: 0,
    verifiedItems: []
  });

  useEffect(() => {
    if (cartItems.length === 0) {
      navigate('/cart');
    }
    
    // Set user email from localStorage if available
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.email) {
      setFormData(prev => ({ ...prev, email: user.email, phone: user.phone || '' }));
    }
  }, [cartItems, navigate]);

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);
  const serviceFee = 0.50;
  const total = subtotal + serviceFee;

  // Verify order with backend
  const verifyOrderWithBackend = async () => {
    try {
      setLoading(true);
      
      // Prepare order data for verification
      const orderData = {
        items: cartItems.map(item => ({
          planId: item._id || item.id, // Make sure this matches the plan ID
          network: item.network,
          size: item.size,
          price: parseFloat(item.price), // Convert to number
          recipientPhone: item.recipientPhone,
          quantity: item.quantity || 1
        })),
        totalAmount: total,
        customerEmail: formData.email,
        customerPhone: formData.phone
      };

      console.log('🔄 Verifying order with backend:', orderData);
      
      // Call backend to verify order
      const response = await ordersAPI.verify(orderData);
      console.log('✅ Verification response:', response.data);
      
      if (response.data.valid) {
        setOrderVerification({
          isValid: true,
          message: response.data.message || 'Order verified successfully',
          totalAmount: response.data.totalAmount || total,
          verifiedItems: response.data.items || cartItems
        });
        alert('✅ Order verified! You can now proceed to payment.');
      } else {
        setOrderVerification({
          isValid: false,
          message: response.data.message || 'Order verification failed',
          totalAmount: 0,
          verifiedItems: []
        });
        alert('❌ Order verification failed: ' + (response.data.message || 'Please check your order details'));
      }
      
    } catch (error) {
      console.error('❌ Order verification error:', error);
      const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        'Failed to verify order. Please try again.';
      
      setOrderVerification({
        isValid: false,
        message: errorMessage,
        totalAmount: 0,
        verifiedItems: []
      });
      
      alert('❌ Verification Error: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email || !formData.phone) {
      alert('Please fill in all required fields');
      return;
    }

    if (!formData.email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    // Verify order first (if not already verified)
    if (!orderVerification.isValid) {
      alert('Please verify your order first');
      return;
    }

    setLoading(true);
    
    try {
      // Create order with backend
      const orderData = {
        items: cartItems.map(item => ({
          planId: item._id || item.id,
          network: item.network,
          size: item.size,
          price: parseFloat(item.price),
          recipientPhone: item.recipientPhone,
          quantity: item.quantity || 1
        })),
        totalAmount: total,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        paymentMethod: formData.paymentMethod
      };

      console.log('🛒 Creating order:', orderData);
      const response = await ordersAPI.create(orderData);
      console.log('✅ Order created:', response.data);
      
      if (response.data.success) {
        // Clear cart
        clearCart();
        
        // Generate unique TRX code
        const trxCode = response.data.trxCode || `TRX${Date.now().toString(36).toUpperCase()}`;
        
        // Store order details for success page
        const orderDetails = {
          trxCode,
          orderId: response.data.orderId,
          amount: total,
          items: cartItems,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          date: new Date().toISOString(),
          status: 'processing'
        };
        
        localStorage.setItem('lastOrder', JSON.stringify(orderDetails));
        
        // Redirect based on payment method
        if (formData.paymentMethod === 'paystack' && response.data.paymentUrl) {
          // For PayStack, redirect to payment gateway
          console.log('Redirecting to payment gateway...');
          window.location.href = response.data.paymentUrl;
        } else {
          // For cash/other methods, go to success page
          console.log('Redirecting to success page...');
          navigate('/payment-success');
        }
      } else {
        throw new Error(response.data.message || 'Failed to create order');
      }
      
    } catch (error) {
      console.error('❌ Checkout error:', error);
      alert('Checkout failed: ' + (error.response?.data?.message || error.message || 'Please try again'));
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className={`empty-cart ${darkMode ? 'dark' : ''}`}>
        <h2>Your cart is empty</h2>
        <button onClick={() => navigate('/client-dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={`checkout-container ${darkMode ? 'dark' : ''}`}>
      <h1>Checkout</h1>
      
      <div className="checkout-content">
        {/* Order Summary */}
        <div className="order-summary">
          <h2>Order Summary</h2>
          <div className="summary-items">
            {cartItems.map((item, index) => (
              <div key={index} className="summary-item">
                <div className="item-info">
                  <span className="item-name">{item.network} {item.size}</span>
                  <span className="item-price">GH₵{item.price}</span>
                </div>
                <div className="item-details">
                  <span className="item-recipient">To: {item.recipientPhone}</span>
                  <span className="item-quantity">Qty: {item.quantity || 1}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="summary-totals">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>GH₵{subtotal.toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span>Service Fee:</span>
              <span>GH₵{serviceFee.toFixed(2)}</span>
            </div>
            <div className="total-row grand-total">
              <span>Total:</span>
              <span>GH₵{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Order Verification Status */}
          {orderVerification.message && (
            <div className={`verification-status ${orderVerification.isValid ? 'valid' : 'invalid'}`}>
              {orderVerification.isValid ? '✅' : '❌'} {orderVerification.message}
            </div>
          )}
        </div>

        {/* Checkout Form */}
        <div className="checkout-form-section">
          <form onSubmit={handleSubmit}>
            <h2>Customer Information</h2>
            
            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                disabled={loading}
                placeholder="Enter your email"
              />
            </div>
            
            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                required
                disabled={loading}
                placeholder="Enter your phone number"
              />
            </div>
            
            <div className="form-group">
              <label>Payment Method *</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                disabled={loading}
              >
                <option value="paystack">PayStack</option>
              </select>
            </div>
            
            {/* Important Notice */}
            <div className="notice-box">
              <strong>Important:</strong>
              <ul>
                <li>Order will be verified with our server before payment</li>
                <li>Ensure phone numbers are valid Ghanaian numbers</li>
                <li>Data bundles are delivered instantly after successful payment</li>
                <li>Contact support if you don't receive your data within 4-5 hours</li>
              </ul>
            </div>
            
            <div className="checkout-actions">
              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="back-btn"
                disabled={loading}
              >
                Back to Cart
              </button>
              
              <button
                type="button"
                onClick={verifyOrderWithBackend}
                className="verify-btn"
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify Order with Server'}
              </button>
              
              <button
                type="submit"
                className="pay-btn"
                disabled={loading || !orderVerification.isValid}
                title={!orderVerification.isValid ? "Please verify order first" : ""}
              >
                {loading ? 'Processing...' : `Pay GH₵${total.toFixed(2)}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Checkout;