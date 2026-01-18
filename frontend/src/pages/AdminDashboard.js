import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { adminAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import './AdminDashboard.css'; // We'll create this CSS file

const AdminDashboard = () => {
  const { getDailyStats } = useCart();
  const [stats, setStats] = useState({});
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTableOpen, setIsTableOpen] = useState(true); // Table is open by default
  const { darkMode, toggleTheme } = useTheme();

  // Fetch all data from backend on component mount and periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch stats and orders from backend
        const [statsResponse, ordersResponse] = await Promise.all([
          adminAPI.getStats(),
          adminAPI.getAllOrders()
        ]);
        
        console.log('📊 Admin data fetched:', {
          stats: statsResponse.data,
          orders: ordersResponse.data.length
        });
        
        setStats(statsResponse.data);
        setAllOrders(ordersResponse.data);
        
      } catch (error) {
        console.error('❌ Error fetching admin data:', error);
        alert('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchData();
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Calculate additional statistics from fetched data
  const totalAllTimeOrders = allOrders.length;
  const totalAllTimeRevenue = allOrders.reduce((sum, order) => sum + order.total, 0);
  
  const networkStats = allOrders.reduce((acc, order) => {
    order.items.forEach(item => {
      acc[item.network] = (acc[item.network] || 0) + 1;
    });
    return acc;
  }, {});

  const recentOrders = allOrders
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  const toggleTable = () => {
    setIsTableOpen(!isTableOpen);
  };

  const getStatusColor = (status) => {
    switch(status.toLowerCase()) {
      case 'delivered': return '#52c41a';
      case 'processing': return '#1890ff';
      case 'placed': return '#faad14';
      default: return '#666';
    }
  };

  const getPaymentColor = (paymentStatus) => {
    switch(paymentStatus?.toLowerCase()) {
      case 'paid': 
      case 'completed': 
      case 'success': return '#52c41a';
      case 'pending': return '#faad14';
      default: return '#ff4d4f';
    }
  };

  if (loading) {
    return (
      <div className={`loading-container ${darkMode ? 'dark' : ''}`}>
        <h2>Loading Dashboard...</h2>
        <p>Please wait while we fetch the latest data.</p>
      </div>
    );
  }

  return (
    <div className={`admin-dashboard-container ${darkMode ? 'dark' : ''}`}>
      {/* Theme Toggle */}
      <button className="theme-toggle-btn" onClick={toggleTheme}>
        {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>

      <div className="dashboard-header">
        <h1>📊 Admin Dashboard</h1>
        <div className="header-controls">
          <span className="last-updated">
            Last Updated: {currentTime.toLocaleTimeString()}
          </span>
          <button className="toggle-table-btn" onClick={toggleTable}>
            {isTableOpen ? '← Hide Transactions' : 'Show Transactions →'}
          </button>
        </div>
      </div>

      {/* Slide-out Transaction Table */}
      <div className={`side-table-container ${isTableOpen ? 'open' : ''}`}>
        <div className="side-table-content">
          <div className="table-header">
            <h3>📋 Recent Transactions ({recentOrders.length})</h3>
            <button className="close-table-btn" onClick={toggleTable}>
              ×
            </button>
          </div>
          
          {recentOrders.length === 0 ? (
            <div className="no-data">No transactions found</div>
          ) : (
            <div className="table-responsive">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>TRX Code</th>
                    <th>Packages</th>
                    <th>Amount</th>
                    <th>Beneficiary</th>
                    <th>Payment</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order._id || order.id}>
                      <td>
                        <span className="trx-code">TRX{order.orderId?.slice(-6) || order._id?.slice(-6)}</span>
                      </td>
                      <td className="packages">
                        {order.items?.map(item => item.network + ' ' + item.size).join(', ') || 'N/A'}
                      </td>
                      <td className="amount">GH₵{order.total || 0}</td>
                      <td className="beneficiary">
                        {order.recipientPhone || order.customerPhone || 'N/A'}
                      </td>
                      <td>
                        <span 
                          className="payment-badge"
                          style={{ backgroundColor: getPaymentColor(order.paymentStatus || order.status) }}
                        >
                          {order.paymentStatus || 'Pending'}
                        </span>
                      </td>
                      <td className="date-time">
                        {new Date(order.createdAt || order.date).toLocaleString()}
                      </td>
                      <td>
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(order.status) }}
                        >
                          {order.status || 'Placed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="dashboard-content">
        {/* Statistics Cards */}
        <div className="stats-grid">
          <div className="stat-card" style={{ borderColor: '#1890ff' }}>
            <div className="stat-icon">📦</div>
            <div className="stat-value">{stats.today?.totalOrders || 0}</div>
            <div className="stat-label">Orders Today</div>
          </div>

          <div className="stat-card" style={{ borderColor: '#52c41a' }}>
            <div className="stat-icon">💰</div>
            <div className="stat-value">GH₵{stats.today?.totalRevenue || 0}</div>
            <div className="stat-label">Revenue Today</div>
          </div>

          <div className="stat-card" style={{ borderColor: '#faad14' }}>
            <div className="stat-icon">📊</div>
            <div className="stat-value">{stats.today?.totalDataVolume || '0GB'}</div>
            <div className="stat-label">Data Sold Today</div>
          </div>

          <div className="stat-card" style={{ borderColor: '#722ed1' }}>
            <div className="stat-icon">📈</div>
            <div className="stat-value">{totalAllTimeOrders}</div>
            <div className="stat-label">Total Orders</div>
          </div>
        </div>

        {/* Network Distribution */}
        <div className="network-distribution">
          <h3>📱 Network Distribution</h3>
          {Object.keys(networkStats).length === 0 ? (
            <div className="no-data">No network data available</div>
          ) : (
            <div className="network-bars">
              {Object.entries(networkStats).map(([network, count]) => (
                <div key={network} className="network-bar">
                  <span className="network-name">{network}</span>
                  <div className="bar-container">
                    <div 
                      className="bar-fill" 
                      style={{ 
                        width: `${(count / totalAllTimeOrders) * 100}%`,
                        backgroundColor: network === 'MTN' ? '#ff4d4f' : 
                                       network === 'Telecel' ? '#52c41a' : '#1890ff'
                      }}
                    />
                  </div>
                  <span className="network-count">{count} orders</span>
                  <span className="network-percent">
                    {Math.round((count / totalAllTimeOrders) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All-Time Revenue */}
        <div className="all-time-revenue">
          <h3>💰 All-Time Revenue</h3>
          <div className="revenue-amount">GH₵{totalAllTimeRevenue}</div>
          <p>Total revenue generated from {totalAllTimeOrders} orders</p>
        </div>

        {/* Recent Orders Summary */}
        <div className="recent-orders-summary">
          <h3>🔄 Recent Activity</h3>
          <div className="orders-list">
            {recentOrders.slice(0, 5).map(order => (
              <div key={order._id} className="order-item">
                <div className="order-header">
                  <span className="order-id">Order #{order.orderId || order._id?.slice(-6)}</span>
                  <span 
                    className="order-status"
                    style={{ color: getStatusColor(order.status) }}
                  >
                    {order.status || 'Placed'}
                  </span>
                </div>
                <div className="order-details">
                  <span>GH₵{order.total} • {order.items?.length || 0} item(s)</span>
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Refresh Button */}
        <div className="action-buttons">
          <button 
            className="refresh-btn"
            onClick={() => window.location.reload()}
          >
            🔄 Refresh Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;