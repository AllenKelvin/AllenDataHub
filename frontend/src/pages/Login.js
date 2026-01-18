import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [monkeyEyesClosed, setMonkeyEyesClosed] = useState(false);
  const { darkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      // User is already logged in, redirect to appropriate dashboard
      const userData = JSON.parse(user);
      if (userData.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/client-dashboard');
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (formData.password.length > 0) {
      setMonkeyEyesClosed(true);
    } else {
      setMonkeyEyesClosed(false);
    }
  }, [formData.password]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔐 Attempting login with:', { email: formData.email });
      
      // Call the backend API
      const response = await authAPI.login({
        email: formData.email,
        password: formData.password
      });

      console.log('✅ Login successful response:', response.data);
      
      if (response.data && response.data.token) {
        // Save token and user data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        console.log('💾 User data saved to localStorage:', response.data.user);
        
        // Show success message
        setError(''); // Clear any previous errors
        
        // Redirect based on user role
        setTimeout(() => {
          if (response.data.user.role === 'admin') {
            window.location.href = '/admin-dashboard';
          } else {
            window.location.href = '/client-dashboard';
          }
        }, 500);
        
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      
      let errorMessage = 'Login failed. Please check your credentials.';
      
      if (error.response) {
        // Server responded with error
        errorMessage = error.response.data?.error || 
                      error.response.data?.message || 
                      `Server error: ${error.response.status}`;
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'Network error. Please check your internet connection.';
      } else {
        // Something else happened
        errorMessage = error.message || 'An unexpected error occurred.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`login-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Theme Toggle Button */}
      <button className="theme-toggle" onClick={toggleTheme}>
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="login-card">
        {/* AllenDataHub Logo */}
        <div className="portal-logo">
          <div className="logo-icon">📊</div>
          <h1>AllenDataHub</h1>
          <p className="logo-subtitle">Secure Data Transactions Platform</p>
        </div>
        
        {/* Animated Monkey */}
        <div className="monkey-container">
          <div className="monkey-emoji">
            <span>🐵</span>
            <div className={`monkey-eyes ${monkeyEyesClosed ? 'closed' : ''}`}>
              <div className="eye left-eye"></div>
              <div className="eye right-eye"></div>
            </div>
          </div>
          <h2 className="welcome-title">Welcome Back! 👋</h2>
          <p className="welcome-subtitle">Sign in to manage your data transactions</p>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="error-message">
            <span className="error-icon">❌</span>
            <span className="error-text">{error}</span>
          </div>
        )}
        
        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="email">
              <span className="label-icon">📧</span>
              Email Address *
            </label>
            <div className="input-with-icon">
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Enter your email address"
                autoComplete="email"
              />
              <span className="input-icon">📧</span>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">
              <span className="label-icon">🔒</span>
              Password *
            </label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button 
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="form-options">
            <label className="remember-me">
              <input type="checkbox" />
              <span className="checkmark"></span>
              Remember me
            </label>
            <Link to="/forgot-password" className="forgot-password">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Logging in...
              </>
            ) : (
              <>
                <span className="btn-icon">🚀</span>
                Login to Dashboard
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="divider">
          <span>or</span>
        </div>

        {/* Social Login (Optional) */}
        <div className="social-login">
          <button type="button" className="social-btn google-btn">
            <span className="social-icon">🔍</span>
            Continue with Google
          </button>
          <button type="button" className="social-btn github-btn">
            <span className="social-icon">💻</span>
            Continue with GitHub
          </button>
        </div>

        {/* Sign Up Link */}
        <div className="signup-prompt">
          <p>Don't have an account?</p>
          <Link to="/signup" className="signup-link">
            <span className="link-icon">📝</span>
            Create new account
          </Link>
        </div>

        {/* Security Info */}
        <div className="security-info">
          <p className="security-text">
            <span className="security-icon">🔐</span>
            Your login is secured with 256-bit SSL encryption
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="login-footer">
        <p>© 2024 AllenDataHub. All rights reserved.</p>
        <div className="footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/contact">Contact Support</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;