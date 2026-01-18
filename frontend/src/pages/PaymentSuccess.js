import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import './PaymentSuccess.css';

const PaymentSuccess = () => {
  const [orderDetails, setOrderDetails] = useState(null);
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    // Get order details from localStorage
    const lastOrder = localStorage.getItem('lastOrder');
    if (lastOrder) {
      setOrderDetails(JSON.parse(lastOrder));
      
      // Clear the stored order after 5 seconds
      setTimeout(() => {
        localStorage.removeItem('lastOrder');
      }, 5000);
    } else {
      // If no order details, redirect to dashboard
      navigate('/client-dashboard');
    }
  }, [navigate]);

  if (!orderDetails) {
    return (
      <div className={`loading-container ${darkMode ? 'dark' : ''}`}>
        <h2>Loading order details...</h2>
      </div>
    );
  }

  return (
    <div className={`success-container ${darkMode ? 'dark' : ''}`}>
      <div className="success-card">
        <div className="success-icon">🎉</div>
        <h1>Payment Successful!</h1>
        
        <div className="order-details">
          <div className="detail-item">
            <strong>TRX Code:</strong>
            <span className="trx-code">{orderDetails.trxCode}</span>
          </div>
          
          <div className="detail-item">
            <strong>Amount Paid:</strong>
            <span className="amount">GH₵{orderDetails.amount.toFixed(2)}</span>
          </div>
          
          <div className="detail-item">
            <strong>Date:</strong>
            <span>{new Date(orderDetails.date).toLocaleString()}</span>
          </div>
          
          <div className="detail-item">
            <strong>Status:</strong>
            <span className="status delivered">✅ Delivered</span>
          </div>
        </div>
        
        <div className="success-message">
          <p>Your order has been processed successfully!</p>
          <p>The data bundles have been sent to the specified phone numbers.</p>
        </div>
        
        <div className="action-buttons">
          <Link to="/client-dashboard" className="dashboard-btn">
            Go to Dashboard
          </Link>
          
          <button
            onClick={() => {
              // Copy TRX code to clipboard
              navigator.clipboard.writeText(orderDetails.trxCode);
              alert('TRX code copied to clipboard!');
            }}
            className="copy-btn"
          >
            Copy TRX Code
          </button>
        </div>
        
        <div className="next-steps">
          <h3>What's Next?</h3>
          <ul>
            <li>✅ The data bundles have been activated</li>
            <li>📱 Check beneficiary phones for confirmation messages</li>
            <li>📊 View this transaction in your dashboard</li>
            <li>📧 A receipt has been sent to your email</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;