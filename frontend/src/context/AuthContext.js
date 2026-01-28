import React, { createContext, useState, useContext, useEffect, useRef } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  
  // Refs for timers
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const activityTimerRef = useRef(null);

  // ========== INACTIVITY TRACKING ==========
  
  // Reset activity timer on user interaction
  const resetInactivityTimer = () => {
    console.log('🔄 Resetting inactivity timer');
    setLastActivity(Date.now());
    setShowWarning(false);
    
    // Clear existing timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    
    // Set new timers
    // Warn user 5 minutes before logout (25 minutes of inactivity)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      console.log('⚠️ 5 minutes until auto-logout');
    }, 25 * 60 * 1000); // 25 minutes
    
    // Auto logout after 30 minutes
    logoutTimerRef.current = setTimeout(() => {
      console.log('⏰ 30 minutes inactivity - Auto logging out');
      handleAutoLogout();
    }, 30 * 60 * 1000); // 30 minutes
  };

  // Track user activity
  const trackActivity = () => {
    if (user) { // Only track if user is logged in
      resetInactivityTimer();
    }
  };

  // Handle auto logout
  const handleAutoLogout = () => {
    console.log('👋 Auto-logout due to inactivity');
    
    // Clear all timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    
    // Perform logout
    logout();
    
    // Redirect to login page with message
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?message=session_expired';
    }
  };

  // ========== AUTH FUNCTIONS ==========

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Start tracking activity when user logs in
      if (parsedUser) {
        resetInactivityTimer();
        
        // Set up activity tracking interval (check every 30 seconds)
        activityTimerRef.current = setInterval(() => {
          const now = Date.now();
          const inactiveTime = now - lastActivity;
          
          if (inactiveTime > 30 * 60 * 1000) {
            // Should have already been logged out by timer, but as backup
            handleAutoLogout();
          }
        }, 30 * 1000); // Check every 30 seconds
      }
    }
    setLoading(false);

    // Cleanup function
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    };
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Reset activity tracking on login
    resetInactivityTimer();
    
    // Show success message
    console.log('✅ User logged in, starting activity tracking');
  };

  const logout = () => {
    console.log('🚪 User logging out');
    
    // Clear timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    
    // Clear state and storage
    setUser(null);
    setShowWarning(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Manual logout with redirect
  const logoutWithRedirect = (redirectTo = '/login') => {
    logout();
    window.location.href = redirectTo;
  };

  // Extend session manually (called when user clicks "Stay Logged In")
  const extendSession = () => {
    console.log('⏱️ User extended session');
    setShowWarning(false);
    resetInactivityTimer();
  };

  const value = {
    user,
    login,
    logout,
    logoutWithRedirect,
    loading,
    isAuthenticated: !!user,
    lastActivity,
    showWarning,
    extendSession,
    trackActivity
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Inactivity Warning Modal */}
      {showWarning && (
        <div className="inactivity-warning-modal">
          <div className="warning-content">
            <div className="warning-icon">⏰</div>
            <h3>Session About to Expire</h3>
            <p>You will be logged out in 5 minutes due to inactivity.</p>
            <div className="warning-actions">
              <button 
                onClick={extendSession}
                className="warning-btn primary"
              >
                Stay Logged In
              </button>
              <button 
                onClick={() => logoutWithRedirect('/login')}
                className="warning-btn secondary"
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Activity Tracker - Listens for user interactions */}
      <div 
        className="activity-tracker"
        onClick={trackActivity}
        onKeyDown={trackActivity}
        onMouseMove={trackActivity}
        onScroll={trackActivity}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9999
        }}
      />
      
      {children}
    </AuthContext.Provider>
  );
};