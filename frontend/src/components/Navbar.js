import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const dropdownRef = useRef(null);

  const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  // Helper to get initials (e.g., "Allen Kelvin" -> "AK")
  const getInitials = (name) => {
    if (!name) return '👤';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <nav className={`navbar ${darkMode ? 'dark' : ''}`}>
      <div className="navbar-container">
        {/* Brand/Logo */}
        <div className="navbar-left">
          <Link to="/" className="navbar-brand">
            <span className="brand-icon">📶</span>
            <span className="brand-text">AllenDataHub</span>
          </Link>
        </div>

        {/* Right Side Icons */}
        <div className="navbar-right">
          {/* Theme Toggle (Optional - kept for convenience) */}
          <button onClick={toggleTheme} className="header-icon-btn">
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Direct Cart Access */}
          <Link to="/cart" className="header-icon-btn">
            <span className="cart-wrapper">
              🛒
              {totalItems > 0 && <span className="cart-count-badge">{totalItems}</span>}
            </span>
          </Link>

          {/* User Initials / Profile Circle */}
          {user ? (
            <div className="profile-dropdown-container" ref={dropdownRef}>
              <div 
                className="user-avatar-circle" 
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {getInitials(user.name)}
              </div>

              {dropdownOpen && (
                <div className="profile-menu-dropdown">
                  <div className="dropdown-header">
                    <p className="user-name">{user.name}</p>
                    <p className="user-email">{user.email}</p>
                  </div>
                  <hr />
                  <Link to="/dashboard" onClick={() => setDropdownOpen(false)}>📊 Dashboard</Link>
                  <Link to="/profile" onClick={() => setDropdownOpen(false)}>👤 Profile Settings</Link>
                  <button onClick={handleLogout} className="logout-dropdown-btn">🚪 Logout</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="login-btn-header">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;