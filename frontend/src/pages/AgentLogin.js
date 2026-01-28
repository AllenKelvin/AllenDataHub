import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const AgentLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    const agentUser = {
      _id: `agent-${Date.now()}`,
      email,
      role: 'agent',
      name: 'Data Agent',
    };
    const token = 'agent-token-' + Date.now();

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(agentUser));
    login(agentUser, token);

    navigate('/agent-dashboard');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>👤 Agent Portal</h1>
          <p>Partner Network Access</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Agent Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Loading...' : 'Login as Agent'}
          </button>
          <div className="signup-prompt">
            <Link to="/login">← Back to Client Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentLogin;