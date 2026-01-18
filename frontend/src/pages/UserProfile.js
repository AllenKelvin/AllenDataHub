import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { userAPI } from '../services/api';
import './UserProfile.css';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Try to get user data from API first
        try {
          const response = await userAPI.getProfile();
          console.log('👤 Profile API Response:', response.data);
          
          if (response.data) {
            const userData = response.data.user || response.data;
            setUser(userData);
            setFormData({
              name: userData.name || userData.username || '',
              email: userData.email || '',
              phone: userData.phone || '',
              address: userData.address || ''
            });
            
            // Update localStorage with fresh data
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (apiError) {
          console.log('API fetch failed, using localStorage:', apiError.message);
          
          // Fallback to localStorage
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            setFormData({
              name: userData.name || userData.username || '',
              email: userData.email || '',
              phone: userData.phone || '',
              address: userData.address || ''
            });
          }
        }
        
      } catch (error) {
        console.error('Error fetching user data:', error);
        alert('Failed to load profile data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    alert('Logged out successfully!');
    navigate('/login');
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    if (!formData.email) {
      alert('Email is required');
      return;
    }

    setUpdating(true);
    try {
      console.log('Updating profile with:', formData);
      const response = await userAPI.updateProfile(formData);
      
      if (response.data) {
        const updatedUser = response.data.user || response.data;
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        alert('✅ Profile updated successfully!');
      } else {
        throw new Error('No data returned from server');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile: ' + (error.response?.data?.message || error.message || 'Please try again'));
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await userAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      if (response.data.success) {
        alert('✅ Password changed successfully!');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        throw new Error(response.data.message || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Failed to change password: ' + (error.response?.data?.message || error.message || 'Please try again'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    
    if (!contactMessage.trim()) {
      alert('Please enter your message');
      return;
    }

    if (!user?.email) {
      alert('Please update your profile with an email address first');
      return;
    }

    setSendingMessage(true);
    try {
      await userAPI.contactSupport({
        message: contactMessage,
        userId: user?.id || user?._id,
        email: user?.email,
        name: user?.name || user?.username
      });
      
      setContactSent(true);
      setContactMessage('');
      alert('✅ Your message has been sent successfully! We will respond within 24 hours.');
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setContactSent(false);
      }, 5000);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message: ' + (error.response?.data?.message || error.message || 'Please try again'));
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className={`profile-container ${darkMode ? 'dark' : ''}`}>
        <div className="loading">
          <h2>Loading Profile...</h2>
          <p>Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`profile-container ${darkMode ? 'dark' : ''}`}>
      <div className="profile-header">
        <h1>👤 User Profile</h1>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="profile-content">
        {/* Profile Information */}
        <div className="profile-section">
          <h2>Personal Information</h2>
          <div className="user-card">
            <div className="user-avatar">
              <span className="avatar-icon">
                {user?.name?.charAt(0) || user?.username?.charAt(0) || '👤'}
              </span>
            </div>
            <div className="user-details">
              <div className="detail-item">
                <strong>Username:</strong> {user?.username || 'Not set'}
              </div>
              <div className="detail-item">
                <strong>Email:</strong> {user?.email || 'Not set'}
              </div>
              <div className="detail-item">
                <strong>Phone:</strong> {user?.phone || 'Not set'}
              </div>
              <div className="detail-item">
                <strong>Account Type:</strong> <span className="role-badge">Client</span>
              </div>
              <div className="detail-item">
                <strong>Member Since:</strong> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </div>
              <div className="detail-item">
                <strong>Last Updated:</strong> {user?.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Update Profile Form */}
        <div className="profile-section">
          <h2>Update Profile</h2>
          <form className="profile-form" onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Enter your full name"
                disabled={updating}
              />
            </div>
            
            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="Enter your email"
                required
                disabled={updating}
              />
            </div>
            
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="0241234567"
                disabled={updating}
              />
            </div>
            
            <div className="form-group">
              <label>Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Enter your address"
                rows="3"
                disabled={updating}
              />
            </div>
            
            <button 
              type="submit" 
              className="update-btn"
              disabled={updating}
            >
              {updating ? 'Updating...' : 'Update Profile'}
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="profile-section">
          <h2>Change Password</h2>
          <form className="profile-form" onSubmit={handleChangePassword}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                placeholder="Enter current password"
                required
                disabled={changingPassword}
              />
            </div>
            
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                placeholder="Enter new password (min 6 characters)"
                required
                disabled={changingPassword}
              />
            </div>
            
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                placeholder="Confirm new password"
                required
                disabled={changingPassword}
              />
            </div>
            
            <button 
              type="submit" 
              className="update-btn"
              disabled={changingPassword}
            >
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Contact Us Section */}
        <div className="profile-section">
          <h2>Contact Us</h2>
          <div className="contact-card">
            <p>Have questions or need support? Send us a message!</p>
            
            {contactSent && (
              <div className="success-message">
                ✅ Your message has been sent successfully!
              </div>
            )}
            
            <form className="contact-form" onSubmit={handleContactSubmit}>
              <div className="form-group">
                <label>Your Message *</label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Type your message here... Describe your issue or question in detail"
                  rows="5"
                  required
                  disabled={sendingMessage}
                />
              </div>
              
              <div className="contact-info">
                <h4>Support Information</h4>
                <p><strong>📧 Email:</strong> support@portal02.com</p>
                <p><strong>📞 Phone:</strong> +233 24 911 6309</p>
                <p><strong>🕒 Hours:</strong> Monday - Friday, 9:00 AM - 5:00 PM GMT</p>
                <p><strong>📍 Address:</strong> Accra, Ghana</p>
                <p><strong>⚡ Response Time:</strong> Within 24 hours</p>
              </div>
              
              <div className="contact-tips">
                <h4>Tips for faster support:</h4>
                <ul>
                  <li>Include your transaction ID (TRX code) if reporting an issue</li>
                  <li>Describe the problem clearly and concisely</li>
                  <li>Attach screenshots if possible (you can email them)</li>
                  <li>Provide the phone number affected by the issue</li>
                </ul>
              </div>
              
              <button 
                type="submit" 
                className="contact-btn"
                disabled={sendingMessage || !contactMessage.trim()}
              >
                {sendingMessage ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;