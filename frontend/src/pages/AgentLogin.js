import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const AgentLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // In a real app, this would call your backend API
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // For now, we'll simulate an API call
      setTimeout(() => {
        // This is a placeholder - in real app, validate against your backend
        if (!email || !password) {
          throw new Error('Please enter email and password');
        }

        // Simulate successful login
        const agentUser = {
          email,
          role: 'agent',
          name: 'Agent User',
          walletBalance: 1000.00,
          createdAt: new Date().toISOString()
        };

        // Store in localStorage (temporary solution)
        const token = 'agent-token-' + Date.now();
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(agentUser));
        
        // Redirect to agent dashboard
        navigate('/agent-dashboard');
        setLoading(false);
      }, 1000);

    } catch (error) {
      setError(error.message || 'Login failed. Please check credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
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
            className="login-btn"
            disabled={loading}
          >
            {loading ? '🔐 Logging in...' : '🔐 Agent Login'}
          </button>

          <div className="login-links">
            <Link to="/login" className="link">
              ← Back to Client Login
            </Link>
            <Link to="/" className="link">
              ← Back to Home
            </Link>
          </div>

          <div className="login-info">
            <h3>📢 Agent Registration</h3>
            <p>New agents need to be registered by admin. Contact support for agent account creation.</p>
            <div className="support-info">
              <p><strong>Support Contact:</strong></p>
              <p>📧 support@allendatahub.com</p>
              <p>📞 +233 24 123 4567</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentLogin;