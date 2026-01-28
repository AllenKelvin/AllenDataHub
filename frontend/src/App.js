import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';

// Components & Pages
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminLogin from './pages/AdminLogin';
import AgentLogin from './pages/AgentLogin';
import ClientDashboard from './pages/ClientDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AgentDashboard from './pages/AgentDashboard';
import UserProfile from './pages/UserProfile';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <Router>
            <Navbar />
            <main className="main-content">
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/agent-login" element={<AgentLogin />} />

                {/* Protected Client Routes */}
                <Route path="/client-dashboard" element={
                  <ProtectedRoute><ClientDashboard /></ProtectedRoute>
                } />
                
                <Route path="/profile" element={
                  <ProtectedRoute><UserProfile /></ProtectedRoute>
                } />

                {/* Protected Admin Routes */}
                <Route path="/admin-dashboard" element={
                  <ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>
                } />

                {/* Protected Agent Routes */}
                <Route path="/agent-dashboard" element={
                  <ProtectedRoute><AgentDashboard /></ProtectedRoute>
                } />

                {/* Default Redirect */}
                <Route path="/" element={<Navigate to="/login" replace />} />
              </Routes>
            </main>
          </Router>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;