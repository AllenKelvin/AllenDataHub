import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { darkMode } = useTheme();
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Logic for client login
      const clientUser = {
        _id: `user-${Date.now()}`,
        email: formData.email,
        name: formData.email.split('@')[0],
        role: 'client',
      };
      const token = 'client-token-' + Date.now();

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(clientUser));
      
      await login(clientUser, token);
      navigate('/client-dashboard', { replace: true });
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`login-page ${darkMode ? 'dark' : ''}`}>
      <div className="login-container">
        <div className="login-header">
          <h1>Welcome Back</h1>
          <p>Login to manage your data bundles</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login to Dashboard'}
          </button>
        </form>

        <div className="special-login-links">
          <p>Are you an admin or agent?</p>
          <div className="special-login-buttons">
            <Link to="/admin-login" className="special-login-btn admin-login-btn">
              <span className="special-login-icon">👑</span>
              Admin Login
            </Link>
            <Link to="/agent-login" className="special-login-btn agent-login-btn">
              <span className="special-login-icon">👤</span>
              Agent Login
            </Link>
          </div>
        </div>

        <div className="signup-prompt">
          <p>Don't have an account?</p>
          <Link to="/signup" className="signup-link">
            Create New Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;