import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi there! 👋 I'm AgiAI, your technical assistant. How can I help you today?",
      sender: "bot",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const API_BASE_URL = "https://kit-noninitial-unusably.ngrok-free.dev";

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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: message,
          role: "user",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error("API Error:", error);
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
      sender: "user",
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      const botResponse = await callAPI(message);
      const botMessage = {
        id: Date.now() + 1,
        text: botResponse,
        sender: "bot",
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I'm having trouble connecting right now 🤖. Please try again!",
        sender: "bot",
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setError("Failed to get response");
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !isTyping) {
      sendMessage();
    }
  };

  // Inline styles
  const styles = {
    container: {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: 9999,
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    toggleButton: {
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      border: "none",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "24px",
      transition: "all 0.3s ease",
      transform: isOpen ? "rotate(180deg) scale(1.1)" : "scale(1)",
    },
    chatbox: {
      position: "absolute",
      bottom: "70px",
      right: "0",
      width: "350px",
      maxWidth: "calc(100vw - 40px)",
      height: "500px",
      maxHeight: "calc(100vh - 100px)",
      backgroundColor: "white",
      borderRadius: "16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      display: isOpen ? "flex" : "none",
      flexDirection: "column",
      overflow: "hidden",
      animation: isOpen ? "slideUp 0.3s ease" : "none",
    },
    header: {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      padding: "20px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    avatar: {
      width: "40px",
      height: "40px",
      backgroundColor: "rgba(255,255,255,0.2)",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "600",
      fontSize: "16px",
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      fontWeight: "600",
      fontSize: "16px",
      marginBottom: "2px",
    },
    headerSubtitle: {
      fontSize: "12px",
      opacity: 0.9,
    },
    errorBanner: {
      padding: "8px 16px",
      backgroundColor: "#fee2e2",
      borderLeft: "4px solid #ef4444",
      color: "#991b1b",
      fontSize: "12px",
    },
    messagesContainer: {
      flex: 1,
      overflowY: "auto",
      padding: "20px",
      backgroundColor: "#f9fafb",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
    message: {
      maxWidth: "85%",
      padding: "12px",
      borderRadius: "16px",
      fontSize: "14px",
      lineHeight: "1.5",
      wordWrap: "break-word",
    },
    botMessage: {
      alignSelf: "flex-start",
      backgroundColor: "#eff6ff",
      color: "#1e40af",
      borderBottomLeftRadius: "4px",
    },
    userMessage: {
      alignSelf: "flex-end",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      borderBottomRightRadius: "4px",
    },
    errorMessage: {
      alignSelf: "flex-start",
      backgroundColor: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fecaca",
      borderBottomLeftRadius: "4px",
    },
    typingIndicator: {
      alignSelf: "flex-start",
      backgroundColor: "#eff6ff",
      color: "#1e40af",
      borderRadius: "16px",
      borderBottomLeftRadius: "4px",
      padding: "12px",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    inputContainer: {
      padding: "16px",
      backgroundColor: "white",
      borderTop: "1px solid #e5e7eb",
      display: "flex",
      gap: "12px",
      alignItems: "center",
    },
    input: {
      flex: 1,
      border: "1px solid #e5e7eb",
      borderRadius: "24px",
      padding: "10px 16px",
      fontSize: "14px",
      outline: "none",
      transition: "border-color 0.2s",
      color: "black",
    },
    sendButton: {
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      border: "none",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "18px",
      transition: "transform 0.2s",
      opacity: inputValue.trim() && !isTyping ? 1 : 0.5,
    },
    dot: {
      width: "6px",
      height: "6px",
      backgroundColor: "#1e40af",
      borderRadius: "50%",
      animation: "bounce 1.4s infinite ease-in-out",
    },
  };

  // Add animation keyframes
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  return (
    <div style={styles.container}>
      {/* Toggle Button */}
      <button onClick={() => setIsOpen(!isOpen)} style={styles.toggleButton}>
        {isOpen ? "×" : "💬"}
      </button>

      {/* Chatbox */}
      <div style={styles.chatbox}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.avatar}>AI</div>
          <div style={styles.headerText}>
            <div style={styles.headerTitle}>AgiAI Assistant</div>
            <div style={styles.headerSubtitle}>Online • Technical Support</div>
          </div>
        </div>

        {/* Error Banner */}
        {error && <div style={styles.errorBanner}>{error}</div>}

        {/* Messages */}
        <div style={styles.messagesContainer}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.message,
                ...(msg.sender === "bot"
                  ? msg.isError
                    ? styles.errorMessage
                    : styles.botMessage
                  : styles.userMessage),
              }}
            >
              {msg.sender === "bot" && !msg.isError ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.text}
                </ReactMarkdown>
              ) : (
                msg.text
              )}
            </div>
          ))}

          {isTyping && (
            <div style={styles.typingIndicator}>
              <span>AgiAI is thinking</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.dot,
                      animationDelay: `${i * 0.16}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={styles.inputContainer}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={(e) => (e.target.style.borderColor = "#667eea")}
            onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
            placeholder="Ask me anything..."
            disabled={isTyping}
            style={styles.input}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isTyping}
            onMouseEnter={(e) =>
              !e.currentTarget.disabled &&
              (e.currentTarget.style.transform = "scale(1.05)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            style={styles.sendButton}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
