import React from 'react';

const Footer = () => {
  return (
    <footer style={{ 
      padding: '2rem', 
      backgroundColor: '#001529', 
      color: 'white', 
      textAlign: 'center', 
      marginTop: 'auto'
    }}>
      <p style={{ margin: 0 }}>&copy; 2024 AllenDataHub. All rights reserved.</p>
      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#ccc' }}>
        Instant MTN and Telecel data bundles in Ghana
      </p>
      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
        Founded by Allen Kelvin & Devon Allen
      </p>
    </footer>
  );
};

export default Footer;
