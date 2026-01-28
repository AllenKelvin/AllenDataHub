import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { adminAPI } from '../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, isUserAdmin } = useAuth();
  const { darkMode } = useTheme();
  
  // State declarations
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    pendingVerifications: 0
  });
  const [agents, setAgents] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceUpdates, setPriceUpdates] = useState({
    mtn: { price: '', size: '' },
    telecel: { price: '', size: '' },
    airteltigo: { price: '', size: '' }
  });
  
  // Check if user is admin on component mount
  useEffect(() => {
    console.log('AdminDashboard mounted:', {
      user,
      isAdmin: user?.role === 'admin',
      isAuthenticated: !!user
    });
    
    if (user?.role !== 'admin') {
      console.log('Not admin, redirecting...');
      navigate('/login');
      return;
    }
    
    fetchDashboardData();
  }, [user, navigate]);
  
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch stats
      const statsResponse = await adminAPI.getStats();
      setStats(statsResponse.data);
      
      // Fetch agents
      const agentsResponse = await adminAPI.getAgents();
      setAgents(agentsResponse.data.users || []);
      
      // Fetch pending verifications
      const verificationsResponse = await adminAPI.getPendingVerifications();
      setPendingVerifications(verificationsResponse.data.verifications || []);
      
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAgentAction = async (agentId, action) => {
    try {
      await adminAPI.updateAgentStatus(agentId, action);
      setShowAgentModal(false);
      setSelectedAgent(null);
      fetchDashboardData(); // Refresh data
    } catch (err) {
      console.error('Error updating agent status:', err);
      setError('Failed to update agent status');
    }
  };
  
  const handlePriceUpdate = async (network) => {
    try {
      const data = priceUpdates[network.toLowerCase()];
      if (!data.price || !data.size) {
        setError(`Please enter both price and size for ${network}`);
        return;
      }
      
      await adminAPI.updateDataPlan(network, data);
      setShowPriceModal(false);
      setPriceUpdates({
        mtn: { price: '', size: '' },
        telecel: { price: '', size: '' },
        airteltigo: { price: '', size: '' }
      });
      fetchDashboardData(); // Refresh data
    } catch (err) {
      console.error('Error updating prices:', err);
      setError('Failed to update prices');
    }
  };
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  if (loading) {
    return (
      <div className={`admin-dashboard ${darkMode ? 'dark' : 'light'}`}>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`admin-dashboard ${darkMode ? 'dark' : 'light'}`}>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>Error Loading Dashboard</h3>
          <p>{error}</p>
          <button onClick={fetchDashboardData} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`admin-dashboard ${darkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="admin-header">
        <div className="header-left">
          <h1>Admin Dashboard</h1>
          <p className="welcome-message">
            Welcome back, <span className="admin-name">{user?.username || 'Admin'}</span>
          </p>
        </div>
        <div className="header-right">
          <button className="header-btn" onClick={() => setShowPriceModal(true)}>
            ⚙️ Update Prices
          </button>
          <button className="header-btn logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </header>
      
      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card revenue">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <h3>Total Revenue</h3>
            <p className="stat-value">GH₵{stats.totalRevenue?.toFixed(2) || '0.00'}</p>
            <p className="stat-subtext">Today: GH₵{stats.todayRevenue?.toFixed(2) || '0.00'}</p>
          </div>
        </div>
        
        <div className="stat-card orders">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <h3>Total Orders</h3>
            <p className="stat-value">{stats.totalOrders || 0}</p>
            <p className="stat-subtext">All time orders</p>
          </div>
        </div>
        
        <div className="stat-card users">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>Total Users</h3>
            <p className="stat-value">{stats.totalUsers || 0}</p>
            <p className="stat-subtext">Registered users</p>
          </div>
        </div>
        
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <h3>Pending Verifications</h3>
            <p className="stat-value">{pendingVerifications.length || 0}</p>
            <p className="stat-subtext">Awaiting approval</p>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="admin-content">
        {/* Agents Section */}
        <div className="content-section">
          <div className="section-header">
            <h2>Agents Management</h2>
            <span className="badge">{agents.length} Agents</span>
          </div>
          
          <div className="agents-grid">
            {agents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <p>No agents found</p>
              </div>
            ) : (
              agents.map(agent => (
                <div key={agent._id} className="agent-card">
                  <div className="agent-info">
                    <div className="agent-avatar">
                      {agent.username?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div>
                      <h4>{agent.username}</h4>
                      <p className="agent-email">{agent.email}</p>
                      <span className={`status-badge ${agent.status}`}>
                        {agent.status}
                      </span>
                    </div>
                  </div>
                  <div className="agent-actions">
                    <button 
                      className="action-btn view-btn"
                      onClick={() => {
                        setSelectedAgent(agent);
                        setShowAgentModal(true);
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Pending Verifications */}
        <div className="content-section">
          <div className="section-header">
            <h2>Pending Verifications</h2>
            <span className="badge warning">{pendingVerifications.length} Pending</span>
          </div>
          
          <div className="verifications-list">
            {pendingVerifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <p>No pending verifications</p>
              </div>
            ) : (
              pendingVerifications.map(verification => (
                <div key={verification._id} className="verification-item">
                  <div>
                    <h4>{verification.user?.username}</h4>
                    <p>{verification.user?.email}</p>
                    <small>Submitted: {new Date(verification.createdAt).toLocaleDateString()}</small>
                  </div>
                  <div className="verification-actions">
                    <button className="approve-btn">Approve</button>
                    <button className="reject-btn">Reject</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Agent Modal */}
      {showAgentModal && selectedAgent && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Agent Details</h3>
              <button className="close-btn" onClick={() => setShowAgentModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="agent-details">
                <div className="detail-row">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{selectedAgent.username}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{selectedAgent.email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Phone:</span>
                  <span className="detail-value">{selectedAgent.phone || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className={`status-badge ${selectedAgent.status}`}>
                    {selectedAgent.status}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Joined:</span>
                  <span className="detail-value">
                    {new Date(selectedAgent.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn secondary"
                onClick={() => setShowAgentModal(false)}
              >
                Close
              </button>
              <button 
                className="modal-btn danger"
                onClick={() => handleAgentAction(selectedAgent._id, 'suspended')}
              >
                Suspend Agent
              </button>
              <button 
                className="modal-btn success"
                onClick={() => handleAgentAction(selectedAgent._id, 'active')}
              >
                Activate Agent
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Price Update Modal */}
      {showPriceModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Update Data Plan Prices</h3>
              <button className="close-btn" onClick={() => setShowPriceModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="price-update-form">
                {['MTN', 'Telecel', 'AirtelTigo'].map(network => (
                  <div key={network} className="price-input-group">
                    <h4>{network}</h4>
                    <div className="input-row">
                      <input
                        type="text"
                        placeholder="Size (e.g., 1GB)"
                        value={priceUpdates[network.toLowerCase()].size}
                        onChange={(e) => setPriceUpdates(prev => ({
                          ...prev,
                          [network.toLowerCase()]: {
                            ...prev[network.toLowerCase()],
                            size: e.target.value
                          }
                        }))}
                      />
                      <input
                        type="number"
                        placeholder="Price (GHS)"
                        value={priceUpdates[network.toLowerCase()].price}
                        onChange={(e) => setPriceUpdates(prev => ({
                          ...prev,
                          [network.toLowerCase()]: {
                            ...prev[network.toLowerCase()],
                            price: e.target.value
                          }
                        }))}
                        step="0.01"
                        min="0"
                      />
                      <button 
                        className="update-btn"
                        onClick={() => handlePriceUpdate(network)}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn secondary"
                onClick={() => setShowPriceModal(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-btn primary"
                onClick={() => {
                  // Update all prices
                  ['MTN', 'Telecel', 'AirtelTigo'].forEach(network => {
                    if (priceUpdates[network.toLowerCase()].price && 
                        priceUpdates[network.toLowerCase()].size) {
                      handlePriceUpdate(network);
                    }
                  });
                }}
              >
                Update All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;