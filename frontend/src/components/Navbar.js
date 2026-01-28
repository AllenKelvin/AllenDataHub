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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  // Check if user is on client dashboard
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
    setMobileMenuOpen(false);
    navigate('/login');
  };

  // Helper to get initials (e.g., "Allen Kelvin" -> "AK")
  const getInitials = (name) => {
    if (!name) return '👤';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get user's display name
  const getDisplayName = () => {
    if (!user) return '';
    return user.name || user.username || user.email.split('@')[0];
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className={`navbar ${darkMode ? 'dark' : ''}`}>
      <div className="navbar-container">
        {/* Brand/Logo */}
        <div className="navbar-left">
          <Link to="/" className="navbar-brand">
            <span className="brand-icon">📶</span>
            <span className="brand-name">AllenDataHub</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="navbar-right">
          {/* Cart Button - Only visible to clients on their dashboard */}
          {showCart && (
            <button 
              onClick={() => navigate('/cart')}
              className="cart-button"
              aria-label="Cart"
            >
              🛒
              {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
            </button>
          )}

          {user ? (
            <div className="user-menu-container" ref={dropdownRef}>
              {/* User Initials Button */}
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
                <div className="dropdown-menu" role="menu">
                  {/* Profile */}
                  <Link 
                    to="/profile" 
                    className="dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                    role="menuitem"
                  >
                    <span className="dropdown-icon">👤</span>
                    Profile
                  </Link>
                  
                  {/* Theme Toggle */}
                  <button 
                    className="dropdown-item theme-toggle-dropdown"
                    onClick={toggleTheme}
                    role="menuitem"
                  >
                    <span className="dropdown-icon">{darkMode ? '☀️' : '🌙'}</span>
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  
                  {/* Logout */}
                  <button 
                    className="dropdown-item logout-btn"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    <span className="dropdown-icon">🚪</span>
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="login-link">
                <span>🔐</span>
                Login
              </Link>
              <Link to="/signup" className="signup-btn">
                <span>✨</span>
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button 
            className="menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          {/* Cart in Mobile - Only visible to clients on their dashboard */}
          {showCart && (
            <button 
              onClick={() => {
                navigate('/cart');
                setMobileMenuOpen(false);
              }}
              className="dropdown-item"
              style={{width: '100%'}}
            >
              <span className="dropdown-icon">🛒</span>
              Cart
              {totalItems > 0 && <span className="cart-badge" style={{marginLeft: 'auto'}}>{totalItems}</span>}
            </button>
          )}

          {user ? (
            <>
              {/* Profile */}
              <Link 
                to="/profile" 
                className="dropdown-item"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="dropdown-icon">👤</span>
                Profile
              </Link>
              
              {/* Theme Toggle */}
              <button 
                className="dropdown-item theme-toggle-dropdown"
                onClick={toggleTheme}
              >
                <span className="dropdown-icon">{darkMode ? '☀️' : '🌙'}</span>
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              
              {/* Logout */}
              <button 
                className="dropdown-item logout-btn"
                onClick={handleLogout}
              >
                <span className="dropdown-icon">🚪</span>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link 
                to="/login" 
                className="dropdown-item"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="dropdown-icon">🔐</span>
                Login
              </Link>
              <Link 
                to="/signup" 
                className="dropdown-item"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  justifyContent: 'center',
                  fontWeight: '600'
                }}
              >
                <span className="dropdown-icon">✨</span>
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;