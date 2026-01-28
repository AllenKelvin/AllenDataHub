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

  const validAdmins = [
    { username: '@Admin001', password: 'Password100' },
    { username: '@Admin002', password: 'Password200' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const isValid = validAdmins.find(a => a.username === username && a.password === password);

    if (isValid) {
      const adminUser = {
        _id: `admin-${username}`,
        username,
        role: 'admin',
        name: username === '@Admin001' ? 'Admin One' : 'Admin Two',
      };
      const token = 'admin-token-' + Date.now();

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(adminUser));
      login(adminUser, token);
      
      // Navigate immediately
      navigate('/admin-dashboard');
    } else {
      setError('Invalid Admin Credentials');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>👑 Admin Portal</h1>
          <p>Management Access Only</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Entering...' : 'Login as Admin'}
          </button>
          <div className="signup-prompt">
            <Link to="/login">← Back to Client Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;