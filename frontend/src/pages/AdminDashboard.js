import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { plansAPI, ordersAPI, userAPI } from '../services/api';
import './ClientDashboard.css';

const ClientDashboard = () => {
  const { addToCart } = useCart();
  const { darkMode } = useTheme();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    totalDataFormatted: '0 GB',
    totalDataGB: 0,
    todayOrders: 0,
    todayDataFormatted: '0 GB',
    weekSpent: 0,
    monthSpent: 0,
    deliveredOrders: 0,
    averageOrderValue: 0,
    orderSuccessRate: 0
  });
  const [expandedNetwork, setExpandedNetwork] = useState(null);
  const [phoneNumbers, setPhoneNumbers] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const itemsPerPage = 10;

  // Network colors
  const networkColors = {
    'MTN': '#FFD700',
    'Telecel': '#FF4D4F',
    'AirtelTigo': '#1890FF'
  };

  const networkIcons = {
    'MTN': '📱',
    'Telecel': '📞',
    'AirtelTigo': '📶'
  };

  // Fetch data from backend
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch user data
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          
          try {
            const profileResponse = await userAPI.getProfile();
            if (profileResponse.data && profileResponse.data.user) {
              const updatedUser = profileResponse.data.user;
              setUser(updatedUser);
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          } catch (profileError) {
            console.log('Using cached user data:', profileError.message);
          }
        }

        // Fetch plans
        await fetchPlans();

        // Fetch transactions
        await fetchTransactions();

        // Fetch dashboard stats
        await fetchDashboardStats();
        
      } catch (error) {
        console.error('❌ Error fetching dashboard data:', error);
        setError('Failed to load dashboard data. Please try again.');
        setFallbackData();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, refreshKey]);

  // Fetch plans from backend API
  const fetchPlans = async () => {
    try {
      console.log('📋 Fetching plans from backend API...');
      const response = await plansAPI.getAll();
      
      if (response.data && Array.isArray(response.data)) {
        const groupedPlans = response.data.reduce((acc, plan) => {
          if (!acc[plan.network]) {
            acc[plan.network] = [];
          }
          acc[plan.network].push({
            _id: plan._id,
            id: plan._id,
            size: plan.size,
            price: plan.price,
            validity: plan.validity,
            description: plan.description || `${plan.network} ${plan.size}`,
            popular: plan.popular || false
          });
          return acc;
        }, {});

        const networkObjects = Object.keys(groupedPlans)
          .filter(network => ['MTN', 'Telecel', 'AirtelTigo'].includes(network))
          .map(network => ({
            name: network,
            color: networkColors[network] || '#666',
            icon: networkIcons[network] || '📱',
            plans: groupedPlans[network].sort((a, b) => {
              const sizeA = parseFloat(a.size.replace(/[^\d.]/g, '')) || 0;
              const sizeB = parseFloat(b.size.replace(/[^\d.]/g, '')) || 0;
              return sizeA - sizeB;
            })
          }));

        setNetworks(networkObjects);
        console.log(`✅ Loaded ${response.data.length} plans from backend`);
      } else {
        console.warn('⚠️ No plans data from API, using fallback');
        setFallbackPlans();
      }
    } catch (error) {
      console.error('❌ Error fetching plans:', error);
      setFallbackPlans();
    }
  };

  // Fetch transactions from backend API
  const fetchTransactions = async () => {
    try {
      const response = await ordersAPI.getMyOrders({
        page: currentPage,
        limit: itemsPerPage
      });
      
      if (response.data && response.data.orders) {
        // Transform API data to match our table format
        const apiTransactions = response.data.orders.map(order => ({
          // Use order._id as the identifier instead of trxCode
          id: order._id,
          package: order.items?.[0]?.network 
            ? `${order.items[0].network}-${order.items[0].size}` 
            : 'Unknown',
          description: order.items?.[0]?.description || 
                     order.items?.[0]?.network || 
                     'Data Bundle',
          amount: order.totalAmount || order.total || 0,
          beneficiary: order.items?.[0]?.recipientPhone || 
                     order.customerPhone || 
                     'N/A',
          paymentSource: order.paymentMethod || 'Paystack',
          paymentStatus: order.paymentStatus || 'pending',
          date: order.createdAt ? new Date(order.createdAt).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : new Date().toLocaleString(),
          status: order.status || 'processing',
          items: order.items || []
        }));
        
        setTransactions(apiTransactions);
        setTotalPages(response.data.pagination?.pages || 1);
      } else {
        console.warn('⚠️ No transactions data from API');
        setTransactions([]);
      }
    } catch (error) {
      console.error('❌ Error fetching transactions:', error);
      setTransactions([]);
    }
  };

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      const response = await userAPI.getDashboardStats();
      
      if (response.data && response.data.stats) {
        console.log('📊 Dashboard stats received:', response.data.stats);
        setStats({
          totalOrders: response.data.stats.totalOrders || 0,
          totalSpent: response.data.stats.totalSpent || 0,
          weekSpent: response.data.stats.weekSpent || 0,
          monthSpent: response.data.stats.monthSpent || 0,
          totalDataFormatted: response.data.stats.totalDataFormatted || '0 GB',
          totalDataGB: response.data.stats.totalDataGB || 0,
          todayOrders: response.data.stats.todayOrders || 0,
          todayDataFormatted: response.data.stats.todayDataFormatted || '0 GB',
          deliveredOrders: response.data.stats.deliveredOrders || 0,
          averageOrderValue: response.data.stats.averageOrderValue || 0,
          orderSuccessRate: response.data.stats.orderSuccessRate || 0
        });
      } else {
        console.warn('⚠️ No stats data from API, calculating from transactions');
        calculateStatsFromTransactions();
      }
    } catch (error) {
      console.error('❌ Error fetching dashboard stats:', error);
      calculateStatsFromTransactions();
    }
  };

  // Calculate stats from transactions data (fallback)
  const calculateStatsFromTransactions = () => {
    const totalOrders = transactions.length;
    const totalSpent = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const today = new Date().toDateString();
    const todayOrders = transactions.filter(t => 
      new Date(t.date).toDateString() === today
    ).length;
    
    let totalDataGB = 0;
    transactions.forEach(t => {
      if (t.items && Array.isArray(t.items)) {
        t.items.forEach(item => {
          const size = item.size || '';
          const quantity = item.quantity || 1;
          
          if (size.includes('GB')) {
            const gbValue = parseFloat(size.replace('GB', '').trim()) || 0;
            totalDataGB += gbValue * quantity;
          } else if (size.includes('MB')) {
            const mbValue = parseFloat(size.replace('MB', '').trim()) || 0;
            totalDataGB += (mbValue * quantity) / 1024;
          }
        });
      }
    });
    
    setStats(prev => ({
      ...prev,
      totalOrders,
      totalSpent,
      totalDataGB,
      totalDataFormatted: totalDataGB >= 1 ? 
        `${totalDataGB.toFixed(2)} GB` : 
        `${(totalDataGB * 1024).toFixed(0)} MB`,
      todayOrders
    }));
  };

  // Fallback plans if API fails
  const setFallbackPlans = () => {
    const fallbackNetworks = [
      { 
        name: 'MTN', 
        color: '#FFD700', 
        icon: '📱', 
        plans: [
          { _id: 'mtn1', size: '1GB', price: 4.15, validity: '30 days', description: 'MTN Non Expiry' },
          { _id: 'mtn2', size: '2GB', price: 8.30, validity: '30 days', description: 'MTN Non Expiry' },
          { _id: 'mtn3', size: '3GB', price: 12.45, validity: '30 days', description: 'MTN Non Expiry' },
          { _id: 'mtn4', size: '5GB', price: 20.75, validity: '30 days', description: 'MTN Non Expiry' },
          { _id: 'mtn5', size: '10GB', price: 41.50, validity: '30 days', description: 'MTN Non Expiry' },
        ]
      },
      { 
        name: 'Telecel', 
        color: '#FF4D4F', 
        icon: '📞', 
        plans: [
          { _id: 'telecel1', size: '2GB', price: 7.18, validity: '30 days', description: 'Telecel' },
          { _id: 'telecel2', size: '5GB', price: 17.95, validity: '30 days', description: 'Telecel' },
          { _id: 'telecel3', size: '10GB', price: 35.90, validity: '30 days', description: 'Telecel' },
          { _id: 'telecel4', size: '15GB', price: 52.90, validity: '30 days', description: 'Telecel' },
        ]
      },
      { 
        name: 'AirtelTigo', 
        color: '#1890FF', 
        icon: '📶', 
        plans: [
          { _id: 'airteltigo1', size: '1GB', price: 5.00, validity: '7 days', description: 'AirtelTigo' },
          { _id: 'airteltigo2', size: '3GB', price: 12.00, validity: '30 days', description: 'AirtelTigo' },
          { _id: 'airteltigo3', size: '6GB', price: 22.00, validity: '30 days', description: 'AirtelTigo' },
          { _id: 'airteltigo4', size: '10GB', price: 35.00, validity: '30 days', description: 'AirtelTigo' },
        ]
      }
    ];
    setNetworks(fallbackNetworks);
  };

  // Fallback data for all
  const setFallbackData = () => {
    setFallbackPlans();
    setTransactions([]);
    setStats({
      totalOrders: 0,
      totalSpent: 0,
      totalDataFormatted: '0 GB',
      totalDataGB: 0,
      todayOrders: 0,
      todayDataFormatted: '0 GB',
      weekSpent: 0,
      monthSpent: 0,
      deliveredOrders: 0,
      averageOrderValue: 0,
      orderSuccessRate: 0
    });
  };

  const toggleNetwork = (networkName) => {
    setExpandedNetwork(expandedNetwork === networkName ? null : networkName);
  };

  const handlePhoneChange = (planId, phone) => {
    setPhoneNumbers({
      ...phoneNumbers,
      [planId]: phone
    });
  };

  const handleAddToCart = (plan, network) => {
    const phoneNumber = phoneNumbers[plan._id] || '';
    
    if (!phoneNumber) {
      alert('Please enter a phone number for this data plan');
      return;
    }

    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    const ghanaRegex = /^(020|023|024|025|026|027|028|029|030|050|054|055|056|057|058|059|053)\d{7}$/;
    
    if (!ghanaRegex.test(cleanPhone)) {
      alert('Please enter a valid Ghanaian phone number (e.g., 0241234567)');
      return;
    }

    const planWithPhone = {
      ...plan,
      id: plan._id,
      network: network.name,
      recipientPhone: cleanPhone
    };

    addToCart(planWithPhone);
    alert(`✅ ${network.name} ${plan.size} added to cart for ${cleanPhone}!`);
    
    setPhoneNumbers({
      ...phoneNumbers,
      [plan._id]: ''
    });
  };

  const getStatusColor = (status) => {
    if (!status) return '#666';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('delivered') || statusLower.includes('success')) return '#52c41a';
    if (statusLower.includes('processing') || statusLower.includes('pending')) return '#faad14';
    if (statusLower.includes('placed') || statusLower.includes('active')) return '#1890ff';
    return '#ff4d4f';
  };

  const getPaymentColor = (status) => {
    if (!status) return '#666';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('success') || statusLower.includes('paid')) return '#52c41a';
    if (statusLower.includes('pending')) return '#faad14';
    if (statusLower.includes('processing') || statusLower.includes('initiated')) return '#1890ff';
    return '#ff4d4f';
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        fetchPlans(),
        fetchTransactions(),
        fetchDashboardStats()
      ]);
      setRefreshKey(prev => prev + 1);
      console.log('🔄 Dashboard data refreshed');
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`loading-container ${darkMode ? 'dark' : ''}`}>
        <div className="loading-spinner"></div>
        <h2>Loading Dashboard...</h2>
        <p>Fetching your latest data from server...</p>
      </div>
    );
  }

  return (
    <div className={`client-dashboard ${darkMode ? 'dark' : ''}`}>
      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span className="error-icon">❌</span>
          <span className="error-text">{error}</span>
          <button className="retry-btn" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* Header with user info */}
      <div className="dashboard-header">
        <div className="header-top">
          <h1>📊 Client Dashboard</h1>
          <button 
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh Data'}
          </button>
        </div>
        {user && (
          <div className="user-info-card">
            <div className="user-details">
              <div className="user-field">
                <strong>Username:</strong> {user.username || user.name || 'User'}
              </div>
              <div className="user-field">
                <strong>Email:</strong> {user.email || 'Not set'}
              </div>
              <div className="user-field">
                <strong>Status:</strong> <span className="status-active">Active</span>
              </div>
              <div className="user-field">
                <strong>Member Since:</strong> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </div>
              <div className="user-field">
                <strong>Phone:</strong> {user.phone || 'Not set'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="stats-section">
        <div className="stats-header">
          <h2 className="section-title">📈 Your Statistics</h2>
          <p className="section-subtitle">Real-time data from your orders</p>
        </div>
        <div className="stats-grid">
          <div className="stat-card total-spent-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value">GHS {stats.totalSpent?.toFixed(2) || '0.00'}</div>
            <div className="stat-label">Total Spent</div>
            <div className="stat-note">All successful orders</div>
          </div>
          <div className="stat-card today-orders-card">
            <div className="stat-icon">📦</div>
            <div className="stat-value">{stats.todayOrders || 0}</div>
            <div className="stat-label">Orders Today</div>
            <div className="stat-note">Orders placed today</div>
          </div>
          <div className="stat-card data-volume-card">
            <div className="stat-icon">💾</div>
            <div className="stat-value">{stats.totalDataFormatted || '0 GB'}</div>
            <div className="stat-label">Total Data Volume</div>
            <div className="stat-note">Total data purchased</div>
          </div>
          <div className="stat-card delivered-orders-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{stats.deliveredOrders || 0}</div>
            <div className="stat-label">Delivered Orders</div>
            <div className="stat-note">Successfully delivered</div>
          </div>
        </div>
      </div>

      {/* Available Packages Section */}
      <div className="packages-section">
        <h2 className="section-title">📱 Available Data Packages</h2>
        <p className="section-subtitle">
          Click on network names to view packages. Enter recipient phone number to add to cart.
        </p>

        {/* Network Accordions */}
        <div className="network-accordions">
          {networks.length === 0 ? (
            <div className="no-plans-message">
              <p>No data plans available. Please check your connection or contact support.</p>
            </div>
          ) : (
            networks.map(network => (
              <div key={network.name} className="network-accordion">
                <div 
                  className="accordion-header"
                  onClick={() => toggleNetwork(network.name)}
                  style={{ 
                    borderLeftColor: network.color,
                    background: `linear-gradient(135deg, ${network.color}20 0%, ${network.color}10 100%)`
                  }}
                >
                  <div className="network-title">
                    <span 
                      className="network-icon"
                      style={{ backgroundColor: network.color }}
                    >
                      {network.icon}
                    </span>
                    <span className="network-name">{network.name}</span>
                    <span className="plan-count">({network.plans.length} plans)</span>
                  </div>
                  <span className="accordion-arrow">
                    {expandedNetwork === network.name ? '▲' : '▼'}
                  </span>
                </div>
                
                {expandedNetwork === network.name && (
                  <div className="accordion-content">
                    <div className="plans-table">
                      <table>
                        <thead>
                          <tr>
                            <th>VOLUME</th>
                            <th>PRICE (GHS)</th>
                            <th>VALIDITY</th>
                            <th>DESCRIPTION</th>
                            <th>BENEFICIARY NUMBER</th>
                            <th>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {network.plans.map(plan => (
                            <tr key={plan._id}>
                              <td className="volume">{plan.size}</td>
                              <td className="price">{plan.price.toFixed(2)}</td>
                              <td className="validity">{plan.validity}</td>
                              <td className="description">{plan.description}</td>
                              <td>
                                <input
                                  type="tel"
                                  value={phoneNumbers[plan._id] || ''}
                                  onChange={(e) => handlePhoneChange(plan._id, e.target.value)}
                                  placeholder="0241234567"
                                  className="phone-input"
                                  maxLength="10"
                                />
                              </td>
                              <td>
                                <button
                                  onClick={() => handleAddToCart(plan, network)}
                                  disabled={loading}
                                  className="add-to-cart-btn"
                                  style={{ 
                                    backgroundColor: network.color,
                                    color: network.name === 'MTN' ? '#000' : '#fff'
                                  }}
                                >
                                  {loading ? 'Adding...' : '🛒 Add to Cart'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="transactions-section">
        <div className="section-header">
          <h2 className="section-title">📋 Transaction History</h2>
          <div className="table-actions">
            <button 
              className="export-btn"
              onClick={() => alert('Export feature coming soon!')}
            >
              📥 Export CSV
            </button>
          </div>
        </div>
        
        <div className="transactions-table-container">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>PACKAGE</th>
                <th>DESCRIPTION</th>
                <th>AMOUNT (GHS)</th>
                <th>BENEFICIARY</th>
                <th>PAYMENT SOURCE</th>
                <th>PAYMENT STATUS</th>
                <th>DATE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data">
                    📭 No transactions yet. Purchase your first data plan!
                  </td>
                </tr>
              ) : (
                transactions.map(transaction => (
                  <tr key={transaction.id}>
                    <td className="package">{transaction.package}</td>
                    <td className="description">{transaction.description}</td>
                    <td className="amount">{transaction.amount.toFixed(2)}</td>
                    <td className="beneficiary">{transaction.beneficiary}</td>
                    <td className="payment-source">{transaction.paymentSource}</td>
                    <td>
                      <span 
                        className="payment-status"
                        style={{ backgroundColor: getPaymentColor(transaction.paymentStatus) }}
                      >
                        {transaction.paymentStatus}
                      </span>
                    </td>
                    <td className="date">{transaction.date}</td>
                    <td>
                      <span 
                        className="delivery-status"
                        style={{ backgroundColor: getStatusColor(transaction.status) }}
                      >
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="table-footer">
          <div className="entries-info">
            <span>
              Showing {transactions.length} of {stats.totalOrders} transactions
              {stats.totalOrders > itemsPerPage && ` (Page ${currentPage} of ${totalPages})`}
            </span>
          </div>
          
          {stats.totalOrders > itemsPerPage && (
            <div className="pagination">
              <button 
                className="page-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ‹ Previous
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="page-dots">...</span>
                  <button
                    className="page-btn"
                    onClick={() => handlePageChange(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              
              <button 
                className="page-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;