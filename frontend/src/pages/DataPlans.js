import React, { useState, useEffect } from 'react';
import { plansAPI } from '../services/api';
import './DataPlans.css';

function DataPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        console.log('🔄 Fetching data plans...');
        const response = await plansAPI.getPlans();
        console.log('✅ Plans fetched:', response.data);
        setPlans(response.data);
        setLoading(false);
      } catch (err) {
        console.error('❌ Error fetching plans:', err);
        setError('Failed to load data plans. Please try again.');
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  if (loading) return <div className="loading">Loading data plans...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="data-plans">
      <h1>Data Plans</h1>
      <div className="plans-grid">
        {plans.map((plan, index) => (
          <div key={index} className={`plan-card ${plan.popular ? 'popular' : ''}`}>
            {plan.popular && <div className="popular-badge">Popular</div>}
            <div className="plan-network">{plan.network}</div>
            <div className="plan-size">{plan.size}</div>
            <div className="plan-price">GH₵{plan.price}</div>
            <div className="plan-validity">{plan.validity}</div>
            <button className="btn btn-primary">Buy Now</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DataPlans;
