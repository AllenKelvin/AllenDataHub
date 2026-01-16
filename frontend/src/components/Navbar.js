import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
// frontend/src/components/Navbar.js

import './Navbar.css';

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-logo">
          <h1>Allen Data Hub</h1>
        </div>
        
        {/* Desktop Menu */}
        <div className="navbar-menu desktop">
          <a href="/">Home</a>
          <a href="/plans">Data Plans</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/login">Login</a>
        </div>
        
        {/* Mobile Menu Button */}
        <button 
          className="mobile-menu-btn"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          ☰
        </button>
      </div>
      
      {/* Mobile Dropdown Menu */}
      {isMenuOpen && (
        <div className="mobile-dropdown">
          <a href="/" onClick={() => setIsMenuOpen(false)}>Home</a>
          <a href="/plans" onClick={() => setIsMenuOpen(false)}>Data Plans</a>
          <a href="/dashboard" onClick={() => setIsMenuOpen(false)}>Dashboard</a>
          <a href="/login" onClick={() => setIsMenuOpen(false)}>Login</a>
        </div>
      )}
    </nav>
  );
}

const Navbar = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is logged in on component mount and when location changes
  useEffect(() => {
    const userData = localStorage.getItem('user');
    console.log('Navbar checking user data:', userData);
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    } else {
      setUser(null);
    }
  }, [location]); // Re-run when route changes

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
    alert('Logged out successfully!');
  };

  const handleContactUs = () => {
    alert('Contact AllenDataHub:\n\n📞 Phone: 0592786175 / 0546051806\n📧 Email: allenkelvin175@gmail.com\n\n💬 We\'re here to help you with any questions!');
  };

  return (
    <nav style={{ 
      padding: '1rem', 
      backgroundColor: '#1890ff', 
      color: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
          <h2 style={{ margin: 0 }}>📱 AllenDataHub</h2>
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" style={{ marginRight: '1rem', color: 'white', textDecoration: 'none' }}>Home</Link>
          <Link to="/plans" style={{ marginRight: '1rem', color: 'white', textDecoration: 'none' }}>Data Plans</Link>
          <Link to="/cart" style={{ marginRight: '1rem', color: 'white', textDecoration: 'none' }}>Cart</Link>
          <Link to="/order-tracking" style={{ marginRight: '1rem', color: 'white', textDecoration: 'none' }}>Track Order</Link>
          <Link to="/admin-dashboard" style={{ marginRight: '1rem', color: 'white', textDecoration: 'none' }}>Dashboard</Link>
          
          {user ? (
            // Show when user is logged in
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link to="/profile" style={{ 
                color: 'white', 
                textDecoration: 'none',
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '5px',
                fontSize: '0.9rem'
              }}>
                👤 {user.username}
              </Link>
              <button 
                onClick={handleContactUs}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#faad14',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                📞 Contact Us
              </button>
              <button 
                onClick={handleLogout}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#ff4d4f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                🚪 Logout
              </button>
            </div>
          ) : (
            // Show when user is not logged in
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={handleContactUs}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#faad14',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  marginRight: '1rem'
                }}
              >
                📞 Contact Us
              </button>
              <Link to="/login" style={{ 
                color: 'white', 
                textDecoration: 'none',
                padding: '0.5rem 1rem',
                border: '1px solid white',
                borderRadius: '5px'
              }}>Login</Link>
              <Link to="/signup" style={{ 
                color: 'white', 
                textDecoration: 'none',
                padding: '0.5rem 1rem',
                backgroundColor: '#52c41a',
                borderRadius: '5px'
              }}>Sign Up</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
