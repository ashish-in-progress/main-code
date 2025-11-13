import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import PortfolioSuggestor from './PortfolioSuggestor.jsx';

const API_BASE_URL = 'http://localhost:5000/api';

// Configure axios to send credentials (CRITICAL for session management)
axios.defaults.withCredentials = true;
axios.defaults.baseURL = API_BASE_URL;

function App() {
  const [activeView, setActiveView] = useState('trading'); // 'trading' or 'portfolio'

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
            addMessage('system', '✅ Please complete the login, then click the "Verify Login" button below.');
            
            const loginWindow = window.open(
              loginRes.data.login_url, 
              'Fyers Login',
              'width=600,height=700'
            );
            
            // Show manual verify button immediately
            setShowManualVerify(true);
            
            if (!loginWindow || loginWindow.closed) {
              addMessage('error', '❌ Popup blocked! Please allow popups and try again.');
              addMessage('system', `Or open this URL manually: ${loginRes.data.login_url}`);
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
            addMessage('system', '✅ Please log in at Zerodha, then click the "Verify Login" button below.');
            
            const loginWindow = window.open(
              response.data.login_url,
              'Kite Login',
              'width=600,height=700,scrollbars=yes'
            );
            
            // Show manual verify button immediately
            setShowManualVerify(true);
            
            if (!loginWindow || loginWindow.closed) {
              addMessage('error', '❌ Popup blocked! Please allow popups and try again.');
              addMessage('system', `Or open this URL manually: ${response.data.login_url}`);
            }
            
          } else if (response.data.debug_response) {
            addMessage('error', 'Failed to extract login URL from response');
            addMessage('system', `Debug: ${response.data.debug_response.substring(0, 200)}...`);
          } else {
            addMessage('error', response.data.message || 'Failed to get Kite login URL');
          }
        } catch (error) {
          console.error('Kite login error:', error);
          const errorMsg = error.code === 'ECONNABORTED' 
            ? 'Connection timeout - Kite server took too long to respond'
            : error.response?.data?.error || error.message;
          addMessage('error', `Failed to connect to Kite: ${errorMsg}`);
        }
        
      } else if (broker === 'upstox') {
        const response = await axios.get('/upstox/login');
        
        if (response.data.success && response.data.auth_url) {
          addMessage('system', 'Redirecting to Upstox login...');
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
        if (response.data.tools_count) {
          addMessage('system', `🔧 ${response.data.tools_count} tools are now available.`);
        }
        setActiveBroker(currentBrokerLogin);
        setShowManualVerify(false);
        setCurrentBrokerLogin(null);
        await checkBrokerStatus();
      } else {
        addMessage('error', `❌ Authentication not completed yet. Please complete the ${currentBrokerLogin.toUpperCase()} login first.`);
        if (response.data.message) {
          addMessage('system', response.data.message);
        }
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
      console.error('Switch error:', error);
      addMessage('error', `Failed to switch broker: ${error.response?.data?.error || error.message}`);
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
      const response = await axios.post('/chat', {
        message: userMessage
      });
      
      if (response.data.success) {
        addMessage('assistant', response.data.response);
      } else {
        addMessage('error', response.data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = error.response?.data?.error || error.message;
      addMessage('error', `Error: ${errorMsg}`);
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
      console.error('Reset error:', error);
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
      console.error('Logout error:', error);
      addMessage('error', 'Failed to logout');
    }
  };
  
  const renderMessage = (msg, index) => {
    const roleClass = {
      user: 'message-user',
      assistant: 'message-assistant',
      system: 'message-system',
      error: 'message-error'
    }[msg.role] || 'message-system';
    
    return (
      <div key={index} className={`message ${roleClass}`}>
        <div className="message-header">
          <span className="message-role">
            {msg.role === 'user' ? '👤 You' : 
             msg.role === 'assistant' ? `🤖 ${activeBroker.toUpperCase()} AI` : 
             msg.role === 'error' ? '❌ Error' :
             'ℹ️ System'}
          </span>
          <span className="message-time">
            {msg.timestamp.toLocaleTimeString()}
          </span>
        </div>
        <div className="message-content">
          {msg.content.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < msg.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };
  
  if (activeView === 'portfolio') {
    return <PortfolioSuggestor onBackToTrading={() => setActiveView('trading')} />;
  }

  return (
    <div className="app">
      <header className="header">
        <button 
          className="btn btn-success" 
          onClick={() => setActiveView('portfolio')}
          style={{ marginRight: '10px' }}
        >
          💼 Portfolio AI
        </button>
        <div className="header-left">
          <h1>🚀 Unified Trading Assistant</h1>
          <span className="header-subtitle">Multi-Broker AI Portfolio Management</span>
        </div>
        <div className="header-right">
          <button className="btn btn-secondary" onClick={handleResetChat}>
            🔄 Reset Chat
          </button>
          <button className="btn btn-danger" onClick={() => handleLogout('all')}>
            🚪 Logout All
          </button>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="sidebar-section">
            <h3>Brokers</h3>
            
            {/* Fyers */}
            <div className={`broker-card ${activeBroker === 'fyers' ? 'active' : ''}`}>
              <div className="broker-header">
                <span className="broker-name">Fyers</span>
                <span className={`status-badge ${brokerStatus.fyers?.authenticated ? 'connected' : 'disconnected'}`}>
                  {brokerStatus.fyers?.authenticated ? '🟢' : '🔴'}
                </span>
              </div>
              <div className="broker-actions">
                {!brokerStatus.fyers?.authenticated ? (
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handleBrokerLogin('fyers')}
                    disabled={isAuthenticating}
                  >
                    {isAuthenticating && currentBrokerLogin === 'fyers' ? 'Connecting...' : 'Login'}
                  </button>
                ) : (
                  <>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleBrokerSwitch('fyers')}
                      disabled={activeBroker === 'fyers'}
                    >
                      {activeBroker === 'fyers' ? 'Active ✓' : 'Switch'}
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleLogout('fyers')}
                    >
                      Logout
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Kite */}
            <div className={`broker-card ${activeBroker === 'kite' ? 'active' : ''}`}>
              <div className="broker-header">
                <span className="broker-name">Kite (Zerodha)</span>
                <span className={`status-badge ${brokerStatus.kite?.authenticated ? 'connected' : 'disconnected'}`}>
                  {brokerStatus.kite?.authenticated ? '🟢' : '🔴'}
                </span>
              </div>
              <div className="broker-actions">
                {!brokerStatus.kite?.authenticated ? (
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handleBrokerLogin('kite')}
                    disabled={isAuthenticating}
                  >
                    {isAuthenticating && currentBrokerLogin === 'kite' ? 'Connecting...' : 'Login'}
                  </button>
                ) : (
                  <>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleBrokerSwitch('kite')}
                      disabled={activeBroker === 'kite'}
                    >
                      {activeBroker === 'kite' ? 'Active ✓' : 'Switch'}
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleLogout('kite')}
                    >
                      Logout
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Upstox */}
            <div className={`broker-card ${activeBroker === 'upstox' ? 'active' : ''}`}>
              <div className="broker-header">
                <span className="broker-name">Upstox</span>
                <span className={`status-badge ${brokerStatus.upstox?.authenticated ? 'connected' : 'disconnected'}`}>
                  {brokerStatus.upstox?.authenticated ? '🟢' : '🔴'}
                </span>
              </div>
              <div className="broker-actions">
                {!brokerStatus.upstox?.authenticated ? (
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handleBrokerLogin('upstox')}
                    disabled={isAuthenticating}
                  >
                    {isAuthenticating && currentBrokerLogin === 'upstox' ? 'Redirecting...' : 'Login'}
                  </button>
                ) : (
                  <>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleBrokerSwitch('upstox')}
                      disabled={activeBroker === 'upstox'}
                    >
                      {activeBroker === 'upstox' ? 'Active ✓' : 'Switch'}
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleLogout('upstox')}
                    >
                      Logout
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Manual Verify Button */}
            {showManualVerify && (
              <div className="manual-verify-section" style={{
                marginTop: '15px',
                padding: '15px',
                background: '#f0f9ff',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <button 
                  className="btn btn-success btn-block"
                  onClick={handleManualVerify}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    marginBottom: '8px'
                  }}
                >
                  ✓ Verify Login
                </button>
                <small style={{ display: 'block', color: '#475569' }}>
                  Click after completing login at {currentBrokerLogin?.toUpperCase()}
                </small>
              </div>
            )}
          </div>

          <div className="sidebar-section">
            <h3>Quick Actions</h3>
            <div className="quick-actions">
              <button 
                className="quick-action-btn"
                onClick={() => {
                  setInputMessage('Show my holdings');
                  inputRef.current?.focus();
                }}
                disabled={!brokerStatus[activeBroker]?.authenticated}
              >
                📊 Holdings
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => {
                  setInputMessage('Show my positions');
                  inputRef.current?.focus();
                }}
                disabled={!brokerStatus[activeBroker]?.authenticated}
              >
                📈 Positions
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => {
                  setInputMessage('What is my available margin?');
                  inputRef.current?.focus();
                }}
                disabled={!brokerStatus[activeBroker]?.authenticated}
              >
                💰 Margins
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => {
                  setInputMessage('Show my profile');
                  inputRef.current?.focus();
                }}
                disabled={!brokerStatus[activeBroker]?.authenticated}
              >
                👤 Profile
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>System Info</h3>
            <div className="system-info">
              <div className="info-row">
                <span>Active Broker:</span>
                <span className="info-value">{activeBroker.toUpperCase()}</span>
              </div>
              <div className="info-row">
                <span>Status:</span>
                <span className="info-value">
                  {brokerStatus[activeBroker]?.authenticated ? '✅ Connected' : '⏸️ Disconnected'}
                </span>
              </div>
              <div className="info-row">
                <span>AI Agent:</span>
                <span className="info-value">
                  {brokerStatus[activeBroker]?.authenticated ? '🤖 Ready' : '⏸️ Inactive'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        <main className="chat-container">
          <div className="chat-header">
            <h2>💬 Chat with {activeBroker.toUpperCase()} AI</h2>
            {brokerStatus[activeBroker]?.authenticated ? (
              <span className="status-indicator">🟢 AI Agent Active</span>
            ) : (
              <span className="status-indicator">🔴 Not Connected</span>
            )}
          </div>

          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h3>👋 Welcome to Unified Trading Assistant!</h3>
                <p>Your AI-powered multi-broker portfolio manager with intelligent tool calling.</p>
                
                <div className="features-grid">
                  <div className="feature-box">
                    <h4>🤖 AI Agents</h4>
                    <p>Intelligent assistants that understand your queries and call the right tools automatically</p>
                  </div>
                  <div className="feature-box">
                    <h4>🔧 Smart Tools</h4>
                    <p>Get holdings, positions, quotes, and more - all through natural conversation</p>
                  </div>
                  <div className="feature-box">
                    <h4>🔄 Multi-Broker</h4>
                    <p>Switch between Fyers, Kite, and Upstox seamlessly</p>
                  </div>
                </div>

                <div className="example-queries">
                  <p><strong>💡 Try asking:</strong></p>
                  <ul>
                    <li>"Show my holdings"</li>
                    <li>"What are my current positions?"</li>
                    <li>"What is my available margin?"</li>
                    <li>"Get me quotes for INFY and RELIANCE"</li>
                    <li>"Show my profile details"</li>
                    <li>"What orders do I have today?"</li>
                  </ul>
                </div>
                
                <div className="getting-started">
                  <p><strong>🚀 Getting Started:</strong></p>
                  <ol>
                    <li>Click "Login" on any broker in the sidebar</li>
                    <li>Complete authentication in the popup window</li>
                    <li>Click the "Verify Login" button that appears</li>
                    <li>Start chatting naturally with your AI assistant!</li>
                  </ol>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => renderMessage(msg, idx))
            )}
            {loading && (
              <div className="message message-assistant">
                <div className="message-header">
                  <span className="message-role">🤖 {activeBroker.toUpperCase()} AI</span>
                </div>
                <div className="message-content typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="input-container" onSubmit={handleSendMessage}>
            <input
              ref={inputRef}
              type="text"
              className="message-input"
              placeholder={
                brokerStatus[activeBroker]?.authenticated
                  ? `Ask ${activeBroker.toUpperCase()} AI anything about your portfolio...`
                  : `Please login to ${activeBroker.toUpperCase()} first...`
              }
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={loading || !brokerStatus[activeBroker]?.authenticated}
            />
            <button 
              type="submit" 
              className="btn btn-primary send-btn"
              disabled={loading || !inputMessage.trim() || !brokerStatus[activeBroker]?.authenticated}
            >
              {loading ? '⏳' : '📤'} Send
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

export default App;