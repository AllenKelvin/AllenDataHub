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
  
  const { darkMode, toggleTheme } = useTheme();
  const { login } = useAuth(); 
  const navigate = useNavigate();

  // Check for session expired parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionExpired = urlParams.get('session_expired');
    if (sessionExpired === 'true') {
      setShowSessionExpired(true);
    }
  }, []);

  // Handle monkey animation based on password focus
  useEffect(() => {
    if (showPassword) {
      setMonkeyEyesClosed(false);
    }
  }, [showPassword]);

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
      const response = await authAPI.login(formData);
      login(response.data.user, response.data.token);
      
      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('userEmail', formData.email);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('userEmail');
      }
      
      // Redirect based on user role
      const redirectPath = response.data.user.role === 'admin' ? '/admin-dashboard' : '/client-dashboard';
      navigate(redirectPath, { replace: true });
      
    } catch (err) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          'Login failed. Please check your credentials and try again.';
      setError(errorMessage);
      setMonkeyEyesClosed(true); // Monkey closes eyes on error
      
      // Reset monkey eyes after 2 seconds
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

  return (
    <div className={`login-container ${darkMode ? 'dark' : 'light'}`}>
      <button className="theme-toggle" onClick={toggleTheme}>
        {darkMode ? '☀️' : '🌙'}
      </button>

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

        {/* FIXED MONKEY ANIMATION - CORRECTED STRUCTURE */}
        <div className="monkey-container">
          <div className="monkey-emoji">🐵</div>
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
          <a href="/privacy"></a>
          <a href="/terms"></a>
          <a href="/contact"></a>
        </div>
      </div>
    </div>
  );
};

export default Login;