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
        {/* Brand/Logo */}
        <div className="navbar-left">
          <Link to="/" className="navbar-brand">
            <span className="brand-icon">📶</span>
            <span className="brand-name">AllenDataHub</span>
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        {/* Desktop Navigation */}
        <div className="navbar-right desktop-nav">
          {/* Theme Toggle */}
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>

          {/* Cart - Only visible to clients on their dashboard */}
          {showCart && (
            <Link to="/cart" className="nav-link cart-link">
              <span className="nav-icon">🛒</span>
              Cart
              {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
            </Link>
          )}

          {/* User Profile Dropdown or Login/Signup */}
          {user ? (
            <div className="profile-dropdown" ref={dropdownRef}>
              <button 
                className="nav-link profile-link"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className="user-avatar">{getInitials(getDisplayName())}</span>
              </button>
              
              {dropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <p className="user-name">{getDisplayName()}</p>
                    <p className="user-email">{user.email}</p>
                    {user.role === 'agent' && (
                      <p className="user-balance">Wallet: GH₵{user.walletBalance?.toFixed(2) || '0.00'}</p>
                    )}
                  </div>
                  
                  <Link 
                    to={getDashboardLink()} 
                    className="dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <span className="dropdown-icon">📊</span>
                    Dashboard
                  </Link>
                  
                  {user.role === 'agent' && (
                    <Link 
                      to="/agent-wallet" 
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="dropdown-icon">💰</span>
                      My Wallet
                    </Link>
                  )}
                  
                  <Link 
                    to="/profile" 
                    className="dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <span className="dropdown-icon">⚙️</span>
                    Profile
                  </Link>
                  
                  <hr />
                  
                  <button 
                    className="dropdown-item logout-btn"
                    onClick={handleLogout}
                  >
                    <span className="dropdown-icon">🚪</span>
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                <span className="nav-icon">🔐</span>
                Login
              </Link>
              <Link to="/signup" className="nav-link signup-btn">
                <span className="nav-icon">✨</span>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          {/* User Info in Mobile */}
          {user && (
            <div className="mobile-user-info">
              <div className="mobile-user-avatar">{getInitials(getDisplayName())}</div>
              <div className="mobile-user-details">
                <p className="mobile-user-name">{getDisplayName()}</p>
                <p className="mobile-user-email">{user.email}</p>
                {user.role === 'agent' && (
                  <p className="mobile-user-balance">Balance: GH₵{user.walletBalance?.toFixed(2) || '0.00'}</p>
                )}
              </div>
            </div>
          )}

          {/* Mobile Links */}
          <Link to="/" className="mobile-link">
            <span className="mobile-icon">🏠</span>
            Home
          </Link>
          
          {user && (
            <>
              <Link to={getDashboardLink()} className="mobile-link">
                <span className="mobile-icon">📊</span>
                Dashboard
              </Link>
              
              {user.role === 'agent' && (
                <Link to="/agent-wallet" className="mobile-link">
                  <span className="mobile-icon">💰</span>
                  My Wallet
                </Link>
              )}
              
              {showCart && (
                <Link to="/cart" className="mobile-link">
                  <span className="mobile-icon">🛒</span>
                  Cart
                  {totalItems > 0 && <span className="mobile-cart-badge">{totalItems}</span>}
                </Link>
              )}
              
              <Link to="/profile" className="mobile-link">
                <span className="mobile-icon">⚙️</span>
                Profile
              </Link>
            </>
          )}

          {!user && (
            <>
              <Link to="/login" className="mobile-link">
                <span className="mobile-icon">🔐</span>
                Login
              </Link>
              <Link to="/signup" className="mobile-link">
                <span className="mobile-icon">✨</span>
                Sign Up
              </Link>
            </>
          )}

          {/* Theme Toggle Mobile */}
          <div className="mobile-theme-toggle">
            <button onClick={toggleTheme} className="mobile-theme-btn">
              {darkMode ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}
            </button>
          </div>

          {/* Logout Button */}
          {user && (
            <button onClick={handleLogout} className="mobile-link logout-btn">
              <span className="mobile-icon">🚪</span>
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;