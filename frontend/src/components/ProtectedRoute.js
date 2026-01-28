import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  // If the AuthProvider is still reading from localStorage, DO NOT REDIRECT
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="loading-spinner"></div> {/* Ensure this CSS exists or use text */}
        <p>Verifying Access...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save the location they tried to access so we can redirect them back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/client-dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;