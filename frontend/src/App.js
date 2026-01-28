import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer'; // Fixed: Added missing import
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import AgentDashboard from './pages/AgentDashboard';
import UserProfile from './pages/UserProfile';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Payment from './pages/Payment';
import PaymentReturn from './components/PaymentReturn';
import PaymentSuccess from './pages/PaymentSuccess';

import './App.css';
import './responsive.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <Router>
            <div className="App">
              <Navbar />
              <main>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  
                  {/* Protected Client Routes */}
                  <Route path="/client-dashboard" element={
                    <ProtectedRoute><ClientDashboard /></ProtectedRoute>
                  } />
                  <Route path="/cart" element={
                    <ProtectedRoute><Cart /></ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute><UserProfile /></ProtectedRoute>
                  } />
                  <Route path="/checkout" element={
                    <ProtectedRoute><Checkout /></ProtectedRoute>
                  } />
                  <Route path="/payment" element={
                    <ProtectedRoute><Payment /></ProtectedRoute>
                  } />
                  <Route path="/payment-return" element={
                    <ProtectedRoute><PaymentReturn /></ProtectedRoute>
                  } />
                  <Route path="/payment-success" element={
                    <ProtectedRoute><PaymentSuccess /></ProtectedRoute>
                  } />

                  {/* Protected Admin/Agent Routes */}
                  <Route path="/admin-dashboard" element={
                    <ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>
                  } />
                  <Route path="/agent-dashboard" element={
                    <ProtectedRoute><AgentDashboard /></ProtectedRoute>
                  } />

                  {/* Default Redirect */}
                  <Route path="/" element={<Navigate to="/login" replace />} />
                </Routes>
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