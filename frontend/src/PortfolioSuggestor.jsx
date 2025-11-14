import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, Loader2 } from 'lucide-react';

// Use relative URL for proxy; replace as needed for production
const WEBHOOK_URL = '/n8n/webhook/82d63927-dc2e-416f-abf9-9915cbb2d705';
console.log(WEBHOOK_URL)

const PortfolioSuggestor = ({onBackToTrading}) => {
  // Use stable sessionId between reloads
  const [sessionId, setSessionId] = useState(() =>
    localStorage.getItem('sessionId') || `user-${Date.now()}`
  );

  // Load messages from localStorage, defaulting to intro assistant message
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(`chat_${sessionId}`);
    return saved
      ? JSON.parse(saved)
      : [
          {
            role: 'assistant',
            content:
              "Hello! 👋 I'm your AI Finance Assistant.\n\n• 📊 Portfolio Generation\n• 📈 Recent IPO Listings\n• 💡 Finance Queries\n• 🗂️ Basket Creator\n\nHow can I assist you today?",
            timestamp: new Date()
          }
        ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Persist sessionId for future reloads
  useEffect(() => {
    localStorage.setItem('sessionId', sessionId);
  }, [sessionId]);

  // Save messages to localStorage on change
  useEffect(() => {
    localStorage.setItem(`chat_${sessionId}`, JSON.stringify(messages));
  }, [messages, sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const parseMessageContent = (content) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const iframeUrlPattern = /https:\/\/ashish-in-progress\.github\.io\/html\/\?user=/;
    
    // Check if content contains the iframe URL pattern
    const urls = content.match(urlRegex);
    const hasIframeUrl = urls && urls.some(url => iframeUrlPattern.test(url));
    
    if (hasIframeUrl) {
      const iframeUrl = urls.find(url => iframeUrlPattern.test(url));
      const parts = content.split(urlRegex);
      
      return (
        <div>
          {parts.map((part, index) =>
            urlRegex.test(part) && iframeUrlPattern.test(part) ? (
              <div key={index} style={{ marginTop: '10px' }}>
                <a
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                  style={{ display: 'block', marginBottom: '10px' }}
                >
                  {part}
                </a>
                <iframe
                  src={part}
                  style={{
                    width: '100%',
                    height: '600px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px'
                  }}
                  title="Portfolio Visualization"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            ) : urlRegex.test(part) ? (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                {part}
              </a>
            ) : (
              <span key={index}>{part}</span>
            )
          )}
        </div>
      );
    }
    
    // Default behavior for messages without iframe URLs
    const parts = content.split(urlRegex);
    return parts.map((part, index) =>
      urlRegex.test(part) ? (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          {part}
        </a>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId, // provide sessionId for n8n memory key
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();

      const assistantMessage = {
        role: 'assistant',
        content:
          data.output || data.response || data.message || 'Sorry, empty response received.',
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'error',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date()
        }
      ]);
      console.error(err); // For debugging
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const quickActions = [
    { text: 'Generate Portfolio', message: 'I want to generate an investment portfolio' },
    { text: 'Recent IPOs', message: 'Show me recent IPO listings' },
    { text: 'Create Basket', message: 'I want to create a stock basket' },
    { text: 'Finance Query', message: 'I have a finance question' }
  ];

  const handleQuickAction = (message) => {
    setInputMessage(message);
    inputRef.current?.focus();
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear the chat?")) {
      localStorage.removeItem(`chat_${sessionId}`);
      setMessages([
        {
          role: 'assistant',
          content:
            "Chat cleared 🧹. How can I assist you now?",
          timestamp: new Date()
        }
      ]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="portfolio-container">
      {/* Header */}
      <div className="portfolio-header">
        {onBackToTrading && (
        <button
          className="btn btn-secondary"
          onClick={onBackToTrading}
          style={{ 
            background: 'rgba(255,255,255,0.1)', 
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: '600'
          }}
        >
          ← Back to Tools
        </button>
        
      )}
      
        <div className="header-left">
          <Bot className="header-icon" />
          <div>
            <h1 className="header-title">AI Portfolio Suggestor</h1>
            <p className="header-subtitle">
              Your intelligent finance assistant
            </p>
          </div>
        </div>
        
        <button className="clear-chat-btn" onClick={handleClearChat}>
          🧹 Clear Chat
        </button>
        
        <div className="header-status">🟢 AI Online</div>
      </div>

      {/* Content Section */}
      <div className="portfolio-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                className="action-btn"
                onClick={() => handleQuickAction(action.message)}
                aria-label={action.text}
              >
                {action.text}
              </button>
            ))}
          </div>
          <div className="features-box">
            <h3>Features</h3>
            <ul>
              <li>Smart Portfolio Generation</li>
              <li>Live IPO Updates</li>
              <li>Custom Stock Baskets</li>
              <li>Expert Finance Advice</li>
            </ul>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="chat-area">
          <div className="chat-header">
            <Bot className="chat-header-icon" />
            <div>
              <h2>Finance AI Assistant</h2>
              <p>Always ready to help</p>
            </div>
          </div>

          <div className="messages-box">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message-row ${msg.role === 'user' ? 'user-row' : (msg.role === 'error' ? 'error-row' : 'assistant-row')}`}
              >
                <div className={`avatar ${msg.role}-avatar`}>
                  {msg.role === 'user' ? (
                    <User />
                  ) : msg.role === 'error' ? (
                    <AlertCircle />
                  ) : (
                    <Bot />
                  )}
                </div>
                <div className={`message-bubble ${msg.role}-bubble`}>
                  <div className="message-text">
                    {msg.role === 'assistant' || msg.role === 'error'
                      ? parseMessageContent(msg.content)
                      : msg.content}
                  </div>
                  <div className="message-time">
                    {msg.timestamp instanceof Date
                      ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message-row assistant-row">
                <div className="avatar assistant-avatar">
                  <Bot />
                </div>
                <div className="message-bubble assistant-bubble">
                  <Loader2 className="loader" />
                  <span>AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef}></div>
          </div>

          {/* Input */}
          <div className="input-area">
            <div className="input-form">
              <input
                type="text"
                ref={inputRef}
                className="input-field"
                value={inputMessage}
                placeholder="Ask about portfolios, IPOs, stocks..."
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                aria-label="Chat input"
              />
              <button
                onClick={handleSendMessage}
                className="send-btn"
                disabled={isLoading || !inputMessage.trim()}
                aria-label="Send message"
              >
                {isLoading ? <Loader2 className="loader" /> : <Send />}
              </button>
            </div>
          </div>
        </main>
      </div>
      
      <style>{`
        /* Improved Modern CSS for Portfolio App */

        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background-color: #f1f4f9;
          color: #1e1e2f;
        }

        .portfolio-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }

        /* HEADER */
        .portfolio-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(90deg, #1f2937, #111827);
          padding: 0.75rem 2rem;
          color: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          gap: 1.5rem;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
        }

        .header-icon {
          width: 36px;
          height: 36px;
          color: #38bdf8;
        }

        .header-title {
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.2;
          margin: 0;
        }

        .header-subtitle {
          font-size: 0.9rem;
          color: #cbd5e1;
          font-weight: 400;
          margin: 0;
        }

        .header-status {
          background-color: #10b981;
          padding: 0.4rem 0.9rem;
          border-radius: 20px;
          font-weight: 600;
          font-size: 0.8rem;
          box-shadow: 0 0 10px rgba(16,185,129,0.5);
          white-space: nowrap;
        }

        .clear-chat-btn {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .clear-chat-btn:hover {
          background: rgba(239, 68, 68, 0.25);
          border-color: rgba(239, 68, 68, 0.5);
          transform: translateY(-1px);
        }

        /* CONTENT LAYOUT */
        .portfolio-content {
          flex: 1;
          display: flex;
          height: calc(100vh - 65px);
          overflow: hidden;
        }

        /* SIDEBAR */
        .sidebar {
          width: 280px;
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          padding: 1.5rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          box-shadow: 4px 0 18px rgba(0,0,0,0.05);
        }

        .quick-actions h3, .features-box h3 {
          font-size: 0.95rem;
          margin-bottom: 1rem;
          font-weight: 700;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .action-btn {
          width: 100%;
          padding: 0.75rem 1rem;
          margin-bottom: 0.5rem;
          border-radius: 10px;
          background: #eef4ff;
          border: 1px solid #d0ddff;
          color: #1e293b;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.95rem;
          font-weight: 600;
          text-align: left;
        }
        .action-btn:hover {
          background: #dbe7ff;
          transform: translateX(3px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .action-btn.danger {
          background: #ffdadb;
          border-color: #ff9a9e;
          color: #b91c1c;
        }
        .action-btn.danger:hover {
          background: #ffb3b7;
          transform: translateX(3px);
        }

        .features-box ul {
          list-style: none;
          padding-left: 0;
        }

        .features-box li {
          margin-bottom: 0.65rem;
          padding-left: 1.2rem;
          position: relative;
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .features-box li::before {
          content: "";
          width: 8px;
          height: 8px;
          background: #60a5fa;
          border-radius: 50%;
          position: absolute;
          left: 0;
          top: 8px;
        }

        /* CHAT AREA */

        /* Custom Scrollbar */
        .messages-box::-webkit-scrollbar {
          width: 10px;
        }
        .messages-box::-webkit-scrollbar-track {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .messages-box::-webkit-scrollbar-thumb {
          background: #9ca3af;
          border-radius: 10px;
          border: 2px solid #e5e7eb;
        }
        .messages-box::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }

        .chat-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #fafbff;
        }

        .chat-header {
          display: flex;
          align-items: center;
          background: #e4e9ff;
          padding: 1rem 2rem;
          border-bottom: 1px solid #c7d2fe;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }

        .chat-header h2 {
          margin: 0;
          font-size: 1.1rem;
        }

        .chat-header p {
          margin: 0;
          font-size: 0.85rem;
          color: #6b7280;
        }

        .chat-header-icon {
          width: 28px;
          height: 28px;
          margin-right: 1rem;
          color: #4f46e5;
        }

        .messages-box {
          flex: 1;
          padding: 1.75rem 2rem;
          overflow-y: auto;
          background: #ffffff;
          border-bottom: 1px solid #cbd5e1;
        }

        .message-row {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .user-row { justify-content: flex-end; }
        .assistant-row { justify-content: flex-start; }
        .error-row { justify-content: flex-start; }

        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          flex-shrink: 0;
        }

        .user-avatar { background: #2563eb; color: white; }
        .assistant-avatar { background: #4f46e5; color: white; }
        .error-avatar { background: #dc2626; color: white; }

        .message-bubble {
          max-width: 70%;
          padding: 0.9rem 1.25rem;
          border-radius: 16px;
          font-size: 1.08rem;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
          white-space: pre-wrap;
        }

        .user-bubble {
          background: #3b82f6;
          color: white;
          border-bottom-right-radius: 4px;
        }

        .assistant-bubble {
          background: #f3f4f6;
          color: #374151;
          border-bottom-left-radius: 4px;
        }

        .error-bubble {
          background: #fee2e2;
          color: #b91c1c;
          border-bottom-left-radius: 4px;
        }

        .message-time {
          font-size: 0.75rem;
          opacity: 0.6;
          margin-top: 0.5rem;
        }

        .loader {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* INPUT BOX */
        .input-area {
          padding: 1rem 2rem;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }

        .input-form {
          display: flex;
          gap: 1rem;
        }

        .input-field {
          flex-grow: 1;
          padding: 0.85rem 1rem;
          font-size: 1.08rem;
          border-radius: 14px;
          background: white;
          border: 1.6px solid #d1d5db;
          transition: all 0.2s ease;
          outline: none;
        }
        .input-field:focus {
          border-color: #6366f1;
          box-shadow: 0 0 8px rgba(99,102,241,0.3);
        }

        .send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #4f46e5;
          border: none;
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.1s ease;
        }
        .send-btn:hover:not(:disabled) {
          background: #4338ca;
          transform: translateY(-2px);
        }
        .send-btn:disabled {
          background: #a5b4fc;
          cursor: not-allowed;
        }

        .link {
          color: #3b82f6;
          text-decoration: underline;
        }

        .link:hover {
          color: #2563eb;
        }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .portfolio-content { flex-direction: column; }
          .sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid #e1e4e8;
          }
        }

        @media (max-width: 500px) {
          .header-title { font-size: 1.2rem; }
          .input-field { font-size: 1rem; }
          .send-btn { width: 34px; height: 34px; }
        }
      `}</style>
    </div>
  );
};

export default PortfolioSuggestor;