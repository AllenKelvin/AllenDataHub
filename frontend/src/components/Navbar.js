import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext'; // ADD THIS
import './Navbar.css';

const Navbar = () => {
  const { cartItems } = useCart();
  const { darkMode, toggleTheme } = useTheme();
  const { user, logout, trackActivity } = useAuth(); // UPDATE THIS
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Track activity when user interacts with navbar
  const handleNavbarActivity = () => {
    if (user) {
      trackActivity?.();
    }
  };

  useEffect(() => {
    // Add activity tracking to navbar interactions
    const navbarElements = document.querySelectorAll('.navbar a, .navbar button');
    navbarElements.forEach(element => {
      element.addEventListener('click', handleNavbarActivity);
      element.addEventListener('mouseenter', handleNavbarActivity);
    });

    return () => {
      navbarElements.forEach(element => {
        element.removeEventListener('click', handleNavbarActivity);
        element.removeEventListener('mouseenter', handleNavbarActivity);
      });
    };
  }, [user, trackActivity]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    // No need to reload - AuthContext will handle state update
  };

  const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <nav className={`navbar ${darkMode ? 'dark' : ''}`} onClick={handleNavbarActivity}>
      <div className="navbar-container">
        {/* Left Side - Brand */}
        <div className="navbar-left">
          <Link to="/" className="navbar-brand">
            <span className="brand-icon">📊</span>
            <span className="brand-name">AllenDataHub</span>
          </Link>
        </div>

        {/* Center - User Greeting */}
        <div className="navbar-center">
          {user && (
            <div className="user-greeting">
              Welcome, <span className="username">{user.username || user.name || 'User'}</span>
            </div>
          )}
        </div>

        {/* Right Side - Navigation Links */}
        <div className="navbar-right">
          {/* Theme Toggle */}
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>

          {user ? (
            <>
              {/* Dashboard Link */}
              <Link to="/client-dashboard" className="nav-link">
                <span className="nav-icon">📊</span>
                Dashboard
              </Link>
              
              {/* Cart Link */}
              <Link to="/cart" className="nav-link cart-link">
                <span className="nav-icon">🛒</span>
                Cart
                {totalItems > 0 && (
                  <span className="cart-badge">{totalItems}</span>
                )}
              </Link>

              {/* Profile Dropdown */}
              <div className="profile-dropdown">
                <Link to="/profile" className="nav-link profile-link">
                  <span className="nav-icon">👤</span>
                  Profile
                </Link>
                <div className="dropdown-menu">
                  <Link to="/profile" className="dropdown-item">
                    <span className="dropdown-icon">👤</span>
                    My Profile
                  </Link>
                  <button className="dropdown-item" onClick={handleLogout}>
                    <span className="dropdown-icon">🚪</span>
                    Logout
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                <span className="nav-icon">🔐</span>
                Login
              </Link>
              <Link to="/signup" className="nav-link signup-btn">
                <span className="nav-icon">📝</span>
                Sign Up
              </Link>
            </>
          )}

          {/* Mobile Menu Toggle */}
          <button 
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="mobile-menu" onClick={handleNavbarActivity}>
          {user ? (
            <>
              <Link to="/client-dashboard" className="mobile-link" onClick={() => setMenuOpen(false)}>
                <span className="mobile-icon">📊</span>
                Dashboard
              </Link>
              <Link to="/cart" className="mobile-link" onClick={() => setMenuOpen(false)}>
                <span className="mobile-icon">🛒</span>
                Cart ({totalItems})
              </Link>
              <Link to="/profile" className="mobile-link" onClick={() => setMenuOpen(false)}>
                <span className="mobile-icon">👤</span>
                Profile
              </Link>
              <button className="mobile-link logout-btn" onClick={() => {
                handleLogout();
                setMenuOpen(false);
              }}>
                <span className="mobile-icon">🚪</span>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="mobile-link" onClick={() => setMenuOpen(false)}>
                <span className="mobile-icon">🔐</span>
                Login
              </Link>
              <Link to="/signup" className="mobile-link" onClick={() => setMenuOpen(false)}>
                <span className="mobile-icon">📝</span>
                Sign Up
              </Link>
            </>
          )}
          
          <div className="mobile-theme-toggle">
            <button onClick={toggleTheme} className="mobile-theme-btn">
              {darkMode ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;