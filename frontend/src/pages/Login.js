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
  const [monkeyEyesClosed, setMonkeyEyesClosed] = useState(false);
  
  const { darkMode, toggleTheme } = useTheme();
  const { login } = useAuth(); 
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login(formData);
      login(response.data.user, response.data.token);
      navigate(response.data.user.role === 'admin' ? '/admin-dashboard' : '/client-dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`login-container ${darkMode ? 'dark' : 'light'}`}>
      <button className="theme-toggle" onClick={toggleTheme}>
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="login-card">
        <div className="portal-logo">
          <div className="logo-icon">🚀</div>
          <h1>AllenDataHub</h1>
        </div>

        {/* --- MONKEY ANIMATION BODY --- */}
        <div className={`monkey-container ${monkeyEyesClosed ? 'eyes-closed' : ''}`}>
          <div className="monkey">
            <div className="face">
              <div className="eye left"><div className="pupil"></div></div>
              <div className="eye right"><div className="pupil"></div></div>
              <div className="nose"></div>
              <div className="mouth"></div>
            </div>
            <div className="hands">
              <div className="hand left-hand"></div>
              <div className="hand right-hand"></div>
            </div>
          </div>
        </div>

        <div className="login-header">
          <h2>Welcome Back</h2>
          <p>Login to manage your data bundles</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              required
              value={formData.email}
              onChange={handleChange}
              onFocus={() => setMonkeyEyesClosed(false)}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter password"
                required
                value={formData.password}
                onChange={handleChange}
                onFocus={() => setMonkeyEyesClosed(true)}
                onBlur={() => setMonkeyEyesClosed(false)}
              />
              <button 
                type="button" 
                className="pwd-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login to Dashboard'}
          </button>
        </form>

        <div className="signup-prompt">
          <p>Don't have an account? <Link to="/signup">Create one</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Login;