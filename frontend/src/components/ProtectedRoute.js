import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ 
  children, 
  requireAdmin = false, 
  requireAgent = false,
  requireClient = false,
  allowedRoles = [] // Optional: specify exact roles that can access
}) => {
  const { user, isAuthenticated, loading, trackActivity } = useAuth();

  // Log for debugging
  useEffect(() => {
    console.log('🔐 Protected Route Check:', {
      isAuthenticated,
      loading,
      userRole: user?.role,
      requireAdmin,
      requireAgent,
      requireClient,
      allowedRoles
    });
  }, [user, isAuthenticated, loading, requireAdmin, requireAgent, requireClient, allowedRoles]);

  // Track activity when user interacts with protected routes
  useEffect(() => {
    const handleActivity = () => {
      if (isAuthenticated) {
        trackActivity?.();
      }
    };

    // Add event listeners for activity tracking
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('❌ Not authenticated, redirecting to login');
    // Redirect to login with return URL
    const currentPath = window.location.pathname + window.location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  // Check if user has required role using flexible role checking
  const getUserRole = () => user?.role?.toLowerCase();
  const currentRole = getUserRole();

  // Check allowed roles first (if specified)
  if (allowedRoles.length > 0) {
    const normalizedAllowedRoles = allowedRoles.map(role => role.toLowerCase());
    if (!normalizedAllowedRoles.includes(currentRole)) {
      console.log(`❌ Role not allowed. User role: ${currentRole}, Allowed: ${allowedRoles}`);
      return redirectBasedOnRole(currentRole);
    }
  }

  // Check specific role requirements
  if (requireAdmin) {
    if (currentRole !== 'admin' && currentRole !== 'administrator') {
      console.log(`❌ Admin access denied. User role: ${currentRole}`);
      return redirectBasedOnRole(currentRole);
    }
  }

  if (requireAgent) {
    if (!['agent', 'admin', 'administrator', 'reseller', 'distributor'].includes(currentRole)) {
      console.log(`❌ Agent access denied. User role: ${currentRole}`);
      return redirectBasedOnRole(currentRole);
    }
  }

  if (requireClient) {
    if (!['client', 'user', 'customer', 'member'].includes(currentRole)) {
      console.log(`❌ Client access denied. User role: ${currentRole}`);
      return redirectBasedOnRole(currentRole);
    }
  }

  console.log('✅ Access granted to protected route');
  return children;
};

// Helper function to redirect based on user role
const redirectBasedOnRole = (userRole) => {
  const role = userRole?.toLowerCase();
  
  if (role === 'admin' || role === 'administrator') {
    return <Navigate to="/admin-dashboard" replace />;
  }
  
  if (role === 'agent' || role === 'reseller' || role === 'distributor') {
    return <Navigate to="/agent-dashboard" replace />;
  }
  
  if (role === 'client' || role === 'user' || role === 'customer' || role === 'member') {
    return <Navigate to="/client-dashboard" replace />;
  }
  
  // Default redirect for unknown roles
  console.log(`⚠️ Unknown role: ${userRole}, redirecting to client dashboard`);
  return <Navigate to="/client-dashboard" replace />;
};

export default ProtectedRoute;