import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import './Navbar.css';

const Navbar = () => {
  const { darkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { cartItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const isOnClientDashboard = location.pathname.includes('/client-dashboard');
  const showCart = user && user.role === 'client' && isOnClientDashboard;

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

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    if (!user) return '';
    return user.name || user.username || user.email.split('@')[0];
  };

  // Dashboard link based on user role
  const getDashboardLink = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'admin': return '/admin-dashboard';
      case 'agent': return '/agent-dashboard';
      default: return '/client-dashboard';
    }
  };

  return (
    <nav className={`navbar ${darkMode ? 'dark' : ''}`}>
      <div className="navbar-container">
        {/* Left: Brand Logo */}
        <Link to="/" className="navbar-brand">
          <span>📶</span>
          <span className="brand-name">AllenDataHub</span>
        </Link>

        {/* Right: Navigation Items */}
        <div className="navbar-right">
          {user ? (
            <>
              {/* Cart Button (only for clients on dashboard) */}
              {showCart && (
                <button 
                  className="cart-btn"
                  onClick={() => navigate('/cart')}
                  aria-label="Cart"
                >
                  🛒
                  {totalItems > 0 && (
                    <span className="cart-badge">{totalItems}</span>
                  )}
                </button>
              )}

              {/* User Initials Button with Dropdown */}
              <div className="dropdown-container" ref={dropdownRef}>
                <button
                  className="user-initials-btn"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-label="User menu"
                  aria-expanded={dropdownOpen}
                >
                  {getInitials(getDisplayName())}
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="dropdown-menu">
                    {/* Dashboard Link - First Item */}
                    <Link
                      to="/client-dashboard" 
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span>📊</span>
                      Dashboard
                    </Link>

                    {/* Profile Link */}
                    <Link
                      to="/profile"
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span>👤</span>
                      Profile
                    </Link>

                    {/* Theme Toggle */}
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        toggleTheme();
                        setDropdownOpen(false);
                      }}
                    >
                      <span>{darkMode ? '☀️' : '🌙'}</span>
                      {darkMode ? 'Light Mode' : 'Dark Mode'}
                    </button>

                    {/* Logout Button */}
                    <button
                      className="dropdown-item"
                      onClick={handleLogout}
                    >
                      <span>🚪</span>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="login-btn">
                Login
              </Link>
              <Link to="/signup" className="signup-btn">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;