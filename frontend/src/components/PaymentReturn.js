import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentAPI } from '../services/api';

const PaymentReturn = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Get reference from URL
        const urlParams = new URLSearchParams(window.location.search);
        const reference = urlParams.get('reference');
        
        if (!reference) {
          throw new Error('No payment reference found');
        }

        // Verify payment
        const response = await paymentAPI.verify(reference);
        
        if (response.data.success) {
          setStatus('success');
          setMessage('Payment successful! Redirecting to dashboard...');
          
          // Clear pending order
          localStorage.removeItem('pendingOrder');
          
          // Redirect after 3 seconds
          setTimeout(() => {
            navigate('/client-dashboard');
          }, 3000);
        } else {
          setStatus('failed');
          setMessage('Payment failed. Please try again.');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('error');
        setMessage('Error verifying payment. Check your dashboard.');
      }
    };

    verifyPayment();
  }, [navigate]);

  return (
    <div className="payment-return-container" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      textAlign: 'center'
    }}>
      {status === 'verifying' && (
        <div>
          <div className="spinner" style={{
            width: '60px',
            height: '60px',
            border: '5px solid #f3f3f3',
            borderTop: '5px solid #1890ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <h2>Verifying Payment...</h2>
          <p>{message}</p>
        </div>
      )}
      
      {status === 'success' && (
        <div>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>✅</div>
          <h2>Payment Successful!</h2>
          <p>{message}</p>
        </div>
      )}
      
      {status === 'failed' && (
        <div>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>❌</div>
          <h2>Payment Failed</h2>
          <p>{message}</p>
          <button onClick={() => navigate('/client-dashboard')} style={{
            marginTop: '20px',
            padding: '12px 24px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            Back to Dashboard
          </button>
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PaymentReturn;