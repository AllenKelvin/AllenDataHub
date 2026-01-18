import React from 'react';
import { useTheme } from '../context/ThemeContext';

const Logo = () => {
  const { darkMode } = useTheme();
  
  return (
    <div className="logo-container">
      <div className="logo">
        <span role="img" aria-label="portal" className="logo-icon">🚀</span>
        <div className="logo-text">
          <h1 className="logo-title">Portal 02</h1>
          <p className="logo-subtitle">Secure Data Hub</p>
        </div>
      </div>
      <style jsx>{`
        .logo-container {
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .logo {
          display: inline-flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-radius: 12px;
          background: ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)'};
          backdrop-filter: blur(10px);
        }
        
        .logo-icon {
          font-size: 2.5rem;
          animation: float 3s ease-in-out infinite;
        }
        
        .logo-text {
          text-align: left;
        }
        
        .logo-title {
          margin: 0;
          font-size: 1.8rem;
          font-weight: bold;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .logo-subtitle {
          margin: 0;
          font-size: 0.9rem;
          color: ${darkMode ? '#94a3b8' : '#64748b'};
          opacity: 0.8;
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
};

export default Logo;