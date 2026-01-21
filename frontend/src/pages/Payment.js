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
  const [paymentStatus, setPaymentStatus] = useState('initializing');
  const [pollingInterval, setPollingInterval] = useState(null);

  useEffect(() => {
    // Get payment data from location state or localStorage
    const data = location.state || JSON.parse(localStorage.getItem('paymentData') || '{}');
    
    if (!data.orderId || !data.amount || !data.email) {
      setError('Invalid payment data. Please return to checkout and try again.');
      setLoading(false);
      setPaymentStatus('error');
      return;
    }

    setPaymentData(data);
    initializePaystackPayment(data);
    
    // Cleanup on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [location]);

  const initializePaystackPayment = async (data) => {
    try {
      setLoading(true);
      setPaymentStatus('initializing');
      
      // 1. Initialize payment with backend
      const response = await paymentAPI.initialize({
        orderId: data.orderId,
        email: data.email,
        amount: data.amount
      });

      console.log('🔄 Payment initialization response:', response.data);

      if (response.data.success && response.data.paymentUrl) {
        // 2. Open Paystack in a new window (not popup)
        const paystackWindow = window.open(
          response.data.paymentUrl,
          '_blank',
          'width=800,height=600,scrollbars=yes,location=yes'
        );

        if (!paystackWindow) {
          setError('Please allow popups for this site to complete payment.');
          setPaymentStatus('error');
          setLoading(false);
          return;
        }

        setPaymentStatus('waiting');
        setLoading(false);
        
        // 3. Start polling for payment completion
        startPaymentPolling(response.data.reference, data);
      } else {
        throw new Error('Failed to initialize payment');
      }
    } catch (error) {
      console.error('❌ Payment initialization error:', error);
      setError(error.response?.data?.error || 'Failed to initialize payment. Please try again.');
      setPaymentStatus('error');
      setLoading(false);
    }
  };

  const startPaymentPolling = (reference, data) => {
    const maxAttempts = 50; // ~5 minutes (6-second intervals)
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      console.log(`🔍 Payment polling attempt ${attempts}/${maxAttempts} for ref: ${reference}`);
      
      try {
        const response = await paymentAPI.verify(reference);
        
        if (response.data.success) {
          // Payment successful
          clearInterval(interval);
          setPaymentStatus('success');
          
          // Store last order for success page
          localStorage.setItem('lastOrder', JSON.stringify({
            trxCode: data.trxCode,
            amount: data.amount,
            date: new Date().toISOString(),
            orderId: data.orderId
          }));

          // Clear pending cart and payment data
          localStorage.removeItem('pendingCart');
          localStorage.removeItem('paymentData');

          // Redirect to success page after 2 seconds
          setTimeout(() => {
            navigate('/payment-success');
          }, 2000);
          
        } else if (attempts >= maxAttempts) {
          // Timeout
          clearInterval(interval);
          setError('Payment timeout. Please check your payment status in your dashboard.');
          setPaymentStatus('timeout');
          setLoading(false);
        }
        // If not successful yet, continue polling
      } catch (error) {
        console.error('Payment status check error:', error);
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setError('Payment verification failed. Please check your dashboard.');
          setPaymentStatus('error');
          setLoading(false);
        }
      }
    }, 6000); // Check every 6 seconds

    setPollingInterval(interval);
  };

  const handleCancelPayment = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    localStorage.removeItem('paymentData');
    localStorage.removeItem('pendingCart');
    navigate('/client-dashboard');
  };

  const handleRetryPayment = () => {
    if (paymentData) {
      setError('');
      setLoading(true);
      setPaymentStatus('initializing');
      initializePaystackPayment(paymentData);
    }
  };

  if (loading) {
    return (
      <div className={`payment-container ${darkMode ? 'dark' : ''}`}>
        <div className="payment-loading">
          <div className="spinner"></div>
          <h2>Initializing Payment...</h2>
          <p>Please wait while we prepare your secure payment gateway.</p>
          <p>You will be redirected to Paystack shortly.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`payment-container ${darkMode ? 'dark' : ''}`}>
        <div className="payment-error">
          <div className="error-icon">❌</div>
          <h2>Payment Error</h2>
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
              Retry Payment
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
        <div className="payment-status">
          {paymentStatus === 'waiting' && (
            <div className="status-waiting">
              <div className="spinner"></div>
              <h2>Waiting for Payment...</h2>
              <p>Please complete your payment in the Paystack window.</p>
            </div>
          )}
          
          {paymentStatus === 'success' && (
            <div className="status-success">
              <div className="success-icon">✅</div>
              <h2>Payment Successful!</h2>
              <p>Your payment has been verified. Redirecting to success page...</p>
            </div>
          )}
          
          {paymentStatus === 'timeout' && (
            <div className="status-timeout">
              <div className="timeout-icon">⏰</div>
              <h2>Payment Timeout</h2>
              <p>The payment process took too long. Please check your dashboard for status.</p>
            </div>
          )}
        </div>
        
        {paymentData && paymentStatus === 'waiting' && (
          <>
            <div className="payment-details">
              <h3>Payment Details</h3>
              <div className="detail-item">
                <strong>TRX Code:</strong>
                <span className="trx-code">{paymentData.trxCode}</span>
              </div>
              <div className="detail-item">
                <strong>Order ID:</strong>
                <span>{paymentData.orderId}</span>
              </div>
              <div className="detail-item">
                <strong>Amount:</strong>
                <span className="amount">GH₵{paymentData.amount.toFixed(2)}</span>
              </div>
              <div className="detail-item">
                <strong>Customer Email:</strong>
                <span>{paymentData.email}</span>
              </div>
            </div>
            
            <div className="payment-instructions">
              <h3>Instructions:</h3>
              <ul>
                <li><strong>1.</strong> Complete your payment in the Paystack window that opened</li>
                <li><strong>2.</strong> Do not close this page until payment is complete</li>
                <li><strong>3.</strong> Payment will be verified automatically</li>
                <li><strong>4.</strong> You'll be redirected to your dashboard after successful payment</li>
                <li><strong>5.</strong> If Paystack window closed, <button 
                  onClick={() => window.open(paymentData.paymentUrl, '_blank')}
                  className="link-btn"
                >
                  click here to reopen
                </button></li>
              </ul>
            </div>
            
            <div className="payment-note">
              <h4>💡 Important Notes:</h4>
              <ul>
                <li>Payment methods: Card, Mobile Money (MTN, Vodafone, AirtelTigo)</li>
                <li>Secure payment powered by Paystack</li>
                <li>Receipt will be sent to your email</li>
                <li>If payment fails, you can retry from your dashboard</li>
              </ul>
            </div>
          </>
        )}
        
        <div className="payment-actions">
          <button onClick={handleCancelPayment} className="cancel-payment-btn">
            Cancel Payment
          </button>
          <p className="support-note">
            Need help? Contact support if you encounter any issues.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Payment;