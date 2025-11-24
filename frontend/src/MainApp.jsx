// MainApp.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import PortfolioSuggestor from "./PortfolioSuggestor.jsx";
import StockAnalyzer from "./StockAnalyzer.jsx";

// ... paste EVERYTHING from your old App component here
const API_BASE_URL = 'http://localhost:5000/api';

// Configure axios to send credentials (CRITICAL for session management)
axios.defaults.withCredentials = true;
axios.defaults.baseURL = API_BASE_URL;
export default function MainApp() {
  // paste your ENTIRE OLD App() content here
  const [activeView, setActiveView] = useState('trading'); // 'trading', 'portfolio', 'analyzer'
  const [activeBroker, setActiveBroker] = useState('fyers');
  const [brokerStatus, setBrokerStatus] = useState({
    fyers: { authenticated: false, active: false },
    kite: { authenticated: false, active: false },
    upstox: { authenticated: false, active: false }
  });

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginUrl, setLoginUrl] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showManualVerify, setShowManualVerify] = useState(false);
  const [currentBrokerLogin, setCurrentBrokerLogin] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    checkBrokerStatus();
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'success') {
      const broker = urlParams.get('broker');
      if (broker) {
        setActiveBroker(broker);
        addMessage('system', `Successfully logged in to ${broker.toUpperCase()}!`);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => checkBrokerStatus(), 500);
    }
    
    if (urlParams.get('error')) {
      addMessage('error', `Authentication failed: ${urlParams.get('error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  
  const checkBrokerStatus = async () => {
    try {
      const response = await axios.get('/broker/status');
      if (response.data) {
        setBrokerStatus(response.data.brokers);
        setActiveBroker(response.data.active_broker);
      }
    } catch (error) {
      console.error('Error checking broker status:', error);
    }
  };
  
  const addMessage = (role, content) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  };

  // ... (Your existing handleBrokerLogin logic remains exactly the same)
  const handleBrokerLogin = async (broker) => {
    setIsAuthenticating(true);
    setLoginUrl(null);
    setShowManualVerify(false);
    setCurrentBrokerLogin(broker);
    
    try {
      if (broker === 'fyers') {
        addMessage('system', 'Connecting to Fyers...');
        const connectRes = await axios.post('/fyers/connect');
        
        if (connectRes.data.success) {
          const loginRes = await axios.post('/fyers/login');
          if (loginRes.data.success && loginRes.data.login_url) {
            setLoginUrl(loginRes.data.login_url);
            addMessage('system', '🔐 Opening Fyers login window...');
            
            const loginWindow = window.open(
              loginRes.data.login_url, 
              'Fyers Login',
              'width=600,height=700'
            );
            setShowManualVerify(true);
            if (!loginWindow || loginWindow.closed) {
              addMessage('error', '❌ Popup blocked! Please allow popups.');
            }
          } else {
            addMessage('error', 'Failed to get Fyers login URL');
          }
        } else {
          addMessage('error', 'Failed to connect to Fyers');
        }
        
      } else if (broker === 'kite') {
        addMessage('system', 'Connecting to Kite...');
        try {
          const response = await axios.post('/kite/login', {}, { timeout: 30000 });
          if (response.data.success && response.data.login_url) {
            setLoginUrl(response.data.login_url);
            addMessage('system', '🔐 Opening Kite login window...');
            const loginWindow = window.open(
              response.data.login_url,
              'Kite Login',
              'width=600,height=700,scrollbars=yes'
            );
            setShowManualVerify(true);
            if (!loginWindow || loginWindow.closed) {
              addMessage('error', '❌ Popup blocked!');
            }
          } else {
            addMessage('error', response.data.message || 'Failed to get Kite login URL');
          }
        } catch (error) {
            addMessage('error', `Failed to connect to Kite: ${error.message}`);
        }
        
      } else if (broker === 'upstox') {
        const response = await axios.get('/upstox/login');
        if (response.data.success && response.data.auth_url) {
          window.location.href = response.data.auth_url;
        } else {
          addMessage('error', 'Failed to get Upstox auth URL');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      addMessage('error', `Login failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  const handleManualVerify = async () => {
    addMessage('system', '🔍 Checking authentication status...');
    try {
      const response = await axios.post(
        currentBrokerLogin === 'kite' ? '/kite/verify-auth' : '/fyers/verify-auth'
      );
      if (response.data.success && response.data.authenticated) {
        addMessage('system', `✅ ${currentBrokerLogin.toUpperCase()} authentication successful!`);
        setActiveBroker(currentBrokerLogin);
        setShowManualVerify(false);
        setCurrentBrokerLogin(null);
        await checkBrokerStatus();
      } else {
        addMessage('error', `❌ Authentication not completed.`);
      }
    } catch (error) {
      addMessage('error', `Verification failed: ${error.response?.data?.error || error.message}`);
    }
  };
  
  const handleBrokerSwitch = async (broker) => {
    if (!brokerStatus[broker]?.authenticated) {
      addMessage('system', `Please login to ${broker.toUpperCase()} first.`);
      return;
    }
    try {
      const response = await axios.post('/broker/select', { broker });
      if (response.data.success) {
        setActiveBroker(broker);
        addMessage('system', `Switched to ${broker.toUpperCase()}`);
        await checkBrokerStatus();
      } else if (response.data.status === 'need_auth') {
        addMessage('system', response.data.message);
      }
    } catch (error) {
      addMessage('error', `Failed to switch: ${error.message}`);
    }
  };
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;
    
    if (!brokerStatus[activeBroker]?.authenticated) {
      addMessage('system', `Please login to ${activeBroker.toUpperCase()} first.`);
      return;
    }
    
    const userMessage = inputMessage.trim();
    setInputMessage('');
    addMessage('user', userMessage);
    setLoading(true);
    
    try {
      const response = await axios.post('/chat', { message: userMessage });
      if (response.data.success) {
        addMessage('assistant', response.data.response);
      } else {
        addMessage('error', response.data.error || 'Failed to get response');
      }
    } catch (error) {
      addMessage('error', `Error: ${error.message}`);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };
  
  const handleResetChat = async () => {
    try {
      await axios.post('/chat/reset');
      setMessages([]);
      addMessage('system', 'Conversation reset');
    } catch (error) {
      addMessage('error', 'Failed to reset conversation');
    }
  };
  
  const handleLogout = async (broker = 'all') => {
    try {
      await axios.post('/logout', { broker });
      if (broker === 'all') {
        setMessages([]);
        setBrokerStatus({
            fyers: { authenticated: false, active: false },
            kite: { authenticated: false, active: false },
            upstox: { authenticated: false, active: false }
        });
        addMessage('system', 'Logged out from all brokers');
      } else {
        addMessage('system', `Logged out from ${broker.toUpperCase()}`);
      }
      await checkBrokerStatus();
    } catch (error) {
      addMessage('error', 'Failed to logout');
    }
  };

  // RENDER MESSAGES
  const renderMessage = (msg, index) => {
    const roleClass = {
      user: 'message-user',
      assistant: 'message-assistant',
      system: 'message-system',
      error: 'message-error'
    }[msg.role] || 'message-system';
    
    return (
      <div key={index} className={`message ${roleClass}`}>
        {msg.role !== 'system' && msg.role !== 'error' && (
          <span className="message-meta">
            {msg.role === 'user' ? 'You' : `${activeBroker.toUpperCase()} AI`} • {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        )}
        <div className="message-content">
          {msg.content.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}{i < msg.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // BROKER CARD COMPONENT
  const BrokerItem = ({ id, name, status }) => (
    <div className={`broker-item ${activeBroker === id ? 'active' : ''}`}>
      <div className="broker-info">
        <div className={`broker-status-dot ${status.authenticated ? 'connected' : ''}`} />
        <span className="broker-name">{name}</span>
      </div>
      <div className="broker-actions">
        {!status.authenticated ? (
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => handleBrokerLogin(id)}
            disabled={isAuthenticating}
          >
            Connect
          </button>
        ) : (
          <>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => handleBrokerSwitch(id)}
              disabled={activeBroker === id}
            >
              {activeBroker === id ? 'Active' : 'Switch'}
            </button>
            <button className="btn btn-sm" onClick={() => handleLogout(id)} title="Logout">🚪</button>
          </>
        )}
      </div>
    </div>
  );

  // RENDER LOGIC
  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>🚀</span>
          <span>TradeUI</span>
          <button 
  className="btn btn-danger btn-sm"
  onClick={() => window.location.reload() || axios.post('/logout')}
>
  🔓 Logout User
</button>

        </div>

        <div className="sidebar-section">
          <h3>Broker Accounts</h3>
          <BrokerItem id="fyers" name="Fyers" status={brokerStatus.fyers} />
          <BrokerItem id="kite" name="Zerodha" status={brokerStatus.kite} />
          <BrokerItem id="upstox" name="Upstox" status={brokerStatus.upstox} />
          
          {showManualVerify && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #93c5fd' }}>
              <button className="btn btn-success btn-sm" style={{width: '100%'}} onClick={handleManualVerify}>
                ✅ Verify Login
              </button>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <h3>Smart Tools</h3>
          <div className="quick-actions-grid">
            <button className="quick-action-btn" onClick={() => setInputMessage('Show my holdings')}>📊 Holdings</button>
            <button className="quick-action-btn" onClick={() => setInputMessage('Show my positions')}>📈 Positions</button>
            <button className="quick-action-btn" onClick={() => setInputMessage('Check margin')}>💰 Margin</button>
            <button className="quick-action-btn" onClick={() => setInputMessage('Show profile')}>👤 Profile</button>
          </div>
        </div>

        <div className="sidebar-section" style={{ marginTop: 'auto' }}>
           <h3>System</h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             <button className="btn btn-secondary btn-sm" onClick={handleResetChat}>🔄 Reset Chat</button>
             <button className="btn btn-danger btn-sm" onClick={() => handleLogout('all')}>🚪 Logout All</button>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="main-content">
        {/* HEADER */}
        <header className="top-header">
          <div className="header-title">
            <h1>Dashboard</h1>
            <span className="subtitle">Multi-Broker Portfolio Management</span>
          </div>
          <div className="view-switcher">
            <button 
              className={`btn ${activeView === 'trading' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveView('trading')}
            >
              💬 Assistant
            </button>
            <button 
              className={`btn ${activeView === 'portfolio' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveView('portfolio')}
            >
              💼 Portfolio
            </button>
            <button 
              className={`btn ${activeView === 'analyzer' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveView('analyzer')}
            >
              📉 Analyzer
            </button>
          </div>
        </header>

        {/* DASHBOARD CONTENT */}
        <div className="dashboard-container">
          {activeView === 'portfolio' ? (
            <PortfolioSuggestor onBackToTrading={() => setActiveView('trading')} />
          ) : activeView === 'analyzer' ? (
            <StockAnalyzer onBack={() => setActiveView('trading')} />
          ) : (
            /* TRADING / CHAT VIEW */
            <div className="chat-card">
              <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2>{activeBroker.charAt(0).toUpperCase() + activeBroker.slice(1)} Assistant</h2>
                </div>
                <span className={`chat-status ${brokerStatus[activeBroker]?.authenticated ? 'active' : ''}`}>
                  {brokerStatus[activeBroker]?.authenticated ? '● Live Agent' : '○ Offline'}
                </span>
              </div>

              <div className="messages-area">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <h3>Welcome back!</h3>
                    <p>Connect a broker from the sidebar and ask me anything about your portfolio.</p>
                    <div className="features-row">
                        <div className="feature-card">🤖<br/><strong>AI Trading</strong></div>
                        <div className="feature-card">📊<br/><strong>Real-time Data</strong></div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => renderMessage(msg, idx))
                )}
                
                {loading && (
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
                  placeholder={brokerStatus[activeBroker]?.authenticated ? "Ask for holdings, positions, or quotes..." : "Please connect broker first..."}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={loading || !brokerStatus[activeBroker]?.authenticated}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading || !inputMessage.trim()}
                >
                  Send ➔
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      <style>
       {
        `:root {
  --primary-dark: #0f172a;    /* Deep Navy */
  --primary-blue: #3b82f6;    /* Brand Blue */
  --success-green: #10b981;   /* Growth Green */
  --danger-red: #ef4444;      /* Alert Red */
  --bg-light: #f1f5f9;        /* Dashboard Background */
  --card-bg: #ffffff;         /* Card White */
  --text-main: #1e293b;       /* Dark Slate */
  --text-muted: #64748b;      /* Muted Gray */
  --border-color: #e2e8f0;    /* Light Border */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06);
  --radius-lg: 16px;
  --radius-md: 8px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg-light);
  color: var(--text-main);
  -webkit-font-smoothing: antialiased;
}

/* Layout Structure */
.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 280px;
  background-color: var(--card-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-logo {
  font-size: 24px;
  font-weight: 800;
  color: var(--primary-dark);
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar-section {
  margin-bottom: 32px;
}

.sidebar-section h3 {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 1px;
  margin-bottom: 16px;
  font-weight: 600;
}

/* Broker List Items */
.broker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  margin-bottom: 10px;
  transition: all 0.2s ease;
}

.broker-item.active {
  border-color: var(--primary-blue);
  background-color: #eff6ff; /* Very light blue */
}

.broker-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.broker-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--danger-red);
}

.broker-status-dot.connected {
  background-color: var(--success-green);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.broker-name {
  font-weight: 600;
  font-size: 14px;
}

.broker-actions {
  display: flex;
  gap: 6px;
}

/* Buttons */
.btn {
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-primary {
  background-color: var(--primary-dark);
  color: white;
}
.btn-primary:hover { background-color: #1e293b; }

.btn-success {
  background-color: var(--success-green);
  color: white;
}

.btn-warning {
  background-color: #f59e0b;
  color: white;
}

.btn-secondary {
  background-color: #f1f5f9;
  color: var(--text-main);
}
.btn-secondary:hover { background-color: #e2e8f0; }

.btn-danger {
  background-color: #fee2e2;
  color: var(--danger-red);
}
.btn-danger:hover { background-color: #fecaca; }

/* Main Content Area */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--bg-light);
}

/* Top Header */
.top-header {
  height: 70px;
  background-color: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
}

.header-title h1 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
}

.header-title .subtitle {
  font-size: 13px;
  color: var(--text-muted);
}

.view-switcher {
  display: flex;
  gap: 12px;
}

/* Dashboard Grid */
.dashboard-container {
  padding: 24px;
  height: calc(100vh - 70px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Chat Interface Card */
.chat-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0; /* Critical for flex nesting */
}

.chat-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-status {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  background: #f1f5f9;
  color: var(--text-muted);
}

.chat-status.active {
  background: #d1fae5;
  color: #065f46;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Message Bubbles */
.message {
  max-width: 80%;
  padding: 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  position: relative;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-user {
  align-self: flex-end;
  background-color: var(--primary-dark);
  color: white;
  border-bottom-right-radius: 2px;
}

.message-assistant {
  align-self: flex-start;
  background-color: white;
  border: 1px solid var(--border-color);
  color: var(--text-main);
  border-bottom-left-radius: 2px;
  box-shadow: var(--shadow-sm);
}

.message-system {
  align-self: center;
  background-color: transparent;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  max-width: 100%;
  padding: 8px;
  border: none;
}

.message-error {
  align-self: center;
  background-color: #fef2f2;
  color: var(--danger-red);
  border: 1px solid #fecaca;
}

.message-meta {
  font-size: 11px;
  margin-bottom: 4px;
  opacity: 0.7;
  display: block;
}

/* Input Area */
.input-area {
  padding: 20px;
  background: white;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 12px;
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  background: #f8fafc;
}

.chat-input:focus {
  border-color: var(--primary-blue);
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Quick Actions */
.quick-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quick-action-btn {
  background: white;
  border: 1px solid var(--border-color);
  padding: 10px;
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.quick-action-btn:hover {
  border-color: var(--primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}

.features-row {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-top: 30px;
}

.feature-card {
  background: white;
  padding: 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  width: 200px;
  text-align: center;
}

/* Loading Dots */
.typing-indicator span {
  display: inline-block;
  width: 6px;
  height: 6px;
  background-color: var(--text-muted);
  border-radius: 50%;
  margin: 0 2px;
  animation: bounce 1.4s infinite ease-in-out both;
}
.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}`
       }
      </style>
    </div>
  );
}
