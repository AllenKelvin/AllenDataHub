import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  // If we are still checking localStorage, don't redirect yet!
  if (loading) {
    return <div className="full-page-loader">Loading...</div>;
  }

  if (!isAuthenticated) {
    // Redirect to login but save where they were going
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/client-dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;