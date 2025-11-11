import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, Loader2 } from 'lucide-react';
import "./index.css";

// Use relative URL for proxy; replace as needed for production
const WEBHOOK_URL = '/n8n/webhook/82d63927-dc2e-416f-abf9-9915cbb2d705';

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

  return (
    <div className="portfolio-container">
      {/* Header */}
      <div className="portfolio-header">
        {onBackToTrading && (
        <button
          className="btn btn-secondary"
          onClick={onBackToTrading}
          style={{ marginBottom: '1em' }}
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
            <form onSubmit={handleSendMessage} className="input-form">
              <input
                type="text"
                ref={inputRef}
                className="input-field"
                value={inputMessage}
                placeholder="Ask about portfolios, IPOs, stocks..."
                onChange={(e) => setInputMessage(e.target.value)}
                aria-label="Chat input"
              />
              <button
                type="submit"
                className="send-btn"
                disabled={isLoading || !inputMessage.trim()}
                aria-label="Send message"
              >
                {isLoading ? <Loader2 className="loader" /> : <Send />}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PortfolioSuggestor;
