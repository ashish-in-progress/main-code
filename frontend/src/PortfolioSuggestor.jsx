import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, Loader2, ArrowLeft, Briefcase, TrendingUp, HelpCircle, Layers } from 'lucide-react';

// Use relative URL for proxy; replace as needed for production
const WEBHOOK_URL = '/n8n/webhook/82d63927-dc2e-416f-abf9-9915cbb2d705';

const PortfolioSuggestor = ({ onBackToTrading }) => {
  // Use stable sessionId between reloads
  const [sessionId, setSessionId] = useState(() =>
    localStorage.getItem('portfolioSessionId') || `portfolio-${Date.now()}`
  );

  // Load messages from localStorage
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.setItem(`chat_portfolio_${sessionId}`, JSON.stringify(messages));  // ✅
    return saved
      ? JSON.parse(saved)
      : [
          {
            role: 'assistant',
            content:
              "Hello! 👋 I'm your AI Finance Assistant.\n\nI can help you with:\n• 📊 Generating Portfolios\n• 📈 Tracking Recent IPOs\n• 💡 General Finance Queries\n• 🗂️ Creating Stock Baskets\n\nHow can I assist you today?",
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
  localStorage.setItem('portfolioSessionId', sessionId);
}, [sessionId]);

  // Save messages to localStorage on change
  useEffect(() => {
    localStorage.getItem('portfolioSessionId') || `portfolio-${Date.now()}`
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
      const parts = content.split(urlRegex);
      return (
        <div>
          {parts.map((part, index) =>
            urlRegex.test(part) && iframeUrlPattern.test(part) ? (
              <div key={index} className="iframe-container">
                <div className="iframe-header">
                    <span>📊 Portfolio Visualization</span>
                    <a href={part} target="_blank" rel="noopener noreferrer" className="external-link">Open New Tab ↗</a>
                </div>
                <iframe
                  src={part}
                  className="portfolio-iframe"
                  title="Portfolio Visualization"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            ) : urlRegex.test(part) ? (
              <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="link">
                {part}
              </a>
            ) : (
              <span key={index}>{part}</span>
            )
          )}
        </div>
      );
    }
    
    // Default behavior
    const parts = content.split(urlRegex);
    return parts.map((part, index) =>
      urlRegex.test(part) ? (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="link">
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
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.output || data.response || data.message || 'Sorry, empty response received.',
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date() }
      ]);
      console.error(err);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const quickActions = [
    { icon: <Briefcase size={16}/>, text: 'Generate Portfolio', message: 'I want to generate an investment portfolio' },
    { icon: <TrendingUp size={16}/>, text: 'Recent IPOs', message: 'Show me recent IPO listings' },
    { icon: <Layers size={16}/>, text: 'Create Basket', message: 'I want to create a stock basket' },
    { icon: <HelpCircle size={16}/>, text: 'Finance Query', message: 'I have a finance question' }
  ];

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear the chat history?")) {
      localStorage.removeItem(`chat_portfolio_${sessionId}`);
      setMessages([{
        role: 'assistant',
        content: "Chat cleared 🧹. How can I assist you now?",
        timestamp: new Date()
      }]);
    }
  };

  const renderMessage = (msg, index) => {
    const roleClass = {
      user: 'message-user',
      assistant: 'message-assistant',
      error: 'message-error'
    }[msg.role];

    return (
      <div key={index} className={`message ${roleClass}`}>
         <div className="message-header">
          <span className="message-role">
            {msg.role === 'user' ? '👤 You' : msg.role === 'error' ? '❌ Error' : '🤖 Portfolio AI'}
          </span>
          <span className="message-time">
             {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="message-content">
          {msg.role === 'assistant' || msg.role === 'error' ? parseMessageContent(msg.content) : msg.content}
        </div>
      </div>
    );
  };

  return (
    <div className="app" style={{ height: '100%' }}> 
      {/* Reusing the app structure from App.js via CSS classes */}
      
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ fontSize: '20px' }}>
          <Bot className="text-blue-500" /> Portfolio AI
        </div>

        <div className="sidebar-section">
          <h3>Quick Actions</h3>
          <div className="quick-actions-list">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                className="quick-action-btn"
                onClick={() => {
                    setInputMessage(action.message);
                    inputRef.current?.focus();
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', marginBottom: '8px' }}
              >
                {action.icon}
                {action.text}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-section">
          <h3>About</h3>
          <div className="info-card" style={{ padding: '15px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#64748b' }}>
            <p style={{marginBottom: '10px'}}>This AI agent uses advanced algorithms to suggest portfolios and track market events.</p>
            <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                <div style={{width:'8px', height:'8px', background:'#10b981', borderRadius:'50%'}}></div>
                <span>System Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="top-header">
            <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {onBackToTrading && (
                    <button onClick={onBackToTrading} className="btn btn-secondary btn-sm">
                        <ArrowLeft size={16} /> Back
                    </button>
                )}
                <div>
                    <h1>Portfolio Suggestor</h1>
                    <span className="subtitle">AI-Powered Wealth Management</span>
                </div>
            </div>
            <div className="header-actions">
                <button className="btn btn-secondary btn-sm" onClick={handleClearChat}>
                    🧹 Clear History
                </button>
            </div>
        </header>

        {/* Chat Container */}
        <div className="dashboard-container">
            <div className="chat-card">
                <div className="messages-area">
                    {messages.map((msg, idx) => renderMessage(msg, idx))}
                    {isLoading && (
                        <div className="message message-assistant">
                            <div className="typing-indicator"><span></span><span></span><span></span></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="input-area" onSubmit={handleSendMessage}>
                    <input
                        ref={inputRef}
                        type="text"
                        className="chat-input"
                        placeholder="Ask about portfolios, specific stocks, or market trends..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        disabled={isLoading}
                    />
                    <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={isLoading || !inputMessage.trim()}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                </form>
            </div>
        </div>
      </div>

      {/* Component Specific Styles (Additions to App.css) */}
      <style>{`
        .iframe-container {
            margin-top: 15px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
            background: white;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .iframe-header {
            background: #f8fafc;
            padding: 8px 15px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            font-weight: 600;
            color: #64748b;
        }
        .portfolio-iframe {
            width: 100%;
            height: 500px;
            border: none;
            display: block;
        }
        .external-link {
            color: #3b82f6;
            text-decoration: none;
        }
        .external-link:hover {
            text-decoration: underline;
        }
        .link {
            color: #3b82f6;
            text-decoration: underline;
        }
        .animate-spin {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PortfolioSuggestor;