import React from 'react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';

const Cart = () => {
  const { cartItems, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#1890ff' }}>Shopping Cart</h1>
      
      {cartItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2rem' }}>Your cart is empty</p>
          <button 
            onClick={() => navigate('/plans')}
            style={{
              padding: '1rem 2rem',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Browse Data Plans
          </button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '2rem' }}>
            {cartItems.map(item => (
              <div key={item.id} style={{ 
                border: '1px solid #e8e8e8', 
                padding: '1.5rem', 
                marginBottom: '1rem', 
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'white'
              }}>
                <div>
                  <h3 style={{ margin: 0, color: '#333' }}>{item.network} {item.size}</h3>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
                    To: <strong>{item.recipientPhone}</strong> • Valid for {item.validity}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1890ff', marginBottom: '0.5rem' }}>
                    GH₵{item.price}
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    style={{
                      padding: '0.3rem 0.8rem',
                      backgroundColor: '#ff4d4f',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ 
            borderTop: '2px solid #e8e8e8', 
            paddingTop: '1.5rem',
            textAlign: 'center' 
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              Total: GH₵{total}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={clearCart}
                style={{
                  padding: '0.8rem 1.5rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Clear Cart
              </button>
              <button 
                onClick={() => navigate('/checkout')}
                style={{
                  padding: '0.8rem 2rem',
                  backgroundColor: '#52c41a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Cart;
