import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';

const Navbar = () => {
  const { cartItems } = useCart();
  const { darkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    
    // Listen for storage changes (for login/logout)
    const handleStorageChange = () => {
      const updatedUser = localStorage.getItem('user');
      setUser(updatedUser ? JSON.parse(updatedUser) : null);
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
    window.location.reload(); // Force refresh to update navbar
  };

  const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <nav className={`navbar ${darkMode ? 'dark' : ''}`}>
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
        <div className="mobile-menu">
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