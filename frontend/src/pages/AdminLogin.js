import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Strict requirement: Only these credentials work
    const isAdmin1 = username === '@Admin001' && password === 'Password100';
    const isAdmin2 = username === '@Admin002' && password === 'Password200';

    if (isAdmin1 || isAdmin2) {
      const adminData = {
        name: username === '@Admin001' ? 'Admin One' : 'Admin Two',
        role: 'admin',
        username: username
      };
      const token = 'admin-secure-token-' + Date.now();
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(adminData));
      await login(adminData, token);
      navigate('/admin-dashboard', { replace: true });
    } else {
      setError('Access Denied: Invalid Admin Credentials');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header admin-header">
          <h1>👑 Admin Portal</h1>
          <p>Secure Management Access</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Admin Username</label>
            <input 
              type="text" 
              placeholder="@Admin001" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label>Admin Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Verifying...' : 'Login as Admin'}
          </button>

          <div className="signup-prompt">
            <Link to="/login" className="signup-link">
              ← Back to Main Login
            </Link>
          </div>
        </form>

        <div className="credentials-hint">
          <h3>⚠️ Admin Notice</h3>
          <p>Please use authorized credentials provided by AllenDataHub system.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;