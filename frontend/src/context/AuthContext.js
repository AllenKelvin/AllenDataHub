import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  
  // Refs for timers
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const activityTimerRef = useRef(null);

  // ========== INACTIVITY TRACKING ==========
  
  // Reset activity timer on user interaction
  const resetInactivityTimer = useCallback(() => {
    console.log('🔄 Resetting inactivity timer');
    setLastActivity(Date.now());
    setShowWarning(false);
    
    // Clear existing timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    
    // Set new timers only if user is logged in
    if (user) {
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
    }
  }, [user]);

  // Handle auto logout
  const handleAutoLogout = useCallback(() => {
    console.log('👋 Auto-logout due to inactivity');
    
    // Clear all timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    
    // Perform logout
    logout();
    
    // Redirect to login page with message
    const currentPath = window.location.pathname;
    if (!currentPath.includes('/login') && !currentPath.includes('/signup')) {
      window.location.href = '/login?session_expired=true';
    }
  }, []);

  // Track user activity
  const trackActivity = useCallback(() => {
    if (user) { // Only track if user is logged in
      resetInactivityTimer();
    }
  }, [user, resetInactivityTimer]);

  // ========== AUTH FUNCTIONS ==========

  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        console.log('🔍 Auth initialization:', { token: !!token, userData: !!userData });
        
        if (token && userData) {
          const parsedUser = JSON.parse(userData);
          console.log('📋 Parsed user data:', parsedUser);
          
          // More flexible validation - accept different ID field names
          const userId = parsedUser._id || parsedUser.id || parsedUser.userId;
          
          if (parsedUser && userId) {
            // Ensure consistent structure
            const normalizedUser = {
              ...parsedUser,
              _id: userId,
              id: userId,
              role: parsedUser.role || 'client' // Default to client if no role specified
            };
            
            setUser(normalizedUser);
            setIsAuthenticated(true);
            
            // Start tracking activity
            resetInactivityTimer();
            
            // Set up activity tracking interval (check every 30 seconds)
            activityTimerRef.current = setInterval(() => {
              const now = Date.now();
              const inactiveTime = now - lastActivity;
              
              if (inactiveTime > 30 * 60 * 1000 && user) {
                handleAutoLogout();
              }
            }, 30 * 1000);
            
            console.log('✅ Auth initialized successfully');
          } else {
            console.warn('⚠️ Invalid user data stored, clearing...');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Cleanup function
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    };
  }, [resetInactivityTimer, handleAutoLogout, lastActivity, user]);

  const login = (userData, token) => {
    console.log('🔐 Login called with user data:', userData);
    
    if (!userData || !token) {
      console.error('❌ Login failed: Missing user data or token');
      return {
        success: false,
        error: 'Missing user data or token'
      };
    }
    
    // Flexible user data validation - accept different field names
    const userId = userData._id || userData.id || userData.userId;
    const userEmail = userData.email || userData.Email || userData.username;
    const userRole = userData.role || userData.Role || 'client'; // Default to client
    
    if (!userId || !userEmail) {
      console.error('❌ Login failed: Invalid user data structure', userData);
      return {
        success: false,
        error: 'Invalid user data structure'
      };
    }
    
    // Normalize user data to consistent structure
    const normalizedUser = {
      _id: userId,
      id: userId,
      email: userEmail,
      role: userRole.toLowerCase(), // Ensure lowercase for consistency
      ...userData // Keep all other properties
    };
    
    // Store auth data
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    
    // Update state
    setUser(normalizedUser);
    setIsAuthenticated(true);
    
    // Reset activity tracking
    resetInactivityTimer();
    
    console.log('✅ User logged in successfully:', {
      id: normalizedUser._id,
      email: normalizedUser.email,
      role: normalizedUser.role,
      name: normalizedUser.username || normalizedUser.name || normalizedUser.email
    });
    
    // Set up activity tracking interval
    if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    activityTimerRef.current = setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivity;
      
      if (inactiveTime > 30 * 60 * 1000) {
        handleAutoLogout();
      }
    }, 30 * 1000);
    
    // Return success with user data
    return {
      success: true,
      user: normalizedUser,
      isAdmin: normalizedUser.role === 'admin',
      isAgent: normalizedUser.role === 'agent',
      isClient: normalizedUser.role === 'client' || normalizedUser.role === 'user',
      message: 'Login successful'
    };
  };

  const logout = useCallback(() => {
    console.log('🚪 User logging out');
    
    // Clear timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    
    // Clear state and storage
    setUser(null);
    setIsAuthenticated(false);
    setShowWarning(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    console.log('✅ User logged out successfully');
  }, []);

  // Manual logout with redirect
  const logoutWithRedirect = useCallback((redirectTo = '/login') => {
    console.log(`🔄 Logging out and redirecting to: ${redirectTo}`);
    logout();
    window.location.href = redirectTo;
  }, [logout]);

  // Extend session manually (called when user clicks "Stay Logged In")
  const extendSession = useCallback(() => {
    console.log('⏱️ User extended session');
    setShowWarning(false);
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Get user role safely
  const getUserRole = () => {
    return user?.role || null;
  };

  // Check if user is admin
  const isUserAdmin = () => {
    const role = user?.role;
    return role === 'admin' || role === 'Admin' || role === 'ADMIN';
  };

  // Check if user is client (accepts 'client', 'user', or similar)
  const isUserClient = () => {
    const role = user?.role?.toLowerCase();
    return role === 'client' || role === 'user' || role === 'customer' || role === 'member';
  };

  // Check if user is agent
  const isUserAgent = () => {
    const role = user?.role?.toLowerCase();
    return role === 'agent' || role === 'reseller' || role === 'distributor';
  };

  const value = {
    user,
    login,
    logout,
    logoutWithRedirect,
    loading,
    isAuthenticated,
    getUserRole,
    isUserAdmin,
    isUserClient,
    isUserAgent,
    lastActivity,
    showWarning,
    extendSession,
    trackActivity,
    setUser
  };

  // Inactivity warning modal styles
  const warningModalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    animation: 'fadeIn 0.3s ease'
  };

  const warningContentStyle = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '40px',
    borderRadius: '20px',
    maxWidth: '400px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    color: 'white'
  };

  const warningIconStyle = {
    fontSize: '48px',
    marginBottom: '20px',
    animation: 'pulse 2s infinite'
  };

  const warningActionsStyle = {
    display: 'flex',
    gap: '15px',
    marginTop: '25px',
    justifyContent: 'center'
  };

  const buttonStyle = {
    padding: '12px 24px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    minWidth: '140px'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    background: 'white',
    color: '#764ba2'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    background: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    border: '2px solid white'
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Inactivity Warning Modal */}
      {showWarning && (
        <div style={warningModalStyle}>
          <div style={warningContentStyle}>
            <div style={warningIconStyle}>⏰</div>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '24px' }}>
              Session About to Expire
            </h3>
            <p style={{ margin: '0 0 10px 0', opacity: 0.9 }}>
              You will be logged out in 5 minutes due to inactivity.
            </p>
            <p style={{ margin: '0', fontSize: '14px', opacity: 0.7 }}>
              Click "Stay Logged In" to continue your session.
            </p>
            <div style={warningActionsStyle}>
              <button 
                onClick={extendSession}
                style={primaryButtonStyle}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                Stay Logged In
              </button>
              <button 
                onClick={() => logoutWithRedirect('/login')}
                style={secondaryButtonStyle}
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Activity Tracker - Listens for user interactions */}
      {user && (
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
      )}
      
      {/* Add CSS animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          
          .activity-tracker {
            cursor: none !important;
          }
          
          .activity-tracker:hover {
            cursor: none !important;
          }
        `}
      </style>
      
      {children}
    </AuthContext.Provider>
  );
};