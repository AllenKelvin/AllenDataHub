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
      // Mock Agent Login Logic
      const agentUser = {
        _id: `agent-${Date.now()}`,
        email,
        role: 'agent',
        name: 'Data Agent',
      };

      const token = 'agent-token-' + Date.now();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(agentUser));
      
      await login(agentUser, token);
      navigate('/agent-dashboard', { replace: true });
    } catch (err) {
      setError('Agent verification failed');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>👤 Agent Portal</h1>
          <p>Agent Network Login</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Agent Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@allendatahub.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Processing...' : 'Login as Agent'}
          </button>

          <div className="signup-prompt">
            <p><Link to="/login">← Back to Client Login</Link></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentLogin;