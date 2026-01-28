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

  // Show cart in navbar for all authenticated users (if they have items)
  const showCart = user && totalItems > 0;

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
    
    const userRole = user.role?.toLowerCase();
    
    if (userRole === 'admin' || userRole === 'administrator') {
      return '/admin-dashboard';
    } else if (userRole === 'agent' || userRole === 'reseller' || userRole === 'distributor') {
      return '/agent-dashboard';
    } else {
      return '/client-dashboard';
    }
  };

  // Navigate to admin login
  const goToAdminLogin = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/admin-login');
  };

  // Navigate to agent login
  const goToAgentLogin = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/agent-login');
  };

  // Navigate to profile page
  const goToProfile = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/profile');
  };

  // Navigate to cart
  const goToCart = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/cart');
  };

  // Navigate to checkout
  const goToCheckout = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/checkout');
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

        {/* Desktop Navigation - Cart visible for all logged in users */}
        <div className="navbar-center desktop-nav">
          {/* Cart - Visible to all logged in users who have items */}
          {showCart && (
            <button onClick={goToCart} className="nav-link cart-link">
              <span className="nav-icon">🛒</span>
              Cart
              <span className="cart-badge">{totalItems}</span>
            </button>
          )}
          
          {/* Theme Toggle - Always visible in desktop */}
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Mobile Menu Toggle and Cart Icon */}
        <div className="mobile-header-right">
          {showCart && (
            <button onClick={goToCart} className="mobile-cart-btn">
              <span className="mobile-cart-icon">🛒</span>
              {totalItems > 0 && <span className="mobile-cart-badge">{totalItems}</span>}
            </button>
          )}
          
          <button 
            className="menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

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
                <span className="user-name-short">{getDisplayName()}</span>
              </button>
              
              {dropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <p className="user-name">{getDisplayName()}</p>
                    <p className="user-email">{user.email}</p>
                    <p className="user-role">Role: {user.role || 'client'}</p>
                  </div>
                  
                  <button 
                    onClick={() => {
                      navigate(getDashboardLink());
                      setDropdownOpen(false);
                    }}
                    className="dropdown-item"
                  >
                    <span className="dropdown-icon">📊</span>
                    Dashboard
                  </button>
                  
                  <button 
                    onClick={() => {
                      goToProfile();
                      setDropdownOpen(false);
                    }}
                    className="dropdown-item"
                  >
                    <span className="dropdown-icon">👤</span>
                    Profile
                  </button>
                  
                  {showCart && (
                    <>
                      <button 
                        onClick={() => {
                          goToCart();
                          setDropdownOpen(false);
                        }}
                        className="dropdown-item"
                      >
                        <span className="dropdown-icon">🛒</span>
                        Cart ({totalItems})
                      </button>
                      
                      <button 
                        onClick={() => {
                          goToCheckout();
                          setDropdownOpen(false);
                        }}
                        className="dropdown-item"
                      >
                        <span className="dropdown-icon">💰</span>
                        Checkout
                      </button>
                    </>
                  )}
                  
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
                <p className="mobile-user-role">Role: {user.role || 'client'}</p>
              </div>
            </div>
          )}

          {/* Mobile Links */}
          {user ? (
            <>
              <button 
                onClick={() => {
                  navigate(getDashboardLink());
                  setMobileMenuOpen(false);
                }}
                className="mobile-link"
              >
                <span className="mobile-icon">📊</span>
                Dashboard
              </button>
              
              <button 
                onClick={() => {
                  goToProfile();
                  setMobileMenuOpen(false);
                }}
                className="mobile-link"
              >
                <span className="mobile-icon">👤</span>
                Profile
              </button>
              
              {showCart && (
                <>
                  <button 
                    onClick={() => {
                      goToCart();
                      setMobileMenuOpen(false);
                    }}
                    className="mobile-link"
                  >
                    <span className="mobile-icon">🛒</span>
                    Cart ({totalItems})
                  </button>
                  
                  <button 
                    onClick={() => {
                      goToCheckout();
                      setMobileMenuOpen(false);
                    }}
                    className="mobile-link"
                  >
                    <span className="mobile-icon">💰</span>
                    Checkout
                  </button>
                </>
              )}
            </>
          ) : (
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

          {/* Admin and Agent Login in Mobile Menu */}
          <button onClick={goToAdminLogin} className="mobile-link admin-btn">
            <span className="mobile-icon">👑</span>
            Admin Login
          </button>
          
          <button onClick={goToAgentLogin} className="mobile-link agent-btn">
            <span className="mobile-icon">👤</span>
            Agent Login
          </button>

          {/* Mobile Theme Toggle */}
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
        </div>
      )}
    </nav>
  );
};

export default Navbar;