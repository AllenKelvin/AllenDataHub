import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
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
import ProtectedRoute from './components/ProtectedRoute';
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
                  <Route path="/admin-login" element={<AdminLogin />} />
                  <Route path="/agent-login" element={<AgentLogin />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/cart" element={<Cart />} />
                  
                  {/* Protected Routes */}
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
                    path="/admin-dashboard" 
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminDashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/agent-dashboard" 
                    element={
                      <ProtectedRoute requireAgent={true}>
                        <AgentDashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/client-dashboard" 
                    element={
                      <ProtectedRoute>
                        <ClientDashboard />
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
                  
                  {/* Default and catch-all routes */}
                  <Route path="/" element={<Navigate to="/login" />} />
                  <Route path="*" element={<Navigate to="/login" />} />
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