import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If the user was redirected here, we know where to send them back
  const from = location.state?.from?.pathname || "/client-dashboard";

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const userData = { email, name: email.split('@')[0], role: 'client' };
    const token = 'user-token-' + Date.now();

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));

    await login(userData, token);
    
    // Use 'replace' to prevent going back to login screen with back button
    navigate(from, { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Welcome Back</h1>
          <p>Login to your client dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="login-btn">Login to Account</button>
        </form>
        <div className="special-login-links">
           <Link to="/admin-login" className="special-login-btn admin-login-btn">👑 Admin</Link>
           <Link to="/agent-login" className="special-login-btn agent-login-btn">👤 Agent</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;