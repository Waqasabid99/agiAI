import React from 'react';
import { createRoot } from 'react-dom/client';
import Chatbot from './App'; // or './Chatbot' depending on your file structure

// Initialize function
const init = (config = {}) => {
  try {
    // Check if already initialized
    if (document.getElementById('agiai-chatbot-root')) {
      console.warn('AgiAI Chatbot already initialized');
      return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = 'agiai-chatbot-root';
    document.body.appendChild(container);

    // Create and render
    const root = createRoot(container);
    root.render(<Chatbot config={config} />);
    
    console.log('AgiAI Chatbot initialized successfully');
  } catch (error) {
    console.error('Failed to initialize AgiAI Chatbot:', error);
  }
};

// Expose globally
if (typeof window !== 'undefined') {
  window.AgiAIChatbot = { init };
  
  // Auto-init check
  const script = document.currentScript;
  if (script && script.hasAttribute('data-auto-init')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => init());
    } else {
      setTimeout(() => init(), 0);
    }
  }
}

export default { init };