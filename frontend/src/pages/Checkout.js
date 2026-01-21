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
  const [verifying, setVerifying] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
  });
  
  const [orderVerification, setOrderVerification] = useState({
    isValid: false,
    message: '',
    totalAmount: 0,
    verificationId: ''
  });

  const toDouble = (num) => {
    if (num === null || num === undefined) return 0;
    const parsed = typeof num === 'string' ? parseFloat(num) : Number(num);
    return Math.round(parsed * 100) / 100;
  };

  useEffect(() => {
    if (cartItems.length === 0) {
      navigate('/cart');
    }
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.email) {
      setFormData(prev => ({ ...prev, email: user.email, phone: user.phone || '' }));
    }
  }, [cartItems, navigate]);

  const subtotal = toDouble(cartItems.reduce((sum, item) => {
    const itemPrice = toDouble(item.price);
    const quantity = item.quantity || 1;
    return sum + (itemPrice * quantity);
  }, 0));
  
  const serviceFee = 0.50;
  const estimatedTotal = toDouble(subtotal + serviceFee);

  const verifyOrderWithBackend = async () => {
    try {
      setVerifying(true);
      setOrderVerification(prev => ({ ...prev, isValid: false, message: '' }));
      
      if (!formData.email || !formData.phone) {
        alert('Please fill in email and phone number');
        setVerifying(false);
        return;
      }

      if (!formData.email.includes('@')) {
        alert('Please enter a valid email address');
        setVerifying(false);
        return;
      }

      const orderData = {
        items: cartItems.map(item => {
          const price = toDouble(item.price);
          
          return {
            planId: item._id || item.id,
            network: item.network,
            size: item.size,
            price: price,
            recipientPhone: item.recipientPhone,
            quantity: item.quantity || 1
          };
        }),
        totalAmount: estimatedTotal,
        customerEmail: formData.email,
        customerPhone: formData.phone
      };

      console.log('🔄 Verifying order:', orderData);
      
      const response = await ordersAPI.verify(orderData);
      console.log('✅ Verification response:', response.data);
      
      if (response.data.valid) {
        const verifiedAmount = toDouble(response.data.totalAmount);
        
        setOrderVerification({
          isValid: true,
          message: 'Order verified successfully! Click "Proceed to Payment" to continue.',
          totalAmount: verifiedAmount,
          verificationId: response.data.verificationId
        });
      } else {
        setOrderVerification({
          isValid: false,
          message: response.data.message || 'Order verification failed',
          totalAmount: 0,
          verificationId: ''
        });
      }
      
    } catch (error) {
      console.error('❌ Order verification error:', error);
      setOrderVerification({
        isValid: false,
        message: error.response?.data?.message || 'Failed to verify order',
        totalAmount: 0,
        verificationId: ''
      });
    } finally {
      setVerifying(false);
    }
  };

  const proceedToPayment = async () => {
    if (!orderVerification.isValid) {
      alert('Please verify your order first');
      return;
    }

    try {
      setLoading(true);
      
      const orderData = {
        items: cartItems.map(item => {
          const price = toDouble(item.price);
          
          return {
            planId: item._id || item.id,
            network: item.network,
            size: item.size,
            price: price,
            recipientPhone: item.recipientPhone,
            quantity: item.quantity || 1
          };
        }),
        totalAmount: orderVerification.totalAmount,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        paymentMethod: 'paystack'
      };

      console.log('🛒 Creating order:', orderData);
      
      const response = await ordersAPI.create(orderData);
      console.log('✅ Order created:', response.data);
      
      if (response.data.success) {
        const paymentData = {
          orderId: response.data.orderId,
          amount: orderVerification.totalAmount,
          email: formData.email,
          phone: formData.phone,
          items: cartItems,
          verificationId: orderVerification.verificationId
        };
        
        localStorage.setItem('paymentData', JSON.stringify(paymentData));
        localStorage.setItem('pendingCart', JSON.stringify(cartItems));
        
        navigate('/payment', { state: paymentData });
      } else {
        throw new Error(response.data.message || 'Failed to create order');
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Failed to proceed to payment: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerification = () => {
    setOrderVerification({
      isValid: false,
      message: '',
      totalAmount: 0,
      verificationId: ''
    });
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
        <div className="order-summary">
          <h2>Order Summary</h2>
          <div className="summary-items">
            {cartItems.map((item, index) => (
              <div key={index} className="summary-item">
                <div className="item-info">
                  <span className="item-name">{item.network} {item.size}</span>
                  <span className="item-price">GH₵{toDouble(item.price).toFixed(2)}</span>
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
            <div className="total-row estimated-total">
              <span>Estimated Total:</span>
              <span>GH₵{estimatedTotal.toFixed(2)}</span>
            </div>
            
            {orderVerification.isValid && (
              <div className="total-row verified-total">
                <span>Verified Total:</span>
                <span className="verified-amount">GH₵{orderVerification.totalAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {orderVerification.message && (
            <div className={`verification-status ${orderVerification.isValid ? 'valid' : 'invalid'}`}>
              {orderVerification.isValid ? '✅' : '❌'} {orderVerification.message}
            </div>
          )}
        </div>

        <div className="checkout-form-section">
          <div className="checkout-form">
            <h2>Customer Information</h2>
            
            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({...formData, email: e.target.value});
                  handleResetVerification();
                }}
                required
                disabled={verifying || loading}
                placeholder="Enter your email"
              />
            </div>
            
            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({...formData, phone: e.target.value});
                  handleResetVerification();
                }}
                required
                disabled={verifying || loading}
                placeholder="0241234567"
              />
            </div>
            
            <div className="notice-box">
              <strong>Payment Process:</strong>
              <ol>
                <li><strong>Verify</strong> your order details with our server</li>
                <li><strong>Proceed to Payment</strong> - Opens payment page</li>
                <li><strong>Complete payment</strong> on Paystack secure page</li>
                <li><strong>Auto-redirect</strong> to dashboard after successful payment</li>
              </ol>
            </div>
            
            <div className="checkout-steps">
              <div className="checkout-step">
                <div className="step-header">
                  <span className="step-number">1</span>
                  <h3>Verify Order</h3>
                </div>
                <p>Verify your order details with our server to get the correct total amount.</p>
                <button
                  type="button"
                  onClick={verifyOrderWithBackend}
                  className="verify-btn"
                  disabled={verifying || loading || !formData.email || !formData.phone}
                >
                  {verifying ? (
                    <>
                      <span className="spinner"></span>
                      Verifying...
                    </>
                  ) : (
                    'Verify Order with Server'
                  )}
                </button>
              </div>
              
              <div className={`checkout-step ${orderVerification.isValid ? 'active' : 'disabled'}`}>
                <div className="step-header">
                  <span className="step-number">2</span>
                  <h3>Proceed to Payment</h3>
                  {!orderVerification.isValid && (
                    <span className="step-required">(Complete step 1 first)</span>
                  )}
                </div>
                <p>Go to secure payment page to complete your purchase.</p>
                <button
                  type="button"
                  onClick={proceedToPayment}
                  className="pay-btn"
                  disabled={loading || !orderVerification.isValid}
                  title={!orderVerification.isValid ? "Please verify order first" : ""}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <span className="pay-icon">💳</span>
                      Proceed to Payment - GH₵{orderVerification.totalAmount.toFixed(2)}
                    </>
                  )}
                </button>
                
                {orderVerification.isValid && (
                  <button
                    type="button"
                    onClick={handleResetVerification}
                    className="reset-btn"
                    disabled={loading}
                  >
                    Edit Order Details
                  </button>
                )}
              </div>
            </div>
            
            <div className="checkout-actions">
              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="back-btn"
                disabled={loading || verifying}
              >
                Back to Cart
              </button>
            </div>
            
            <div className="payment-info">
              <p><strong>Payment Methods:</strong> Card, MTN MoMo, Vodafone Cash, AirtelTigo Money, Bank Transfer</p>
              <p><strong>Security:</strong> Powered by Paystack. Your payment details are secure.</p>
              <p><strong>Note:</strong> After clicking "Proceed to Payment", you'll be redirected to a payment page.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;