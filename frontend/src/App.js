import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Cart from './pages/Cart';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Checkout from './pages/Checkout';
import Payment from './pages/Payment';
import PaymentReturn from './components/PaymentReturn';
import PaymentSuccess from './pages/PaymentSuccess';
import AdminDashboard from './pages/AdminDashboard';
import AgentDashboard from './pages/AgentDashboard';
import UserProfile from './pages/UserProfile';
import ClientDashboard from './pages/ClientDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';
import './responsive.css';

// Component to handle redirects based on authentication
const AppRoutes = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Helper function to get dashboard link based on user role
  const getDashboardLink = () => {
    if (!user) return '/login';
    
    const userRole = user.role?.toLowerCase();
    
    if (userRole === 'admin' || userRole === 'administrator') {
      return '/admin-dashboard';
    } else if (userRole === 'agent' || userRole === 'reseller' || userRole === 'distributor') {
      return '/agent-dashboard';
    } else {
      return '/client-dashboard';
    }
  };

  // Show loading spinner while auth state is being determined
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/admin-login" element={<Login />} />
      <Route path="/agent-login" element={<Login />} />
      <Route path="/cart" element={<Cart />} />
      
      {/* Protected Routes */}
      <Route 
        path="/client-dashboard" 
        element={
          <ProtectedRoute>
            <ClientDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/admin-dashboard" 
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/agent-dashboard" 
        element={
          <ProtectedRoute>
            <AgentDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/checkout" 
        element={
          <ProtectedRoute>
            <Checkout />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/payment" 
        element={
          <ProtectedRoute>
            <Payment />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/payment-return" 
        element={
          <ProtectedRoute>
            <PaymentReturn />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/payment-success" 
        element={
          <ProtectedRoute>
            <PaymentSuccess />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        } 
      />
      
      {/* Root path redirect */}
      <Route 
        path="/" 
        element={
          user ? <Navigate to={getDashboardLink()} replace /> : <Navigate to="/login" replace />
        } 
      />
      
      {/* Catch-all route */}
      <Route 
        path="*" 
        element={
          user ? <Navigate to={getDashboardLink()} replace /> : <Navigate to="/login" replace />
        } 
      />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <Router>
            <div className="App">
              <Navbar />
              <main>
                <AppRoutes />
              </main>
              <Footer />
            </div>
          </Router>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;