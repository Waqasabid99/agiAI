import React from 'react';
import ReactDOM from 'react-dom/client';
import Chatbot from './App';

// Widget initialization function
window.AgiAIChatbot = {
  init: function(config = {}) {
    // Prevent multiple initializations
    if (document.getElementById('agiai-chatbot-root')) {
      console.warn('AgiAI Chatbot already initialized');
      return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = 'agiai-chatbot-root';
    document.body.appendChild(container);

    // Create root and render
    const root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <Chatbot config={config} />
      </React.StrictMode>
    );
  }
};

// Auto-initialize if data attribute is present
if (document.currentScript && document.currentScript.hasAttribute('data-auto-init')) {
  window.addEventListener('DOMContentLoaded', () => {
    window.AgiAIChatbot.init();
  });
}