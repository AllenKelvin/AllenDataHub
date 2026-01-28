import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { cartItems } = useCart();
  const { darkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const totalItems = cartItems?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '👤';
    const parts = name.trim().split(' ');
    return parts.length >= 2 
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() 
      : name.substring(0, 2).toUpperCase();
  };

  return (
    <nav className={`navbar ${darkMode ? 'dark' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-left">
          <Link to="/" className="navbar-brand">
            <span className="brand-icon">📶</span>
            <span className="brand-name">AllenDataHub</span>
          </Link>
        </div>

        <div className="navbar-right">
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {darkMode ? '☀️' : '🌙'}
          </button>

          {user ? (
            <div className="profile-dropdown" ref={dropdownRef}>
              <button className="initials-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
                {getInitials(user.name || user.username)}
              </button>
              {dropdownOpen && (
                <div className="dropdown-menu">
                  <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>Profile Settings</Link>
                  <Link to="/admin-login" className="dropdown-item" onClick={() => setDropdownOpen(false)}>Admin Portal</Link>
                  <Link to="/agent-login" className="dropdown-item" onClick={() => setDropdownOpen(false)}>Agent Portal</Link>
                  <hr />
                  <button className="dropdown-item logout-btn" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="login-link-text">Login</Link>
              <Link to="/signup" className="signup-premium-btn">Sign Up</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;