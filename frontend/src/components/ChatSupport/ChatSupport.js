// src/components/ChatSupport/ChatSupport.js
import React, { useState } from 'react';
import './ChatSupport.css';

const ChatSupport = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const supportOptions = [
    {
      id: 1,
      title: "Join Community Group",
      icon: "👥",
      description: "Connect with other users",
      link: "https://chat.whatsapp.com/JaqjPu6Yhp453JVtKeII2z",
      color: "#25D366"
    },
    {
      id: 2,
      title: "Chat with Admin",
      icon: "💬",
      description: "Get direct support",
      link: "https://wa.me/qr/KFPAZ35ZMR3XG1",
      color: "#075E54"
    }
  ];

  const handleOptionClick = (link, title) => {
    // Show confirmation modal
    setShowConfirmation({
      show: true,
      title: title,
      link: link
    });
  };

  const confirmRedirect = () => {
    if (showConfirmation.link) {
      window.open(showConfirmation.link, '_blank', 'noopener,noreferrer');
    }
    setShowConfirmation({ show: false, title: '', link: '' });
    setIsOpen(false);
  };

  const cancelRedirect = () => {
    setShowConfirmation({ show: false, title: '', link: '' });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <div 
        className={`chat-button ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="chat-icon">
          {isOpen ? '✕' : '💬'}
        </div>
        <span className="chat-label">Support</span>
      </div>

      {/* Chat Options Panel */}
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <h3>Support Options</h3>
            <p>Get help or join our community</p>
          </div>
          
          <div className="chat-options">
            {supportOptions.map(option => (
              <div 
                key={option.id}
                className="chat-option"
                onClick={() => handleOptionClick(option.link, option.title)}
                style={{ '--option-color': option.color }}
              >
                <div className="option-icon" style={{ backgroundColor: option.color }}>
                  {option.icon}
                </div>
                <div className="option-content">
                  <h4>{option.title}</h4>
                  <p>{option.description}</p>
                </div>
                <div className="option-arrow">
                  ↗
                </div>
              </div>
            ))}
          </div>

          <div className="chat-footer">
            <p className="response-time">
              ⏰ Average response time: 15 minutes
            </p>
            <p className="availability">
              🕒 Available: 8:00 AM - 10:00 PM GMT
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation.show && (
        <div className="confirmation-modal">
          <div className="modal-content">
            <div className="modal-icon">⚠️</div>
            <h3>Leaving AllenDataHub</h3>
            <p>
              You're about to be redirected to {showConfirmation.title}. 
              This will open in a new tab.
            </p>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel-btn"
                onClick={cancelRedirect}
              >
                Cancel
              </button>
              <button 
                className="modal-btn confirm-btn"
                onClick={confirmRedirect}
              >
                Continue
              </button>
            </div>
          </div>
          <div className="modal-overlay" onClick={cancelRedirect}></div>
        </div>
      )}
    </>
  );
};

export default ChatSupport;