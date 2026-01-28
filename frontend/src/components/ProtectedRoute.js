import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, user, loading, trackActivity } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const handleActivity = () => {
      if (isAuthenticated) {
        trackActivity?.();
      }
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [isAuthenticated, trackActivity]);

  // 1. Show loading state while AuthContext initializes
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Verifying session...</p>
      </div>
    );
  }

  // 2. If not authenticated, send to login but save the attempted location
  if (!isAuthenticated) {
    console.log('❌ Not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Admin Check: If route requires admin but user isn't one, send to client dashboard
  if (requireAdmin && user?.role !== 'admin') {
    console.log('🚫 Admin access required, but user is:', user?.role);
    return <Navigate to="/client-dashboard" replace />;
  }

  // 4. Agent Check: If user is an agent trying to access client area, or vice-versa
  // (Optional: Add specific logic here if you want to keep them strictly separated)

  console.log(`✅ Access granted to ${user?.role || 'user'}`);
  return children;
};

export default ProtectedRoute;