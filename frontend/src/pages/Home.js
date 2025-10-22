import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Home = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleContactSupport = () => {
    alert('Contact AllenDataHub Support:\n\n📞 Phone: 0592786175 / 0546051806\n📧 Email: allenkelvin175@gmail.com\n\nWe\'re available 24/7 to assist you!');
  };

  return (
    <div style={{ 
      padding: '2rem', 
      textAlign: 'center',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      {user ? (
        // Show when user is logged in
        <>
          <h1 style={{ color: '#1890ff', fontSize: '2.5rem', marginBottom: '1rem' }}>
            Welcome back, {user.username}! 👋
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2rem' }}>
            Ready to purchase more data bundles? We're glad to have you back.
          </p>
        </>
      ) : (
        // Show when user is not logged in
        <>
          <h1 style={{ color: '#1890ff', fontSize: '2.5rem', marginBottom: '1rem' }}>
            Welcome to AllenDataHub
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2rem' }}>
            Instantly purchase MTN and Telecel data bundles at competitive prices. 
            Fast, reliable, and convenient data top-ups for all your needs.
          </p>
        </>
      )}
      
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '3rem' }}>
        <Link to="/plans" style={{ 
          padding: '1rem 2rem', 
          backgroundColor: '#1890ff', 
          color: 'white', 
          textDecoration: 'none',
          borderRadius: '5px',
          fontWeight: 'bold',
          fontSize: '1.1rem'
        }}>
          📊 View Data Plans
        </Link>
        
        {!user && (
          <Link to="/signup" style={{ 
            padding: '1rem 2rem', 
            backgroundColor: '#52c41a', 
            color: 'white', 
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: 'bold',
            fontSize: '1.1rem'
          }}>
            🚀 Get Started
          </Link>
        )}
        
        <button 
          onClick={handleContactSupport}
          style={{
            padding: '1rem 2rem',
            backgroundColor: '#faad14',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1.1rem'
          }}
        >
          📞 Contact Support
        </button>
      </div>

      <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
        <div style={{ padding: '1.5rem', border: '1px solid #e8e8e8', borderRadius: '8px' }}>
          <h3>🚀 Fast Delivery</h3>
          <p>Receive your data bundle instantly after payment confirmation</p>
        </div>
        <div style={{ padding: '1.5rem', border: '1px solid #e8e8e8', borderRadius: '8px' }}>
          <h3>💳 Secure Payments</h3>
          <p>Multiple payment options including Mobile Money and cards</p>
        </div>
        <div style={{ padding: '1.5rem', border: '1px solid #e8e8e8', borderRadius: '8px' }}>
          <h3>📞 24/7 Support</h3>
          <p>Get help whenever you need it with our customer support</p>
        </div>
      </div>

      {!user && (
        <div style={{ 
          marginTop: '4rem', 
          padding: '2rem', 
          backgroundColor: '#f6ffed', 
          border: '1px solid #b7eb8f',
          borderRadius: '10px'
        }}>
          <h3 style={{ color: '#389e0d', marginBottom: '1rem' }}>Ready to Get Started?</h3>
          <p style={{ marginBottom: '1.5rem' }}>Create an account to start buying data bundles and track your orders.</p>
          <Link to="/signup" style={{ 
            padding: '0.8rem 1.5rem', 
            backgroundColor: '#389e0d', 
            color: 'white', 
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: 'bold'
          }}>
            Create Free Account
          </Link>
        </div>
      )}
    </div>
  );
};

export default Home;
