// src/pages/AgentDashboard.js
import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { plansAPI, ordersAPI, userAPI, walletAPI } from '../services/api';
import ChatSupport from '../components/ChatSupport/ChatSupport';
import './AgentDashboard.css';

const AgentDashboard = () => {
  const { addToCart } = useCart();
  const { darkMode } = useTheme();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    walletBalance: 0,
    totalOrders: 0,
    totalSales: 0,
    totalCommission: 0,
    todayOrders: 0,
    todaySales: 0,
    commissionRate: 0,
    successRate: 0
  });
  const [expandedNetwork, setExpandedNetwork] = useState(null);
  const [phoneNumbers, setPhoneNumbers] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const itemsPerPage = 10;

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
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

        await fetchPlans();
        await fetchTransactions();
        await fetchDashboardStats();
        await fetchWalletData();
        
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

  const fetchPlans = async () => {
    try {
      console.log('📋 Fetching agent plans from backend API...');
      const response = await plansAPI.getAll();
      
      if (response.data && Array.isArray(response.data)) {
        const groupedPlans = response.data.reduce((acc, plan) => {
          if (!acc[plan.network]) {
            acc[plan.network] = [];
          }
          // Use agentPrice if available, otherwise use regular price
          const price = plan.agentPrice || plan.price;
          acc[plan.network].push({
            _id: plan._id,
            id: plan._id,
            size: plan.size,
            price: price,
            regularPrice: plan.price, // Store regular price for comparison
            agentPrice: plan.agentPrice,
            validity: plan.validity,
            description: plan.description || `${plan.network} ${plan.size}`,
            popular: plan.popular || false,
            isAgentPrice: !!plan.agentPrice
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
        console.log(`✅ Loaded ${response.data.length} agent plans from backend`);
      } else {
        console.warn('⚠️ No plans data from API, using fallback');
        setFallbackPlans();
      }
    } catch (error) {
      console.error('❌ Error fetching agent plans:', error);
      setFallbackPlans();
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await ordersAPI.getMyOrders({
        page: currentPage,
        limit: itemsPerPage
      });
      
      if (response.data && response.data.orders) {
        const apiTransactions = response.data.orders.map(order => ({
          id: order._id,
          package: order.items?.[0]?.network 
            ? `${order.items[0].network}-${order.items[0].size}` 
            : 'Unknown',
          description: order.items?.[0]?.description || 
                     order.items?.[0]?.network || 
                     'Data Bundle',
          amount: order.totalAmount || order.total || 0,
          commission: order.totalAmount * (user?.agentCommission || 0.05),
          beneficiary: order.items?.[0]?.recipientPhone || 
                     order.customerPhone || 
                     'N/A',
          paymentMethod: order.paymentMethod || 'wallet',
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

  const fetchDashboardStats = async () => {
    try {
      const response = await userAPI.getAgentDashboard();
      
      if (response.data && response.data.stats) {
        console.log('📊 Agent dashboard stats received:', response.data.stats);
        setStats({
          walletBalance: response.data.stats.walletBalance || 0,
          totalOrders: response.data.stats.totalOrders || 0,
          totalSales: response.data.stats.totalSales || 0,
          totalCommission: response.data.stats.totalCommission || 0,
          todayOrders: response.data.stats.todayOrders || 0,
          todaySales: response.data.stats.todaySales || 0,
          commissionRate: response.data.stats.agentCommission * 100 || 5,
          successRate: response.data.stats.successRate || 0
        });
      } else {
        console.warn('⚠️ No agent stats data from API, calculating from transactions');
        calculateStatsFromTransactions();
      }
    } catch (error) {
      console.error('❌ Error fetching agent dashboard stats:', error);
      calculateStatsFromTransactions();
    }
  };

  const fetchWalletData = async () => {
    try {
      const balanceResponse = await walletAPI.getBalance();
      if (balanceResponse.data && balanceResponse.data.success) {
        setStats(prev => ({
          ...prev,
          walletBalance: balanceResponse.data.balance || 0
        }));
      }

      const transactionsResponse = await walletAPI.getTransactions({
        page: 1,
        limit: 5
      });
      if (transactionsResponse.data && transactionsResponse.data.transactions) {
        setWalletTransactions(transactionsResponse.data.transactions);
      }
    } catch (error) {
      console.error('❌ Error fetching wallet data:', error);
    }
  };

  const calculateStatsFromTransactions = () => {
    const totalOrders = transactions.length;
    const totalSales = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalCommission = totalSales * (user?.agentCommission || 0.05);
    const today = new Date().toDateString();
    const todayOrders = transactions.filter(t => 
      new Date(t.date).toDateString() === today
    ).length;
    const todaySales = transactions
      .filter(t => new Date(t.date).toDateString() === today)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    setStats(prev => ({
      ...prev,
      totalOrders,
      totalSales,
      totalCommission,
      todayOrders,
      todaySales,
      commissionRate: (user?.agentCommission || 0.05) * 100
    }));
  };

  const setFallbackPlans = () => {
    const fallbackNetworks = [
      { 
        name: 'MTN', 
        color: '#FFD700', 
        icon: '📱', 
        plans: [
          { _id: 'mtn1', size: '1GB', price: 4.10, regularPrice: 4.30, agentPrice: 4.10, validity: '30 days', description: 'MTN Non Expiry', isAgentPrice: true },
          { _id: 'mtn2', size: '2GB', price: 8.20, regularPrice: 8.50, agentPrice: 8.20, validity: '30 days', description: 'MTN Non Expiry', isAgentPrice: true },
          { _id: 'mtn3', size: '3GB', price: 12.20, regularPrice: 12.50, agentPrice: 12.20, validity: '30 days', description: 'MTN Non Expiry', isAgentPrice: true },
          { _id: 'mtn4', size: '5GB', price: 20.30, regularPrice: 20.60, agentPrice: 20.30, validity: '30 days', description: 'MTN Non Expiry', isAgentPrice: true },
        ]
      },
      { 
        name: 'Telecel', 
        color: '#FF4D4F', 
        icon: '📞', 
        plans: [
          { _id: 'telecel1', size: '5GB', price: 19.30, regularPrice: 19.60, agentPrice: 19.30, validity: '30 days', description: 'Telecel', isAgentPrice: true },
          { _id: 'telecel2', size: '10GB', price: 37.00, regularPrice: 37.30, agentPrice: 37.00, validity: '30 days', description: 'Telecel', isAgentPrice: true },
          { _id: 'telecel3', size: '15GB', price: 53.30, regularPrice: 53.60, agentPrice: 53.30, validity: '30 days', description: 'Telecel', isAgentPrice: true },
        ]
      },
      { 
        name: 'AirtelTigo', 
        color: '#1890FF', 
        icon: '📶', 
        plans: [
          { _id: 'airteltigo1', size: '1GB', price: 3.75, regularPrice: 3.95, agentPrice: 3.75, validity: '30 days', description: 'AirtelTigo', isAgentPrice: true },
          { _id: 'airteltigo2', size: '3GB', price: 11.50, regularPrice: 11.70, agentPrice: 11.50, validity: '30 days', description: 'AirtelTigo', isAgentPrice: true },
          { _id: 'airteltigo3', size: '5GB', price: 19.30, regularPrice: 19.50, agentPrice: 19.30, validity: '30 days', description: 'AirtelTigo', isAgentPrice: true },
        ]
      }
    ];
    setNetworks(fallbackNetworks);
  };

  const setFallbackData = () => {
    setFallbackPlans();
    setTransactions([]);
    setStats({
      walletBalance: 0,
      totalOrders: 0,
      totalSales: 0,
      totalCommission: 0,
      todayOrders: 0,
      todaySales: 0,
      commissionRate: 5,
      successRate: 0
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
      recipientPhone: cleanPhone,
      price: plan.price, // Agent price
      agentPrice: plan.agentPrice
    };

    addToCart(planWithPhone);
    alert(`✅ ${network.name} ${plan.size} added to cart for ${cleanPhone} at agent price!`);
    
    setPhoneNumbers({
      ...phoneNumbers,
      [plan._id]: ''
    });
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid deposit amount');
      return;
    }

    setDepositLoading(true);
    try {
      const response = await walletAPI.deposit({
        amount: amount,
        email: user.email
      });

      if (response.data && response.data.success) {
        // Redirect to Paystack payment page
        window.location.href = response.data.paymentUrl;
      } else {
        alert('Failed to initialize deposit. Please try again.');
      }
    } catch (error) {
      console.error('Deposit error:', error);
      alert('Failed to process deposit. Please try again.');
    } finally {
      setDepositLoading(false);
      setDepositAmount('');
    }
  };

  const handleWalletPurchase = async (plan, network) => {
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

    // Check wallet balance
    if (stats.walletBalance < plan.price) {
      alert(`Insufficient wallet balance. You need GHS ${plan.price.toFixed(2)} but have GHS ${stats.walletBalance.toFixed(2)}`);
      return;
    }

    try {
      const orderData = {
        items: [{
          planId: plan._id,
          network: network.name,
          size: plan.size,
          price: plan.price,
          recipientPhone: cleanPhone,
          quantity: 1
        }],
        totalAmount: plan.price + 0.5, // Add service fee
        customerEmail: user.email,
        customerPhone: user.phone || cleanPhone,
        paymentMethod: 'wallet'
      };

      // Create order with wallet payment
      const orderResponse = await ordersAPI.createOrder(orderData);
      
      if (orderResponse.data && orderResponse.data.success) {
        alert(`✅ Order placed successfully! ${network.name} ${plan.size} for ${cleanPhone}`);
        
        // Refresh wallet balance
        const balanceResponse = await walletAPI.getBalance();
        if (balanceResponse.data && balanceResponse.data.success) {
          setStats(prev => ({
            ...prev,
            walletBalance: balanceResponse.data.balance
          }));
        }
        
        // Refresh transactions
        fetchTransactions();
        setPhoneNumbers({
          ...phoneNumbers,
          [plan._id]: ''
        });
      } else {
        alert('Failed to place order. Please try again.');
      }
    } catch (error) {
      console.error('Wallet purchase error:', error);
      alert('Failed to process purchase. Please try again.');
    }
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
        fetchDashboardStats(),
        fetchWalletData()
      ]);
      setRefreshKey(prev => prev + 1);
      console.log('🔄 Agent dashboard data refreshed');
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
        <h2>Loading Agent Dashboard...</h2>
        <p>Fetching your latest agent data from server...</p>
      </div>
    );
  }

  return (
    <>
      <div className={`agent-dashboard ${darkMode ? 'dark' : ''}`}>
        {error && (
          <div className="error-message">
            <span className="error-icon">❌</span>
            <span className="error-text">{error}</span>
            <button className="retry-btn" onClick={handleRefresh}>
              Retry
            </button>
          </div>
        )}

        {/* Wallet Section */}
        <div className="wallet-section">
          <div className="wallet-card">
            <div className="wallet-header">
              <h2>💰 Agent Wallet</h2>
              <span className="wallet-status active">Active</span>
            </div>
            
            <div className="wallet-balance">
              <div className="balance-amount">
                <span className="currency">GHS</span>
                <span className="amount">{stats.walletBalance.toFixed(2)}</span>
              </div>
              <p className="balance-label">Available Balance</p>
            </div>

            <div className="deposit-section">
              <div className="deposit-input-group">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Enter deposit amount"
                  className="deposit-input"
                  min="1"
                  step="0.01"
                />
                <button
                  onClick={handleDeposit}
                  disabled={depositLoading || !depositAmount}
                  className="deposit-btn"
                >
                  {depositLoading ? 'Processing...' : 'Deposit via Paystack'}
                </button>
              </div>
              <p className="deposit-note">
                Minimum deposit: GHS 5.00 | Processed instantly
              </p>
            </div>

            {/* Recent Wallet Transactions */}
            {walletTransactions.length > 0 && (
              <div className="recent-transactions">
                <h3>Recent Wallet Activity</h3>
                <div className="transactions-list">
                  {walletTransactions.slice(0, 3).map(transaction => (
                    <div key={transaction._id} className="transaction-item">
                      <div className="transaction-icon">
                        {transaction.type === 'deposit' ? '⬇️' : 
                         transaction.type === 'commission' ? '💰' : '⬆️'}
                      </div>
                      <div className="transaction-details">
                        <div className="transaction-type">{transaction.type}</div>
                        <div className="transaction-desc">{transaction.description}</div>
                        <div className="transaction-date">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className={`transaction-amount ${transaction.type}`}>
                        {transaction.type === 'deposit' || transaction.type === 'commission' ? '+' : '-'}
                        GHS {Math.abs(transaction.amount).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-header">
          <div className="header-top">
            <h1>👑 Agent Dashboard</h1>
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
                  <strong>Agent ID:</strong> {user.username || user.name || 'User'}
                </div>
                <div className="user-field">
                  <strong>Email:</strong> {user.email || 'Not set'}
                </div>
                <div className="user-field">
                  <strong>Commission Rate:</strong> 
                  <span className="commission-rate"> {stats.commissionRate}%</span>
                </div>
                <div className="user-field">
                  <strong>Total Commission Earned:</strong> 
                  <span className="commission-amount"> GHS {stats.totalCommission.toFixed(2)}</span>
                </div>
                <div className="user-field">
                  <strong>Status:</strong> <span className="status-active">Verified Agent</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Agent Stats */}
        <div className="stats-section">
          <div className="stats-header">
            <h2 className="section-title">📈 Agent Performance</h2>
            <p className="section-subtitle">Real-time sales and commission data</p>
          </div>
          <div className="stats-grid">
            <div className="stat-card total-sales-card">
              <div className="stat-icon">💰</div>
              <div className="stat-value">GHS {stats.totalSales?.toFixed(2) || '0.00'}</div>
              <div className="stat-label">Total Sales</div>
              <div className="stat-note">All agent orders</div>
            </div>
            <div className="stat-card today-sales-card">
              <div className="stat-icon">📦</div>
              <div className="stat-value">{stats.todayOrders || 0}</div>
              <div className="stat-label">Orders Today</div>
              <div className="stat-note">Today's sales count</div>
            </div>
            <div className="stat-card commission-card">
              <div className="stat-icon">💸</div>
              <div className="stat-value">GHS {stats.totalCommission?.toFixed(2) || '0.00'}</div>
              <div className="stat-label">Total Commission</div>
              <div className="stat-note">Earnings from sales</div>
            </div>
            <div className="stat-card success-rate-card">
              <div className="stat-icon">📊</div>
              <div className="stat-value">{stats.successRate?.toFixed(1) || '0'}%</div>
              <div className="stat-label">Success Rate</div>
              <div className="stat-note">Order delivery rate</div>
            </div>
          </div>
        </div>

        {/* Agent Packages Section */}
        <div className="packages-section">
          <h2 className="section-title">📱 Agent Data Packages</h2>
          <p className="section-subtitle">
            Special agent pricing! Use wallet balance or deposit to purchase.
          </p>

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
                      <span className="plan-count">({network.plans.length} agent plans)</span>
                    </div>
                    <span className="accordion-arrow">
                      {expandedNetwork === network.name ? '▲' : '▼'}
                    </span>
                  </div>
                  
                  {expandedNetwork === network.name && (
                    <div className="accordion-content">
                      <div className="agent-price-info">
                        <span className="agent-badge">👑 AGENT PRICING</span>
                        <span className="price-savings">
                          Save up to 5% compared to regular prices
                        </span>
                      </div>
                      <div className="plans-table">
                        <table>
                          <thead>
                            <tr>
                              <th>VOLUME</th>
                              <th>AGENT PRICE</th>
                              <th>REGULAR PRICE</th>
                              <th>YOU SAVE</th>
                              <th>VALIDITY</th>
                              <th>BENEFICIARY NUMBER</th>
                              <th>ACTIONS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {network.plans.map(plan => {
                              const savings = plan.regularPrice - plan.price;
                              const savingsPercent = ((savings / plan.regularPrice) * 100).toFixed(1);
                              
                              return (
                                <tr key={plan._id}>
                                  <td className="volume">{plan.size}</td>
                                  <td className="agent-price">
                                    <strong>GHS {plan.price.toFixed(2)}</strong>
                                  </td>
                                  <td className="regular-price">
                                    <span className="strikethrough">GHS {plan.regularPrice.toFixed(2)}</span>
                                  </td>
                                  <td className="savings">
                                    <span className="savings-badge">
                                      GHS {savings.toFixed(2)} ({savingsPercent}%)
                                    </span>
                                  </td>
                                  <td className="validity">{plan.validity}</td>
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
                                  <td className="action-buttons">
                                    <button
                                      onClick={() => handleAddToCart(plan, network)}
                                      className="cart-btn"
                                      style={{ backgroundColor: network.color }}
                                    >
                                      🛒 Add to Cart
                                    </button>
                                    <button
                                      onClick={() => handleWalletPurchase(plan, network)}
                                      className="wallet-btn"
                                      disabled={stats.walletBalance < plan.price}
                                    >
                                      💰 Buy with Wallet
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
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

        {/* Transactions Section */}
        <div className="transactions-section">
          <div className="section-header">
            <h2 className="section-title">📋 Agent Transaction History</h2>
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
                  <th>AMOUNT</th>
                  <th>COMMISSION</th>
                  <th>BENEFICIARY</th>
                  <th>PAYMENT METHOD</th>
                  <th>PAYMENT STATUS</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">
                      📭 No transactions yet. Make your first sale!
                    </td>
                  </tr>
                ) : (
                  transactions.map(transaction => (
                    <tr key={transaction.id}>
                      <td className="package">{transaction.package}</td>
                      <td className="amount">GHS {transaction.amount.toFixed(2)}</td>
                      <td className="commission">
                        <span className="commission-badge">
                          GHS {transaction.commission.toFixed(2)}
                        </span>
                      </td>
                      <td className="beneficiary">{transaction.beneficiary}</td>
                      <td className="payment-method">{transaction.paymentMethod}</td>
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

      {/* Floating Chat Support */}
      <ChatSupport />
    </>
  );
};

export default AgentDashboard;