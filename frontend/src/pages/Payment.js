import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { paymentAPI } from '../services/api';
import './Payment.css';

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Get payment data from navigation state or localStorage
    const data = location.state || JSON.parse(localStorage.getItem('paymentData') || '{}');
    
    if (!data.orderId || !data.amount || !data.email) {
      setError('Invalid payment data. Please return to checkout and try again.');
      setLoading(false);
      return;
    }

    setPaymentData(data);
    initializePaystackRedirect(data);
  }, [location]);

  const initializePaystackRedirect = async (data) => {
    try {
      setLoading(true);
      
      // Redirect URL for Paystack to return to after payment
      const redirectUrl = `${window.location.origin}/payment-return`;
      
      console.log('🔄 Initializing Paystack redirect payment...', {
        orderId: data.orderId,
        email: data.email,
        amount: data.amount,
        redirectUrl
      });

      // Initialize payment with redirect URL
      const response = await paymentAPI.initialize({
        orderId: data.orderId,
        email: data.email,
        amount: data.amount,
        redirectUrl: redirectUrl
      });

      console.log('✅ Paystack redirect response:', response.data);

      if (response.data.success && response.data.paymentUrl) {
        // Store reference for verification later
        localStorage.setItem('paymentData', JSON.stringify({
          ...data,
          reference: response.data.reference
        }));
        
        // Auto-redirect to Paystack after a brief delay
        setTimeout(() => {
          setRedirecting(true);
          console.log('🔗 Redirecting to Paystack:', response.data.paymentUrl);
          window.location.href = response.data.paymentUrl;
        }, 1500);
        
      } else {
        throw new Error(response.data.error || 'Failed to initialize payment');
      }
    } catch (error) {
      console.error('❌ Payment initialization error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to initialize payment. Please try again.');
      setLoading(false);
    }
  };

  const handleManualRedirect = () => {
    if (paymentData) {
      setError('');
      setLoading(true);
      initializePaystackRedirect(paymentData);
    }
  };

  const handleBackToCheckout = () => {
    navigate('/checkout');
  };

  const handleCancelPayment = () => {
    localStorage.removeItem('paymentData');
    localStorage.removeItem('pendingCart');
    navigate('/client-dashboard');
  };

  if (redirecting) {
    return (
      <div className={`payment-container ${darkMode ? 'dark' : ''}`}>
        <div className="payment-redirecting">
          <div className="spinner"></div>
          <h2>Redirecting to Paystack...</h2>
          <p>You're being redirected to Paystack's secure checkout page.</p>
          <p className="redirect-note">
            If you're not redirected automatically in a few seconds, 
            please click the button below:
          </p>
          <button 
            onClick={() => window.location.href = paymentData?.paymentUrl}
            className="manual-redirect-btn"
          >
            Go to Paystack Now
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`payment-container ${darkMode ? 'dark' : ''}`}>
        <div className="payment-loading">
          <div className="spinner"></div>
          <h2>Preparing Secure Payment</h2>
          <p>Setting up your payment session with Paystack. Please wait...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`payment-container ${darkMode ? 'dark' : ''}`}>
        <div className="payment-error">
          <div className="error-icon">❌</div>
          <h2>Payment Setup Error</h2>
          <p className="error-message">{error}</p>
          
          {paymentData && (
            <div className="payment-details">
              <div className="detail-item">
                <strong>Order ID:</strong>
                <span>{paymentData.orderId}</span>
              </div>
              <div className="detail-item">
                <strong>Amount:</strong>
                <span className="amount">GH₵{paymentData.amount.toFixed(2)}</span>
              </div>
            </div>
          )}
          
          <div className="error-actions">
            <button onClick={handleManualRedirect} className="retry-btn">
              Retry Payment Setup
            </button>
            <button onClick={handleBackToCheckout} className="back-btn">
              Back to Checkout
            </button>
            <button onClick={handleCancelPayment} className="cancel-btn">
              Cancel & Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback UI (should not be shown with auto-redirect)
  return (
    <div className={`payment-container ${darkMode ? 'dark' : ''}`}>
      <div className="payment-info">
        <div className="payment-header">
          <h2>Complete Your Payment</h2>
          <p>You should be redirected automatically to Paystack's secure checkout page.</p>
        </div>
        
        <div className="payment-instructions">
          <h3>What happens next:</h3>
          <div className="flow-steps">
            <div className="flow-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <strong>Redirect to Paystack</strong>
                <p>You'll be taken to Paystack's secure payment page</p>
              </div>
            </div>
            <div className="flow-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <strong>Complete Payment</strong>
                <p>Choose: Card, Mobile Money, or Bank Transfer</p>
              </div>
            </div>
            <div className="flow-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <strong>Return to AllenDataHub</strong>
                <p>After payment, you'll return to your dashboard</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="payment-actions">
          <button onClick={handleBackToCheckout} className="back-btn">
            ← Back to Checkout
          </button>
          <button onClick={handleCancelPayment} className="cancel-btn">
            Cancel Order
          </button>
        </div>
      </div>
    </div>
  );
};

export default Payment;