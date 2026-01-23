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
  const [paymentUrl, setPaymentUrl] = useState('');

  useEffect(() => {
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
      
      // Get current URL for redirect back (using your existing PaymentReturn component)
      const redirectUrl = `${window.location.origin}/payment-return`;
      
      console.log('🔄 Initializing Paystack redirect payment...', {
        orderId: data.orderId,
        email: data.email,
        amount: data.amount,
        redirectUrl
      });

      const response = await paymentAPI.initialize({
        orderId: data.orderId,
        email: data.email,
        amount: data.amount,
        redirectUrl: redirectUrl // Pass redirect URL to backend
      });

      console.log('✅ Paystack redirect response:', response.data);

      if (response.data.success && response.data.paymentUrl) {
        // Store payment data for verification in PaymentReturn
        localStorage.setItem('paymentData', JSON.stringify({
          ...data,
          reference: response.data.reference
        }));
        
        setPaymentUrl(response.data.paymentUrl);
        setLoading(false);
      } else {
        throw new Error('Failed to initialize payment');
      }
    } catch (error) {
      console.error('❌ Payment initialization error:', error);
      setError(error.response?.data?.error || 'Failed to initialize payment. Please try again.');
      setLoading(false);
    }
  };

  const handleRedirectToPaystack = () => {
    if (paymentUrl) {
      console.log('🔗 Redirecting to Paystack checkout:', paymentUrl);
      
      // Immediately redirect to Paystack checkout page
      window.location.href = paymentUrl;
    }
  };

  const handleCancelPayment = () => {
    localStorage.removeItem('paymentData');
    localStorage.removeItem('pendingCart');
    navigate('/client-dashboard');
  };

  const handleRetryPayment = () => {
    if (paymentData) {
      setError('');
      setLoading(true);
      setPaymentUrl('');
      initializePaystackRedirect(paymentData);
    }
  };

  const handleManualRedirect = () => {
    if (paymentUrl) {
      window.open(paymentUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className={`payment-container ${darkMode ? 'dark' : ''}`}>
        <div className="payment-loading">
          <div className="spinner"></div>
          <h2>Preparing Secure Payment Gateway</h2>
          <p>Setting up your payment session. Please wait...</p>
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
            <button onClick={handleRetryPayment} className="retry-btn">
              Retry Payment Setup
            </button>
            <button onClick={() => navigate('/checkout')} className="back-btn">
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

  return (
    <div className={`payment-container ${darkMode ? 'dark' : ''}`}>
      <div className="payment-info">
        <div className="payment-header">
          <h2>Complete Your Payment</h2>
          <p>Click the button below to proceed to Paystack's secure checkout</p>
        </div>
        
        {paymentData && (
          <>
            <div className="payment-details">
              <h3>Order Summary</h3>
              <div className="detail-item">
                <strong>Order ID:</strong>
                <span>{paymentData.orderId}</span>
              </div>
              <div className="detail-item">
                <strong>Amount to Pay:</strong>
                <span className="amount">GH₵{paymentData.amount.toFixed(2)}</span>
              </div>
              <div className="detail-item">
                <strong>Customer Email:</strong>
                <span>{paymentData.email}</span>
              </div>
            </div>
            
            <div className="payment-instructions">
              <h3>Payment Flow:</h3>
              <div className="flow-steps">
                <div className="flow-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <strong>Click "Proceed to Paystack"</strong>
                    <p>You'll be redirected to Paystack's secure payment page</p>
                  </div>
                </div>
                <div className="flow-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <strong>Complete Payment</strong>
                    <p>Choose: Card, Mobile Money (MTN, Vodafone, AirtelTigo), or Bank Transfer</p>
                  </div>
                </div>
                <div className="flow-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <strong>Automatic Return</strong>
                    <p>After payment, you'll return to AllenDataHub automatically</p>
                  </div>
                </div>
                <div className="flow-step">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <strong>Order Processing</strong>
                    <p>Your data bundle will be delivered immediately</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="security-info">
              <div className="security-item">
                <span className="security-icon">🔒</span>
                <span className="security-text">PCI DSS Compliant & Encrypted</span>
              </div>
              <div className="security-item">
                <span className="security-icon">✅</span>
                <span className="security-text">Verified by Paystack (Stripe)</span>
              </div>
              <div className="security-item">
                <span className="security-icon">📧</span>
                <span className="security-text">Receipt sent to your email</span>
              </div>
            </div>
            
            <div className="payment-actions">
              <button 
                onClick={handleRedirectToPaystack}
                className="paystack-btn"
              >
                Proceed to Paystack Checkout
              </button>
              
              <p className="manual-redirect-note">
                If the button doesn't work, <button 
                  onClick={handleManualRedirect}
                  className="link-btn"
                >
                  click here to open in new tab
                </button>
              </p>
              
              <div className="alternative-actions">
                <button onClick={() => navigate('/checkout')} className="back-btn">
                  ← Back to Checkout
                </button>
                <button onClick={handleCancelPayment} className="cancel-btn">
                  Cancel Order
                </button>
              </div>
              
              <p className="security-note">
                <strong>Important:</strong> You will be redirected to paystack.com. 
                Never enter payment details on any other website.
              </p>
              
              <p className="support-note">
                Need help? Contact support if you encounter payment issues.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Payment;