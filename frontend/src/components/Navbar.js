import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-logo">
          <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
            <h1>📱 Allen Data Hub</h1>
          </Link>
        </div>
        
        {/* Desktop Menu */}
        <div className="navbar-menu desktop">
          <Link to="/">Home</Link>
          <Link to="/plans">Data Plans</Link>
          <Link to="/cart">Cart</Link>
          <Link to="/order-tracking">Track Order</Link>
          <Link to="/admin-dashboard">Dashboard</Link>
          
          {user ? (
            <>
              <Link to="/profile" className="user-profile">
                👤 {user.username}
              </Link>
              <button 
                onClick={handleContactUs}
                className="contact-btn"
              >
                📞 Contact Us
              </button>
              <button 
                onClick={handleLogout}
                className="logout-btn"
              >
                🚪 Logout
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={handleContactUs}
                className="contact-btn"
              >
                📞 Contact Us
              </button>
              <Link to="/login" className="login-btn">Login</Link>
              <Link to="/signup" className="signup-btn">Sign Up</Link>
            </>
          )}
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
          <Link to="/" onClick={() => setIsMenuOpen(false)}>Home</Link>
          <Link to="/plans" onClick={() => setIsMenuOpen(false)}>Data Plans</Link>
          <Link to="/cart" onClick={() => setIsMenuOpen(false)}>Cart</Link>
          <Link to="/order-tracking" onClick={() => setIsMenuOpen(false)}>Track Order</Link>
          <Link to="/admin-dashboard" onClick={() => setIsMenuOpen(false)}>Dashboard</Link>
          
          {user ? (
            <>
              <Link to="/profile" onClick={() => setIsMenuOpen(false)}>
                👤 {user.username}
              </Link>
              <button 
                onClick={() => {
                  handleContactUs();
                  setIsMenuOpen(false);
                }}
                className="contact-btn"
              >
                📞 Contact Us
              </button>
              <button 
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
                className="logout-btn"
              >
                🚪 Logout
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => {
                  handleContactUs();
                  setIsMenuOpen(false);
                }}
                className="contact-btn"
              >
                📞 Contact Us
              </button>
              <Link to="/login" onClick={() => setIsMenuOpen(false)} className="login-btn">Login</Link>
              <Link to="/signup" onClick={() => setIsMenuOpen(false)} className="signup-btn">Sign Up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;