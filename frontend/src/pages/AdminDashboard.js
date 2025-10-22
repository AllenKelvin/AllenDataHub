import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { adminAPI } from '../services/api';

const AdminDashboard = () => {
  const { getDailyStats } = useCart();
  const [stats, setStats] = useState({});
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

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
    .slice(0, 5);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Loading Dashboard...</h2>
        <p>Please wait while we fetch the latest data.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#1890ff' }}>
        📊 Admin Dashboard
      </h1>

      <div style={{ 
        textAlign: 'center', 
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: '#f0f8ff',
        borderRadius: '8px',
        border: '1px solid #1890ff'
      }}>
        <h3 style={{ margin: 0, color: '#1890ff' }}>
          Last Updated: {currentTime.toLocaleTimeString()}
        </h3>
      </div>

      {/* Daily Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <div style={{ 
          padding: '2rem', 
          backgroundColor: '#1890ff',
          color: 'white',
          borderRadius: '10px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {stats.today?.totalOrders || 0}
          </div>
          <div style={{ fontSize: '1.1rem' }}>Orders Today</div>
        </div>

        <div style={{ 
          padding: '2rem', 
          backgroundColor: '#52c41a',
          color: 'white',
          borderRadius: '10px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(82, 196, 26, 0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            GH₵{stats.today?.totalRevenue || 0}
          </div>
          <div style={{ fontSize: '1.1rem' }}>Revenue Today</div>
        </div>

        <div style={{ 
          padding: '2rem', 
          backgroundColor: '#faad14',
          color: 'white',
          borderRadius: '10px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(250, 173, 20, 0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {stats.today?.totalDataVolume || '0GB'}
          </div>
          <div style={{ fontSize: '1.1rem' }}>Data Sold Today</div>
        </div>

        <div style={{ 
          padding: '2rem', 
          backgroundColor: '#722ed1',
          color: 'white',
          borderRadius: '10px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(114, 46, 209, 0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {totalAllTimeOrders}
          </div>
          <div style={{ fontSize: '1.1rem' }}>Total Orders</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Recent Orders */}
        <div>
          <h3 style={{ borderBottom: '2px solid #1890ff', paddingBottom: '0.5rem' }}>
            📋 Recent Orders ({allOrders.length} total)
          </h3>
          {recentOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
              No orders yet
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {recentOrders.map(order => (
                <div key={order._id} style={{ 
                  border: '1px solid #e8e8e8',
                  borderRadius: '8px',
                  padding: '1rem',
                  backgroundColor: 'white'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Order #{order.orderId}</strong>
                    <span style={{ 
                      padding: '0.3rem 0.8rem',
                      backgroundColor: order.status === 'delivered' ? '#52c41a' : 
                                     order.status === 'processing' ? '#1890ff' : '#faad14',
                      color: 'white',
                      borderRadius: '15px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {order.status}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                    GH₵{order.total} • {order.items.length} item(s)
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#999' }}>
                    {new Date(order.createdAt).toLocaleString()}
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
                    📧 {order.recipientEmail} • 📞 {order.recipientPhone}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Network Statistics */}
        <div>
          <h3 style={{ borderBottom: '2px solid #52c41a', paddingBottom: '0.5rem' }}>
            📱 Network Distribution
          </h3>
          {Object.keys(networkStats).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
              No network data available
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {Object.entries(networkStats).map(([network, count]) => (
                <div key={network} style={{ 
                  border: '1px solid #e8e8e8',
                  borderRadius: '8px',
                  padding: '1rem',
                  backgroundColor: 'white'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: network === 'MTN' ? '#ff4d4f' : '#52c41a' }}>
                      {network}
                    </span>
                    <span style={{ 
                      padding: '0.3rem 0.8rem',
                      backgroundColor: network === 'MTN' ? '#ff4d4f' : '#52c41a',
                      color: 'white',
                      borderRadius: '15px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold'
                    }}>
                      {count} orders
                    </span>
                  </div>
                  <div style={{ 
                    marginTop: '0.5rem',
                    height: '8px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      backgroundColor: network === 'MTN' ? '#ff4d4f' : '#52c41a',
                      width: `${(count / totalAllTimeOrders) * 100}%`,
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All-time Revenue */}
      <div style={{ 
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#fff7e6',
        border: '1px solid #ffd591',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#fa8c16', marginBottom: '0.5rem' }}>💰 All-Time Revenue</h3>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fa8c16' }}>
          GH₵{totalAllTimeRevenue}
        </div>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
          Total revenue generated from all {totalAllTimeOrders} orders
        </p>
      </div>

      {/* Refresh Button */}
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '0.8rem 1.5rem',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🔄 Refresh Dashboard
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
