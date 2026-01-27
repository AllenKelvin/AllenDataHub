// src/pages/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { adminAPI } from '../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalSales: 0,
    totalCommission: 0,
    pendingAgents: 0,
    totalWalletBalance: 0
  });
  const [agents, setAgents] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceUpdates, setPriceUpdates] = useState({});

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch admin stats
      const statsResponse = await adminAPI.getStats();
      if (statsResponse.data && statsResponse.data.success) {
        setStats(statsResponse.data.stats);
      }

      // Fetch agents list
      const agentsResponse = await adminAPI.getAgents();
      if (agentsResponse.data && agentsResponse.data.success) {
        setAgents(agentsResponse.data.agents);
        setPendingVerifications(
          agentsResponse.data.agents.filter(agent => agent.status === 'pending')
        );
      }

    } catch (error) {
      console.error('❌ Error fetching admin data:', error);
      setError('Failed to load admin dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAgent = async (agentId, approve) => {
    try {
      const response = await adminAPI.verifyAgent(agentId, approve);
      if (response.data && response.data.success) {
        alert(response.data.message);
        fetchAdminData(); // Refresh data
      }
    } catch (error) {
      console.error('Verification error:', error);
      alert('Failed to process verification.');
    }
  };

  const handleLoadWallet = async (agentId, amount) => {
    const amountValue = parseFloat(amount);
    if (!amountValue || amountValue <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const response = await adminAPI.loadAgentWallet(agentId, amountValue);
      if (response.data && response.data.success) {
        alert(`Successfully loaded GHS ${amountValue} to agent's wallet`);
        setShowAgentModal(false);
        fetchAdminData();
      }
    } catch (error) {
      console.error('Wallet load error:', error);
      alert('Failed to load wallet.');
    }
  };

  const handleUpdatePrices = async (network, updates) => {
    try {
      const response = await adminAPI.updateAgentPrices(network, updates);
      if (response.data && response.data.success) {
        alert('Agent prices updated successfully');
        setShowPriceModal(false);
        fetchAdminData();
      }
    } catch (error) {
      console.error('Price update error:', error);
      alert('Failed to update prices.');
    }
  };

  const handlePriceChange = (planId, newPrice) => {
    setPriceUpdates(prev => ({
      ...prev,
      [planId]: parseFloat(newPrice)
    }));
  };

  if (loading) {
    return (
      <div className={`loading-container ${darkMode ? 'dark' : ''}`}>
        <div className="loading-spinner"></div>
        <h2>Loading Admin Dashboard...</h2>
      </div>
    );
  }

  return (
    <div className={`admin-dashboard ${darkMode ? 'dark' : ''}`}>
      {error && (
        <div className="error-message">
          <span className="error-icon">❌</span>
          <span className="error-text">{error}</span>
          <button className="retry-btn" onClick={fetchAdminData}>
            Retry
          </button>
        </div>
      )}

      <div className="dashboard-header">
        <h1>👑 Admin Dashboard</h1>
        <button className="refresh-btn" onClick={fetchAdminData}>
          🔄 Refresh
        </button>
      </div>

      {/* Stats Overview */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{stats.totalAgents}</div>
            <div className="stat-label">Total Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value">{stats.pendingAgents}</div>
            <div className="stat-label">Pending Verifications</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value">GHS {stats.totalSales?.toFixed(2)}</div>
            <div className="stat-label">Total Sales</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💳</div>
            <div className="stat-value">GHS {stats.totalWalletBalance?.toFixed(2)}</div>
            <div className="stat-label">Total Wallet Balance</div>
          </div>
        </div>
      </div>

      {/* Pending Verifications */}
      <div className="pending-section">
        <h2>⏳ Pending Agent Verifications</h2>
        {pendingVerifications.length === 0 ? (
          <p className="no-pending">No pending verifications.</p>
        ) : (
          <div className="pending-list">
            {pendingVerifications.map(agent => (
              <div key={agent._id} className="pending-card">
                <div className="agent-info">
                  <div className="agent-name">{agent.username}</div>
                  <div className="agent-email">{agent.email}</div>
                  <div className="agent-phone">{agent.phone || 'No phone'}</div>
                  <div className="agent-date">
                    Joined: {new Date(agent.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="verification-actions">
                  <button
                    className="verify-btn approve"
                    onClick={() => handleVerifyAgent(agent._id, true)}
                  >
                    ✅ Approve
                  </button>
                  <button
                    className="verify-btn reject"
                    onClick={() => handleVerifyAgent(agent._id, false)}
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agents Management */}
      <div className="agents-section">
        <div className="section-header">
          <h2>👥 Agents Management</h2>
          <button 
            className="price-manage-btn"
            onClick={() => setShowPriceModal(true)}
          >
            ⚙️ Manage Agent Prices
          </button>
        </div>

        <div className="agents-table-container">
          <table className="agents-table">
            <thead>
              <tr>
                <th>Agent ID</th>
                <th>Email</th>
                <th>Wallet Balance</th>
                <th>Status</th>
                <th>Total Sales</th>
                <th>Commission</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent._id}>
                  <td>{agent.username}</td>
                  <td>{agent.email}</td>
                  <td>GHS {agent.walletBalance?.toFixed(2) || '0.00'}</td>
                  <td>
                    <span className={`status-badge ${agent.status}`}>
                      {agent.status}
                    </span>
                  </td>
                  <td>GHS {(agent.totalSales || 0).toFixed(2)}</td>
                  <td>GHS {(agent.totalCommission || 0).toFixed(2)}</td>
                  <td className="agent-actions">
                    <button
                      className="action-btn wallet-btn"
                      onClick={() => {
                        setSelectedAgent(agent);
                        setShowAgentModal(true);
                      }}
                    >
                      💰 Load Wallet
                    </button>
                    <button
                      className="action-btn suspend-btn"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to ${agent.status === 'active' ? 'suspend' : 'activate'} this agent?`)) {
                          // Handle suspend/activate
                        }
                      }}
                    >
                      {agent.status === 'active' ? '⏸️ Suspend' : '▶️ Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load Wallet Modal */}
      {showAgentModal && selectedAgent && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Load Wallet for {selectedAgent.username}</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowAgentModal(false);
                  setSelectedAgent(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="agent-details">
                <p><strong>Email:</strong> {selectedAgent.email}</p>
                <p><strong>Current Balance:</strong> GHS {selectedAgent.walletBalance?.toFixed(2)}</p>
              </div>
              <div className="load-wallet-form">
                <input
                  type="number"
                  placeholder="Enter amount (GHS)"
                  className="amount-input"
                  min="1"
                  step="0.01"
                  defaultValue="10"
                />
                <button
                  className="load-btn"
                  onClick={() => {
                    const amount = document.querySelector('.amount-input').value;
                    handleLoadWallet(selectedAgent._id, amount);
                  }}
                >
                  💰 Load Wallet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price Management Modal */}
      {showPriceModal && (
        <div className="modal-overlay">
          <div className="modal-content price-modal">
            <div className="modal-header">
              <h3>⚙️ Manage Agent Prices</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowPriceModal(false);
                  setPriceUpdates({});
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Update agent prices for different networks and plans.
              </p>
              
              <div className="price-update-section">
                <h4>MTN Network</h4>
                <div className="price-inputs">
                  <div className="price-input-group">
                    <label>1GB Agent Price (Current: GHS 4.10)</label>
                    <input
                      type="number"
                      placeholder="New price"
                      step="0.01"
                      min="0"
                      onChange={(e) => handlePriceChange('mtn-1gb', e.target.value)}
                    />
                  </div>
                  <div className="price-input-group">
                    <label>5GB Agent Price (Current: GHS 20.30)</label>
                    <input
                      type="number"
                      placeholder="New price"
                      step="0.01"
                      min="0"
                      onChange={(e) => handlePriceChange('mtn-5gb', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="price-update-section">
                <h4>Telecel Network</h4>
                <div className="price-inputs">
                  <div className="price-input-group">
                    <label>5GB Agent Price (Current: GHS 19.30)</label>
                    <input
                      type="number"
                      placeholder="New price"
                      step="0.01"
                      min="0"
                      onChange={(e) => handlePriceChange('telecel-5gb', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="save-btn"
                  onClick={() => handleUpdatePrices('all', priceUpdates)}
                >
                  💾 Save All Changes
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setShowPriceModal(false);
                    setPriceUpdates({});
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;