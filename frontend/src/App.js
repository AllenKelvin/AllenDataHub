import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
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
import AdminLogin from './pages/AdminLogin';
import AgentLogin from './pages/AgentLogin';
import './App.css';
import './responsive.css';

// Main App Component
function AppContent() {
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    console.log('App auth state:', { 
      user, 
      isAuthenticated, 
      loading,
      role: user?.role 
    });
  }, [user, isAuthenticated, loading]);

  return (
    <div className="App">
      <Navbar />
      <main>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/agent-login" element={<AgentLogin />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/payment-return" element={<PaymentReturn />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          
          {/* Protected Routes */}
          <Route path="/client-dashboard" element={
            <ProtectedRoute>
              <ClientDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/admin-dashboard" element={
            <ProtectedRoute requireAdmin={true}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/agent-dashboard" element={
            <ProtectedRoute requireAgent={true}>
              <AgentDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/user-profile" element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          } />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

// Main App Wrapper
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;