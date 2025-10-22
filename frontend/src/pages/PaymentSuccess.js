import React from 'react';
import { Link } from 'react-router-dom';

const PaymentSuccess = () => {
  return (
    <div style={{ 
      padding: '2rem', 
      textAlign: 'center',
      maxWidth: '600px',
      margin: '0 auto',
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{ 
        padding: '2rem', 
        border: '2px solid #52c41a', 
        borderRadius: '10px',
        backgroundColor: '#f6ffed'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>��</div>
        <h1 style={{ color: '#52c41a', marginBottom: '1rem' }}>Payment Successful!</h1>
        <p style={{ fontSize: '1.1rem', marginBottom: '2rem', color: '#666' }}>
          Thank you for your purchase! Your data bundles are being processed and will be delivered to the provided phone numbers shortly.
        </p>
        
        <div style={{ 
          backgroundColor: '#e6f7ff', 
          padding: '1rem', 
          borderRadius: '5px',
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <h3 style={{ color: '#1890ff', marginBottom: '0.5rem' }}>What happens next?</h3>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            <li>You will receive an SMS confirmation</li>
            <li>Data bundles will be activated within 5 minutes</li>
            <li>Receipt will be sent to your email</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/plans" style={{ 
            padding: '1rem 2rem', 
            backgroundColor: '#1890ff', 
            color: 'white', 
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: 'bold'
          }}>
            Buy More Data
          </Link>
          <Link to="/" style={{ 
            padding: '1rem 2rem', 
            backgroundColor: '#52c41a', 
            color: 'white', 
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: 'bold'
          }}>
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
