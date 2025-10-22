import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      // Redirect to login if no user data
      navigate('/login');
    }
  }, [navigate]);

  const handleContactSupport = () => {
    alert('Contact AllenDataHub Support:\n\n📞 Phone: 0592786175 / 0546051806\n📧 Email: allenkelvin175@gmail.com\n\nWe\'re available 24/7 to assist you!');
  };

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#1890ff' }}>
        👤 User Profile
      </h1>

      <div style={{ 
        padding: '2rem', 
        border: '1px solid #e8e8e8', 
        borderRadius: '10px',
        backgroundColor: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: '#1890ff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '2rem',
            fontWeight: 'bold',
            margin: '0 auto 1rem'
          }}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ margin: 0, color: '#333' }}>{user.username}</h2>
        </div>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f0f8ff', 
            borderRadius: '8px',
            border: '1px solid #91d5ff'
          }}>
            <strong>📧 Email Address</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem' }}>{user.email}</p>
          </div>

          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f6ffed', 
            borderRadius: '8px',
            border: '1px solid #b7eb8f'
          }}>
            <strong>📞 Phone Number</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem' }}>{user.phone}</p>
          </div>

          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#fff7e6', 
            borderRadius: '8px',
            border: '1px solid #ffd591'
          }}>
            <strong>🆔 User ID</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontFamily: 'monospace' }}>{user.id}</p>
          </div>
        </div>
      </div>

      <div style={{ 
        padding: '1.5rem', 
        backgroundColor: '#f0f8ff', 
        border: '1px solid #91d5ff',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#1890ff', marginBottom: '1rem' }}>Need Help?</h3>
        <p style={{ marginBottom: '1.5rem' }}>
          Our support team is always ready to assist you with any questions or issues.
        </p>
        <button 
          onClick={handleContactSupport}
          style={{
            padding: '1rem 2rem',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1rem'
          }}
        >
          📞 Contact Support
        </button>
      </div>

      <div style={{ 
        marginTop: '1.5rem',
        padding: '1rem', 
        backgroundColor: '#fff2f0', 
        border: '1px solid #ffccc7',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#a8071a' }}>
          <strong>Support Hours:</strong> 24/7<br />
          <strong>Response Time:</strong> Within 30 minutes
        </p>
      </div>
    </div>
  );
};

export default UserProfile;
