import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Hardcoded admin credentials
  const validAdmins = [
    { username: '@Admin001', password: 'Password100' },
    { username: '@Admin002', password: 'Password200' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate credentials
      const isValidAdmin = validAdmins.some(admin => 
        admin.username === username && admin.password === password
      );

      if (!isValidAdmin) {
        throw new Error('Invalid admin credentials');
      }

      // Create admin user object with proper structure
      const adminUser = {
        _id: `admin-${username}`,
        username,
        email: `${username.toLowerCase().replace('@', '')}@allendatahub.com`,
        role: 'admin',
        name: username === '@Admin001' ? 'Admin User 1' : 'Admin User 2',
        createdAt: new Date().toISOString(),
        // Add any other required fields
      };

      console.log('Admin user created:', adminUser);

      // Simulate API call
      setTimeout(() => {
        const token = 'admin-token-' + Date.now();
        
        // Store in localStorage directly first
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(adminUser));
        
        // Then use the login function
        login(adminUser, token);
        
        // Force redirect to admin dashboard
        window.location.href = '/admin-dashboard';
        setLoading(false);
      }, 500);

    } catch (error) {
      setError(error.message || 'Invalid admin credentials');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header admin-header">
          <h1>👑 Admin Login</h1>
          <p>Access admin dashboard with authorized credentials</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">❌</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Admin Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@Admin001 or @Admin002"
              required
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
              className="form-control"
            />
          </div>

          <button 
            type="submit" 
            className="login-btn admin-login-btn"
            disabled={loading}
          >
            {loading ? '🔐 Logging in...' : '🔐 Admin Login'}
          </button>

          <div className="login-links">
            <Link to="/login" className="link">
              ← Back to Client Login
            </Link>
            <Link to="/" className="link">
              ← Back to Home
            </Link>
          </div>

          <div className="credentials-hint">
            <h3>⚠️ Admin Access Only</h3>
            <p>This page is restricted to authorized administrators only.</p>
            <p><strong>Valid Credentials:</strong></p>
            <ul>
              <li>Username: <code>@Ad***</code> | Password: <code>Password***</code></li>
              <li>Username: <code>@Ad***</code> | Password: <code>Password***</code></li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;