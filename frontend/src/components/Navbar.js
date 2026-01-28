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

  // Navigate to admin login
  const goToAdminLogin = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/AdminLogin');
  };

  // Navigate to agent login
  const goToAgentLogin = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/AgentLogin');
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

        {/* Desktop Navigation - Cart and Theme Toggle visible */}
        <div className="navbar-center desktop-nav">
          {/* Cart - Only visible to clients on their dashboard */}
          {showCart && (
            <Link to="/cart" className="nav-link cart-link">
              <span className="nav-icon">🛒</span>
              Cart
              {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
            </Link>
          )}
          
          {/* Theme Toggle - Always visible in desktop */}
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        {/* Desktop Profile Area */}
        <div className="navbar-right desktop-nav">
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
                  
                  <hr />
                  
                  {/* Admin Login Button - Available to all users */}
                  <button 
                    className="dropdown-item admin-btn"
                    onClick={goToAdminLogin}
                  >
                    <span className="dropdown-icon">👑</span>
                    Admin Login
                  </button>
                  
                  {/* Agent Login Button - Available to all users */}
                  <button 
                    className="dropdown-item agent-btn"
                    onClick={goToAgentLogin}
                  >
                    <span className="dropdown-icon">👤</span>
                    Agent Login
                  </button>
                  
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
            </>
          )}

          {/* Admin and Agent Login in Mobile Menu */}
          <button onClick={goToAdminLogin} className="mobile-link admin-btn">
            <span className="mobile-icon">👑</span>
            Admin Login
          </button>
          
          <button onClick={goToAgentLogin} className="mobile-link agent-btn">
            <span className="mobile-icon">👤</span>
            Agent Login
          </button>

          {/* Mobile Theme Toggle - Added here */}
          <button onClick={toggleTheme} className="mobile-link theme-toggle-mobile">
            <span className="mobile-icon">{darkMode ? '☀️' : '🌙'}</span>
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          {/* Logout Button */}
          {user && (
            <button onClick={handleLogout} className="mobile-link logout-btn">
              <span className="mobile-icon">🚪</span>
              Logout
            </button>
          )}

          {/* Login/Signup for non-logged in users */}
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
        </div>
      )}
    </nav>
  );
};

export default Navbar;