import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import './Signup.css';

const Signup = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState(''); // ADD THIS
  const { darkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Password strength calculation
  const calculatePasswordStrength = (password) => {
    if (!password) return { strength: '', width: 0, text: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    if (score <= 2) return { strength: 'weak', width: 30, text: 'Weak' };
    if (score <= 4) return { strength: 'medium', width: 60, text: 'Medium' };
    return { strength: 'strong', width: 100, text: 'Strong' };
  };

  const passwordStrength = calculatePasswordStrength(formData.password);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    setError(''); // Clear error when user types
    setSuccessMessage(''); // Clear success message
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    // Validation
    if (!formData.username || !formData.email || !formData.phone || !formData.password) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (formData.phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid phone number (at least 10 digits)');
      setLoading(false);
      return;
    }

    try {
      console.log('🔐 Attempting registration...');
      
      // Call the real backend API
      const response = await authAPI.register({
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      });

      console.log('✅ Registration successful:', response.data);
      
      // ✅ FIXED: Show success message and redirect to login
      setSuccessMessage('🎉 Account created successfully! Redirecting to login page...');
      
      // Clear form
      setFormData({
        username: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
      });
      
      // Redirect to login page after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Registration error:', error);
      
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.response) {
        errorMessage = error.response.data?.error || 
                      error.response.data?.message || 
                      `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`signup-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Theme Toggle Button */}
      <button className="signup-theme-toggle" onClick={toggleTheme}>
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="signup-card">
        <div className="signup-header">
          <h2>Create Account</h2>
          <p className="signup-subtitle">Join AllenDataHub and start managing your data transactions</p>
        </div>
        
        {/* Success Message */}
        {successMessage && (
          <div className="success-message">
            <span className="success-icon">✅</span>
            <span className="success-text">{successMessage}</span>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="signup-error">
            <span className="error-icon">❌</span>
            <span className="error-text">{error}</span>
          </div>
        )}
        
        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading || !!successMessage} // Disable if success
              className="form-input"
              placeholder="Enter your username"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading || !!successMessage}
              className="form-input"
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              disabled={loading || !!successMessage}
              className="form-input"
              placeholder="e.g., 0241234567"
              autoComplete="tel"
            />
            <small style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
              Format: 0241234567 or 0551234567
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading || !!successMessage}
              className="form-input"
              placeholder="Enter your password"
              autoComplete="new-password"
            />
            {formData.password && !successMessage && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div className={`strength-fill strength-${passwordStrength.strength}`} 
                       style={{ width: `${passwordStrength.width}%` }}></div>
                </div>
                <span className={`strength-text text-${passwordStrength.strength}`}>
                  {passwordStrength.text}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={loading || !!successMessage}
              className="form-input"
              placeholder="Confirm your password"
              autoComplete="new-password"
            />
            {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && !successMessage && (
              <small style={{ color: '#38a169', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                ✓ Passwords match
              </small>
            )}
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={loading || !!successMessage}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Creating Account...
              </>
            ) : successMessage ? (
              'Account Created!'
            ) : (
              <>
                <span className="btn-icon">🚀</span>
                Create Account
              </>
            )}
          </button>
        </form>

        <div className="login-link-container">
          <p>Already have an account?{' '}
            <Link to="/login" className="login-link">
              Login here
            </Link>
          </p>
        </div>

        <div className="database-info">
          <p>
            <strong>Welcome:</strong> Users are securely saved with AllenDataHub
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;