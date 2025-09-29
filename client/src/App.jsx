import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

const EmbeddableChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hi there! 👋 I'm AgiAI, your technical assistant. How can I help you today?", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const API_BASE_URL = 'http://localhost:3000';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const callAPI = async (message) => {
    try {
      const response = await fetch(`${API_BASE_URL}/getMsg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          role: 'user'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  const sendMessage = async () => {
    const message = inputValue.trim();
    if (!message) return;

    setError(null);

    const newMessage = {
      id: Date.now(),
      text: message,
      sender: 'user'
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const botResponse = await callAPI(message);
      
      const botMessage = {
        id: Date.now() + 1,
        text: botResponse,
        sender: 'bot'
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I'm having trouble connecting to my brain right now 🤖. Please try again in a moment!",
        sender: 'bot',
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setError('Failed to get response from AI assistant');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isTyping) {
      sendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (error) setError(null);
  };

  const TypingIndicator = () => (
    <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-2xl rounded-bl-md max-w-[85%]">
      <span className="text-sm">AgiAI is thinking</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-blue-700 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed bottom-5 right-5 z-[9999] font-sans">
      {/* Toggle Button */}
      <button
        onClick={toggleChat}
        className="w-14 h-14 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center text-white"
        style={{ transform: isOpen ? 'rotate(180deg) scale(1.1)' : 'scale(1)' }}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chatbox */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-fadeIn">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-semibold">
              AI
            </div>
            <div>
              <h3 className="font-semibold text-lg">AgiAI Assistant</h3>
              <p className="text-sm opacity-90">Online • Technical Support</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-2 bg-red-50 border-l-4 border-red-400 text-red-700 text-xs">
              {error}
            </div>
          )}

          {/* Messages */}
          <div className="h-96 overflow-y-auto p-5 bg-gray-50 flex flex-col gap-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                  message.sender === 'bot'
                    ? `${message.isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700'} self-start rounded-bl-md`
                    : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white self-end rounded-br-md'
                }`}
              >
                {message.text}
              </div>
            ))}
            
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-100 flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything technical..."
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              disabled={isTyping}
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isTyping}
              className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmbeddableChatbot;