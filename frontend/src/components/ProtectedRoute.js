import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save the location the user was trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If the route requires admin but the user isn't one
  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/client-dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;