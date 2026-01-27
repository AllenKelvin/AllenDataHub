import React, { useState, useContext, useEffect, useRef } from 'react';
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
    navigate('/login');
  };

  // Helper to get initials (e.g., "Allen Kelvin" -> "AK")
  const getInitials = (name) => {
    if (!name) return '👤';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  // Get user's display name
  const getDisplayName = () => {
    if (!user) return '';
    return user.name || user.username || user.email.split('@')[0];
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

        {/* User Greeting - Only show when logged in */}
        {user && (
          <div className="navbar-center">
            <div className="user-greeting">
              👋 Welcome back, <span className="username">{getDisplayName()}</span>!
            </div>
          </div>
        )}

        {/* Right Side Navigation */}
        <div className="navbar-right">
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
                <span className="nav-icon">👤</span>
                {getDisplayName()}
              </button>
              
              {dropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <p className="user-name">{getDisplayName()}</p>
                    <p className="user-email">{user.email}</p>
                  </div>
                  
                  {user.role === 'client' && (
                    <>
                      <Link 
                        to="/client-dashboard" 
                        className="dropdown-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <span className="dropdown-icon">📊</span>
                        Dashboard
                      </Link>
                      <Link 
                        to="/profile" 
                        className="dropdown-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <span className="dropdown-icon">⚙️</span>
                        Profile Settings
                      </Link>
                      <Link 
                        to="/orders" 
                        className="dropdown-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <span className="dropdown-icon">📦</span>
                        My Orders
                      </Link>
                      <Link 
                        to="/transactions" 
                        className="dropdown-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <span className="dropdown-icon">💳</span>
                        Transactions
                      </Link>
                    </>
                  )}
                  
                  {user.role === 'admin' && (
                    <Link 
                      to="/admin-dashboard" 
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="dropdown-icon">👑</span>
                      Admin Dashboard
                    </Link>
                  )}
                  
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
    </nav>
  );
};

export default Navbar;