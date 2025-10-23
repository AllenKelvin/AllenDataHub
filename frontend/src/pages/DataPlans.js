import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { plansAPI } from '../services/api';

const DataPlans = () => {
  const { addToCart } = useCart();
  const [selectedNetwork, setSelectedNetwork] = useState('All');
  const [phoneNumbers, setPhoneNumbers] = useState({});
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Ghanaian phone number validation
  const isValidGhanaNumber = (phone) => {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const ghanaRegex = /^(020|023|024|025|026|027|028|029|030|050|054|055|056|057|058|059)\d{7}$/;
    return ghanaRegex.test(cleanPhone);
  };

  // Fetch data plans from backend
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const response = await plansAPI.getAll();
        setPlans(response.data);
      } catch (error) {
        console.error('Error fetching data plans:', error);
        setError('Failed to load data plans. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const filteredPlans = selectedNetwork === 'All' 
    ? plans 
    : plans.filter(plan => plan.network === selectedNetwork);

  const handlePhoneChange = (planId, phone) => {
    setPhoneNumbers({
      ...phoneNumbers,
      [planId]: phone
    });
  };

  const handleAddToCart = (plan) => {
    const phoneNumber = phoneNumbers[plan._id] || '';
    
    if (!phoneNumber) {
      alert('Please enter a phone number for this data plan');
      return;
    }

    if (!isValidGhanaNumber(phoneNumber)) {
      alert('Please enter a valid Ghanaian phone number');
      return;
    }

    const planWithPhone = {
      ...plan,
      id: plan._id,
      recipientPhone: phoneNumber
    };

    addToCart(planWithPhone);
    alert(`${plan.network} ${plan.size} added to cart!`);
    
    setPhoneNumbers({
      ...phoneNumbers,
      [plan._id]: ''
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Loading data plans...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#ff4d4f' }}>Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '0.8rem 1.5rem',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#1890ff' }}>Data Plans</h1>
      
      {/* Network Filter */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <button 
          onClick={() => setSelectedNetwork('All')}
          style={{ 
            margin: '0 0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: selectedNetwork === 'All' ? '#1890ff' : '#f0f0f0',
            color: selectedNetwork === 'All' ? 'white' : '#333',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          All Networks
        </button>
        <button 
          onClick={() => setSelectedNetwork('MTN')}
          style={{ 
            margin: '0 0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: selectedNetwork === 'MTN' ? '#ff4d4f' : '#f0f0f0',
            color: selectedNetwork === 'MTN' ? 'white' : '#333',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          MTN
        </button>
        <button 
          onClick={() => setSelectedNetwork('Telecel')}
          style={{ 
            margin: '0 0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: selectedNetwork === 'Telecel' ? '#52c41a' : '#f0f0f0',
            color: selectedNetwork === 'Telecel' ? 'white' : '#333',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Telecel
        </button>
      </div>

      {/* Data Plans Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem' 
      }}>
        {filteredPlans.map(plan => (
          <div key={plan._id} style={{ 
            border: '1px solid #e8e8e8', 
            padding: '1.5rem', 
            borderRadius: '10px',
            textAlign: 'center',
            position: 'relative',
            backgroundColor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {plan.popular && (
              <span style={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#ff4d4f',
                color: 'white',
                padding: '0.3rem 1rem',
                borderRadius: '15px',
                fontSize: '0.8rem',
                fontWeight: 'bold'
              }}>
                MOST POPULAR
              </span>
            )}
            
            <h3 style={{ 
              color: plan.network === 'MTN' ? '#ff4d4f' : '#52c41a',
              marginBottom: '1rem'
            }}>
              {plan.network} {plan.size}
            </h3>
            
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1890ff', marginBottom: '1rem' }}>
              GH₵{plan.price}
            </div>
            
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              Valid for {plan.validity}
            </p>

            {/* Phone Number Input */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                fontSize: '0.9rem',
                color: '#333'
              }}>
                Phone Number *
              </label>
              <input
                type="tel"
                value={phoneNumbers[plan._id] || ''}
                onChange={(e) => handlePhoneChange(plan._id, e.target.value)}
                placeholder="Enter phone number"
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  border: '1px solid #d9d9d9',
                  borderRadius: '5px',
                  fontSize: '1rem',
                  textAlign: 'center'
                }}
              />
              {phoneNumbers[plan._id] && !isValidGhanaNumber(phoneNumbers[plan._id]) && (
                <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Please enter a valid Ghanaian number
                </div>
              )}
            </div>
            
            <button 
              onClick={() => handleAddToCart(plan)}
              disabled={phoneNumbers[plan._id] && !isValidGhanaNumber(phoneNumbers[plan._id])}
              style={{
                padding: '0.8rem 2rem',
                backgroundColor: (phoneNumbers[plan._id] && !isValidGhanaNumber(phoneNumbers[plan._id])) ? '#d9d9d9' : '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: (phoneNumbers[plan._id] && !isValidGhanaNumber(phoneNumbers[plan._id])) ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                width: '100%',
                opacity: (phoneNumbers[plan._id] && !isValidGhanaNumber(phoneNumbers[plan._id])) ? 0.6 : 1
              }}
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>

      {filteredPlans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          <h3>No data plans found</h3>
        </div>
      )}
    </div>
  );
};

export default DataPlans;
