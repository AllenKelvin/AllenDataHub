import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const AgentLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const agentData = { 
        name: 'Field Agent', 
        role: 'agent', 
        email,
        username: email.split('@')[0] 
      };
      const token = 'agent-token-' + Date.now();
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(agentData));
      await login(agentData, token);
      navigate('/agent-dashboard', { replace: true });
    } catch (err) {
      setError('Agent authentication failed.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header agent-header">
          <h1>👤 Agent Portal</h1>
          <p>Agent Network Login</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Agent Email</label>
            <input 
              type="email" 
              placeholder="agent@allendatahub.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Processing...' : 'Login as Agent'}
          </button>

          <div className="signup-prompt">
            <Link to="/login" className="signup-link">
              ← Back to Main Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentLogin;