import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const AgentLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // For demonstration, accept any email/password
      // In real app, this would call your backend API
      setTimeout(() => {
        if (!email || !password) {
          throw new Error('Please enter email and password');
        }

        // Create agent user object
        const agentUser = {
          _id: `agent-${Date.now()}`,
          email,
          username: email.split('@')[0],
          role: 'agent',
          name: 'Agent User',
          walletBalance: 1000.00,
          createdAt: new Date().toISOString()
        };

        console.log('Agent user created:', agentUser);

        const token = 'agent-token-' + Date.now();
        
        // Store in localStorage directly first
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(agentUser));
        
        // Then use the login function
        login(agentUser, token);
        
        // Force redirect to agent dashboard
        window.location.href = '/agent-dashboard';
        setLoading(false);
      }, 500);

    } catch (error) {
      setError(error.message || 'Login failed. Please check credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header agent-header">
          <h1>👤 Agent Login</h1>
          <p>Access agent dashboard to manage data bundle sales</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">❌</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@allendatahub.com"
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
              placeholder="Enter your password"
              required
              className="form-control"
            />
          </div>

          <button 
            type="submit" 
            className="login-btn agent-login-btn"
            disabled={loading}
          >
            {loading ? '🔐 Logging in...' : '🔐 Agent Login'}
          </button>

          <div className="login-links">
            <Link to="/login" className="link">
              ← Back to Client Login
            </Link>
          </div>

          <div className="support-info">
            <h3>📢 Agent Registration</h3>
            <p>New agents need to be registered by admin. Contact support for agent account creation.</p>
            <div className="support-contact">
              <p><strong>📧 Email:</strong> support@allendatahub.com</p>
              <p><strong>📞 Phone:</strong> +233 54 605 1806</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentLogin;