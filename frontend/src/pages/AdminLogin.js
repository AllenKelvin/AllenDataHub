import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Strict requirement check
    const isAdmin1 = username === '@Admin001' && password === 'Password100';
    const isAdmin2 = username === '@Admin002' && password === 'Password200';

    if (isAdmin1 || isAdmin2) {
      const adminUser = {
        name: username === '@Admin001' ? 'Admin One' : 'Admin Two',
        role: 'admin',
        username: username
      };
      
      const token = 'admin-secure-token-' + Date.now();
      
      // Save and update state BEFORE navigating
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(adminUser));
      
      await login(adminUser, token);
      navigate('/admin-dashboard', { replace: true });
    } else {
      setError('Invalid Admin Credentials');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header admin-header">
          <h1>👑 Admin Portal</h1>
          <p>Access management controls</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Admin Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="login-btn">Login as Admin</button>
          <div className="signup-prompt">
            <Link to="/login" className="signup-link">← Back to Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;