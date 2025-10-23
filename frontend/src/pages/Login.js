import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Attempting login with:', { email: formData.email });
      
      // Call the real backend API
      const response = await authAPI.login({
        email: formData.email,
        password: formData.password
      });

      console.log('Login successful response:', response.data);
      
      if (response.data && response.data.token) {
        // Save token and user data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        console.log('User data saved to localStorage:', response.data.user);
        
        // Force page reload to update navbar and all components
        window.location.href = '/';
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Login error details:', error);
      console.error('Error response:', error.response);
      
      if (error.response) {
        // Server responded with error status
        setError(error.response.data?.error || 'Login failed. Please check your credentials.');
      } else if (error.request) {
        // Request was made but no response received
        setError('Network error. Please check your connection.');
      } else {
        // Something else happened
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '2rem', 
      maxWidth: '400px', 
      margin: '0 auto',
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        width: '100%', 
        padding: '2rem', 
        border: '1px solid #e8e8e8', 
        borderRadius: '10px',
        backgroundColor: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#1890ff' }}>
          Welcome Back
        </h2>
        
        {error && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#fff2f0', 
            border: '1px solid #ffccc7',
            borderRadius: '5px',
            marginBottom: '1rem',
            color: '#a8071a'
          }}>
            ❌ {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.8rem',
                border: error ? '1px solid #ff4d4f' : '1px solid #d9d9d9',
                borderRadius: '5px',
                fontSize: '1rem',
                opacity: loading ? 0.6 : 1
              }}
              placeholder="Enter your email"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.8rem',
                border: error ? '1px solid #ff4d4f' : '1px solid #d9d9d9',
                borderRadius: '5px',
                fontSize: '1rem',
                opacity: loading ? 0.6 : 1
              }}
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              backgroundColor: loading ? '#d9d9d9' : '#52c41a',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '1rem',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '🔐 Logging in...' : '🚀 Login'}
          </button>
        </form>

        <p style={{ textAlign: 'center', margin: 0 }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: '#1890ff', textDecoration: 'none' }}>
            Sign up here
          </Link>
        </p>

        <div style={{ 
          marginTop: '1.5rem', 
          padding: '1rem', 
          backgroundColor: '#f6ffed', 
          border: '1px solid #b7eb8f',
          borderRadius: '5px',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#389e0d' }}>
            <strong>Real Authentication:</strong> Connected to MongoDB database
          </p>
        </div>

        {/* Debug info */}
        <div style={{ 
          marginTop: '1rem', 
          padding: '1rem', 
          backgroundColor: '#e6f7ff', 
          border: '1px solid #91d5ff',
          borderRadius: '5px',
          fontSize: '0.8rem'
        }}>
          <p style={{ margin: 0, color: '#0050b3' }}>
            <strong>Debug Info:</strong><br />
            • Backend: http://localhost:5000<br />
            • Check browser Console (F12) for details
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
