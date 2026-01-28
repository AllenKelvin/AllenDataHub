import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { darkMode } = useTheme();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 1. Define the variables that were causing the "no-undef" errors
  const isSpecialAdminLogin = location.pathname === '/admin-login';
  const isSpecialAgentLogin = location.pathname === '/agent-login';

  // 2. Define the navigation handler to fix the "reload required" issue
  const handlePortalRedirect = (path) => {
    // useNavigate (navigate) changes the route without a full page refresh
    navigate(path);
  };

  const redirectToDashboard = (userData) => {
    if (userData.role === 'admin' || isSpecialAdminLogin) {
      navigate('/admin-dashboard');
    } else if (userData.role === 'agent' || isSpecialAgentLogin) {
      navigate('/agent-dashboard');
    } else {
      navigate('/client-dashboard');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        redirectToDashboard(parsedUser);
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, location.pathname]); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login(formData);
      if (response.token) {
        login(response.user, response.token);
        redirectToDashboard(response.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`login-page ${darkMode ? 'dark' : ''}`}>
      <div className="login-container">
        <div className="login-header">
          {/* Dynamically update title based on path */}
          <h1>
            {isSpecialAdminLogin ? 'Admin Portal' : 
             isSpecialAgentLogin ? 'Agent Portal' : 'Welcome Back'}
          </h1>
          <p>Login to manage your data bundles</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter your password"
              />
              <button 
                type="button" 
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Improved Portal Section */}
        {!isSpecialAgentLogin && !isSpecialAdminLogin && (
          <div className="special-login-links">
            <p>Staff & Management Portals</p>
            <div className="special-login-buttons">
              <button 
                type="button" 
                onClick={() => handlePortalRedirect('/admin-login')} 
                className="special-portal-btn admin-btn"
              >
                <span className="portal-icon">👑</span>
                <div className="portal-text">
                  <span className="portal-title">Admin Portal</span>
                  <span className="portal-desc">Management Only</span>
                </div>
              </button>

              <button 
                type="button" 
                onClick={() => handlePortalRedirect('/agent-login')} 
                className="special-portal-btn agent-btn"
              >
                <span className="portal-icon">👤</span>
                <div className="portal-text">
                  <span className="portal-title">Agent Portal</span>
                  <span className="portal-desc">Partner Access</span>
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="signup-prompt">
          <p>Don't have an account? <Link to="/signup">Create New Account</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Login;