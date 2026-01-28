import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import PaymentReturn from './components/PaymentReturn';

// Pages
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import AgentLogin from './pages/AgentLogin';
import Signup from './pages/Signup';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Payment from './pages/Payment';
import PaymentSuccess from './pages/PaymentSuccess';
import AdminDashboard from './pages/AdminDashboard';
import AgentDashboard from './pages/AgentDashboard';
import ClientDashboard from './pages/ClientDashboard';
import UserProfile from './pages/UserProfile';

// Styles
import './App.css';
import './responsive.css';

const AppRoutes = () => {
  return (
    <Routes>
      {/* ==========================================
          1. PUBLIC ROUTES 
          Accessible by everyone
      ========================================== */}
      <Route path="/login" element={<Login />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/agent-login" element={<AgentLogin />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* ==========================================
          2. PROTECTED ROUTES 
          Require authentication to access
      ========================================== */}
      
      {/* Client Routes */}
      <Route 
        path="/client-dashboard" 
        element={
          <ProtectedRoute>
            <ClientDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/cart" 
        element={
          <ProtectedRoute>
            <Cart />
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

      {/* Admin Routes */}
      <Route 
        path="/admin-dashboard" 
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Agent Routes */}
      <Route 
        path="/agent-dashboard" 
        element={
          <ProtectedRoute>
            <AgentDashboard />
          </ProtectedRoute>
        } 
      />

      {/* General Protected Routes */}
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <UserProfile />
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

      {/* ==========================================
          3. FALLBACKS & REDIRECTS
      ========================================== */}
      
      {/* Default to login if path is empty */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Redirect any unknown routes to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
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
              <main className="main-content">
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