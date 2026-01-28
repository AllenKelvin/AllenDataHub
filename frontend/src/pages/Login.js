import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [monkeyEyesClosed, setMonkeyEyesClosed] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  
  const { darkMode } = useTheme();
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        const userRole = parsedUser.role?.toLowerCase();
        
        // Redirect to appropriate dashboard
        if (userRole === 'admin' || userRole === 'administrator') {
          navigate('/admin-dashboard', { replace: true });
        } else if (userRole === 'agent' || userRole === 'reseller' || userRole === 'distributor') {
          navigate('/agent-dashboard', { replace: true });
        } else {
          navigate('/client-dashboard', { replace: true });
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        // Clear invalid data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, [navigate]);

  // Check for session expired parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionExpired = urlParams.get('session_expired');
    if (sessionExpired === 'true') {
      setShowSessionExpired(true);
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      console.log('Attempting login with email:', formData.email);
      
      // Call the API to authenticate
      const response = await authAPI.login(formData);
      console.log('API Response received:', response.data);
      
      if (!response.data || !response.data.user || !response.data.token) {
        throw new Error('Invalid response from server');
      }

      // Extract user data and token from response
      const { user: userData, token } = response.data;
      
      console.log('User data received:', userData);
      console.log('Token received:', token ? 'Yes' : 'No');
      
      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('userEmail', formData.email);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('userEmail');
      }

      // Call the auth context login function
      console.log('Calling auth context login...');
      const loginResult = login(userData, token);
      console.log('Auth context login result:', loginResult);
      
      if (!loginResult.success) {
        throw new Error(loginResult.error || 'Login failed');
      }
      
      // Wait a moment for auth state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('✅ Login successful! Redirecting to dashboard...');
      
      // Determine role and redirect accordingly
      const userRole = userData.role?.toLowerCase() || loginResult.user?.role?.toLowerCase();
      
      if (userRole === 'admin' || userRole === 'administrator') {
        navigate('/admin-dashboard', { replace: true });
      } else if (userRole === 'agent' || userRole === 'reseller' || userRole === 'distributor') {
        navigate('/agent-dashboard', { replace: true });
      } else {
        navigate('/client-dashboard', { replace: true });
      }
        
    } catch (err) {
      console.error('❌ Login error:', err);
      console.error('Error details:', {
        response: err.response?.data,
        status: err.response?.status,
        message: err.message
      });
      
      let errorMessage = 'Login failed. Please check your credentials and try again.';
      
      if (err.response) {
        if (err.response.status === 401) {
          errorMessage = 'Invalid email or password';
        } else if (err.response.status === 403) {
          errorMessage = 'Account is disabled or not verified';
        } else if (err.response.status === 404) {
          errorMessage = 'User not found';
        } else if (err.response.data?.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data?.message) {
          errorMessage = err.response.data.message;
        }
      } else if (err.request) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setMonkeyEyesClosed(true);
      
      setTimeout(() => {
        setMonkeyEyesClosed(false);
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  // Fill email from localStorage if remember me was checked
  useEffect(() => {
    const remembered = localStorage.getItem('rememberMe');
    const savedEmail = localStorage.getItem('userEmail');
    if (remembered === 'true' && savedEmail) {
      setFormData(prev => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  // Handle monkey animation based on password focus
  useEffect(() => {
    if (showPassword) {
      setMonkeyEyesClosed(false);
    }
  }, [showPassword]);

  return (
    <div className={`login-container ${darkMode ? 'dark' : 'light'}`}>
      <div className="login-card">
        {/* Session Expired Message */}
        {showSessionExpired && (
          <div className="session-expired-message">
            <div className="expired-icon">⏰</div>
            <h3>Session Expired</h3>
            <p>Your session has ended. Please login again to continue.</p>
          </div>
        )}

        <div className="portal-logo">
          <div className="logo-icon">🚀</div>
          <h1>AllenDataHub</h1>
          <p className="logo-subtitle">Data Bundle Management Portal</p>
        </div>

        {/* Monkey Animation */}
        <div className="monkey-container">
          <div className="monkey-emoji"></div>
          <div className={`monkey-eyes ${monkeyEyesClosed ? 'closed' : ''}`}>
            <div className="eye left-eye"></div>
            <div className="eye right-eye"></div>
          </div>
          <div className="welcome-text">
            <h2 className="welcome-title">Welcome Back!</h2>
            <p className="welcome-subtitle">Login to manage your data bundles</p>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <div className="error-icon">⚠️</div>
            <div className="error-text">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="email">
              <span className="label-icon">📧</span>
              Email Address
            </label>
            <div className="input-with-icon">
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter your email address"
                required
                value={formData.email}
                onChange={handleChange}
                onFocus={() => setMonkeyEyesClosed(false)}
                autoComplete="email"
              />
              <div className="input-icon"></div>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">
              <span className="label-icon">🔒</span>
              Password
            </label>
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="Enter your password"
                required
                value={formData.password}
                onChange={handleChange}
                onFocus={() => setMonkeyEyesClosed(true)}
                onBlur={() => setMonkeyEyesClosed(false)}
                autoComplete="current-password"
              />
              <button 
                type="button" 
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="remember-me">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkmark"></span>
              Remember me
            </label>
            <Link to="/forgot-password" className="forgot-password">
              Forgot Password?
            </Link>
          </div>

          <button 
            type="submit" 
            className="submit-btn" 
            disabled={loading || !formData.email || !formData.password}
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Logging in...
              </>
            ) : (
              <>
                <span className="btn-icon">🔐</span>
                Login to Dashboard
              </>
            )}
          </button>

          <div className="divider">
            <span>or continue with</span>
          </div>

          <div className="social-login">
            <button type="button" className="social-btn google-btn">
              <span className="social-icon">🔍</span>
              Sign in with Google
            </button>
            <button type="button" className="social-btn github-btn">
              <span className="social-icon">💻</span>
              Sign in with GitHub
            </button>
          </div>
        </form>

        <div className="signup-prompt">
          <p>Don't have an account? Create one to start buying data bundles!</p>
          <Link to="/signup" className="signup-link">
            <span className="link-icon">✨</span>
            Create New Account
          </Link>
        </div>

        <div className="security-info">
          <p className="security-text">
            <span className="security-icon">🛡️</span>
            Your data is encrypted and securely stored
          </p>
        </div>
      </div>

      <div className="login-footer">
        <p>AllenDataHub © {new Date().getFullYear()} - All rights reserved</p>
        <div className="footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/contact">Contact Us</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;