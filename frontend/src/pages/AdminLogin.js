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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isValid = validAdmins.find(a => a.username === username && a.password === password);
      if (!isValid) throw new Error('Invalid Admin Credentials');

      const adminUser = {
        _id: `admin-${username}`,
        username,
        role: 'admin',
        name: username === '@Admin001' ? 'Admin One' : 'Admin Two',
      };

      const token = 'admin-token-' + Date.now();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(adminUser));
      
      await login(adminUser, token);
      navigate('/admin-dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>👑 Admin Portal</h1>
          <p>Secure Management Access</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Admin Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@Admin001"
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
            {loading ? 'Verifying...' : 'Login as Admin'}
          </button>

          <div className="signup-prompt">
            <p><Link to="/login">← Back to Client Login</Link></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;