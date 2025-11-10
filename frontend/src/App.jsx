import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, TrendingUp, MessageSquare, RefreshCw, LogOut, Loader2, BarChart3, Wallet, FileText, X, ChevronDown, Settings, User, Clock, Activity, DollarSign, PieChart } from 'lucide-react';
import './App.css'
const API_BASE = 'http://localhost:5000';

// API utility with better error handling
const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error) {
    throw new Error(error.message || 'Network error');
  }
};

// Notification Component
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
  const Icon = type === 'error' ? AlertCircle : CheckCircle;

  return (
    <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in`}>
      <Icon size={20} />
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button onClick={onClose} className="hover:bg-white/20 rounded p-1 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
};

// Enhanced Broker Card Component
const BrokerCard = ({ broker, status, onLogin, onSwitch, isActive, loading }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const brokerConfig = {
    fyers: {
      color: 'from-blue-500 to-blue-600',
      icon: '🔷',
      name: 'Fyers'
    },
    kite: {
      color: 'from-orange-500 to-orange-600',
      icon: '🪁',
      name: 'Zerodha Kite'
    },
    upstox: {
      color: 'from-purple-500 to-purple-600',
      icon: '⬆️',
      name: 'Upstox'
    }
  };

  const config = brokerConfig[broker];

  return (
    <div className={`relative bg-white rounded-xl shadow-md overflow-hidden border-2 ${isActive ? 'border-green-500 shadow-green-100 shadow-lg' : 'border-gray-200'} transition-all hover:shadow-lg`}>
      {/* Status Indicator */}
      <div className={`absolute top-0 right-0 w-3 h-3 rounded-bl-lg ${status.authenticated ? 'bg-green-500' : 'bg-gray-300'}`}></div>
      
      {/* Header */}
      <div className={`h-24 bg-gradient-to-r ${config.color} p-4 flex items-center justify-between relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full transform translate-x-12 -translate-y-12"></div>
        </div>
        <div className="relative flex items-center gap-3">
          <div className="text-4xl">{config.icon}</div>
          <div>
            <h3 className="text-xl font-bold text-white">{config.name}</h3>
            <p className="text-xs text-white/80">
              {status.authenticated ? 'Connected' : 'Not Connected'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Active Badge */}
        {isActive && (
          <div className="mb-3 flex items-center gap-2">
            <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
              <Activity size={12} className="inline mr-1" />
              ACTIVE BROKER
            </span>
          </div>
        )}

        {/* Status Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Status</span>
            <span className={`font-medium ${status.authenticated ? 'text-green-600' : 'text-gray-400'}`}>
              {status.authenticated ? (
                <span className="flex items-center gap-1">
                  <CheckCircle size={14} /> Authenticated
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertCircle size={14} /> Not Logged In
                </span>
              )}
            </span>
          </div>
          {status.authenticated && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Last Sync</span>
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <Clock size={12} /> Just now
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!status.authenticated ? (
            <button
              onClick={onLogin}
              disabled={loading}
              className={`flex-1 py-2.5 px-4 bg-gradient-to-r ${config.color} text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm`}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Login to {config.name}
            </button>
          ) : (
            <>
              <button
                onClick={onSwitch}
                disabled={loading || isActive}
                className={`flex-1 py-2.5 px-4 ${
                  isActive 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : `bg-gradient-to-r ${config.color} text-white hover:shadow-lg`
                } rounded-lg transition-all disabled:opacity-50 font-medium text-sm`}
              >
                {isActive ? '✓ Active' : 'Switch to ' + config.name}
              </button>
            </>
          )}
        </div>

        {/* Connection Guide */}
        {!status.authenticated && (
          <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-700">
              Click Login to authenticate with {config.name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Chat Message Component
const ChatMessage = ({ message, isUser, broker, timestamp }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
      <div className={`max-w-[80%] ${isUser ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'} rounded-2xl px-4 py-3 shadow-sm relative`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              AI
            </div>
            <div className="text-xs text-gray-500 capitalize font-medium">
              {broker || 'Assistant'}
            </div>
          </div>
        )}
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message}
        </div>
        {timestamp && (
          <div className={`text-xs mt-2 ${isUser ? 'text-blue-100' : 'text-gray-400'}`}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        {!isUser && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
            title="Copy message"
          >
            <span className="text-xs">{copied ? '✓' : '📋'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

// Quick Action Button
const QuickAction = ({ icon: Icon, label, onClick, loading, color = 'blue' }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`w-full flex items-center gap-3 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-${color}-500 hover:bg-${color}-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group`}
  >
    <div className={`p-2 bg-${color}-50 rounded-lg group-hover:bg-${color}-100 transition-colors`}>
      <Icon size={18} className={`text-${color}-600`} />
    </div>
    <span className="text-sm font-medium text-gray-700 text-left flex-1">{label}</span>
    <ChevronDown size={16} className="text-gray-400 transform -rotate-90 group-hover:translate-x-1 transition-transform" />
  </button>
);

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, color, change }) => (
  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
    <div className="flex items-center justify-between mb-2">
      <div className={`p-2 bg-${color}-50 rounded-lg`}>
        <Icon size={20} className={`text-${color}-600`} />
      </div>
      {change && (
        <span className={`text-xs font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change > 0 ? '↑' : '↓'} {Math.abs(change)}%
        </span>
      )}
    </div>
    <div className="text-2xl font-bold text-gray-800 mb-1">{value}</div>
    <div className="text-xs text-gray-500">{label}</div>
  </div>
);

// Main Dashboard Component
const UnifiedTradingDashboard = () => {
  const [brokerStatus, setBrokerStatus] = useState(null);
  const [activeBroker, setActiveBroker] = useState('fyers');
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loginSteps, setLoginSteps] = useState({ fyers: 1, kite: 1, upstox: 1 });
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState({ portfolio: '₹0', positions: 0, returns: 0 });
  const chatEndRef = useRef(null);

  useEffect(() => {
    loadBrokerStatus();
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'success') {
      showNotification('Login successful! Broker authenticated.', 'success');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const showNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const loadBrokerStatus = async () => {
    try {
      const status = await apiCall('/api/broker/status');
      setBrokerStatus(status);
      setActiveBroker(status.active_broker);
    } catch (error) {
      showNotification('Failed to load broker status', 'error');
    }
  };

  // ==================== FYERS ====================
  const handleFyersConnect = async () => {
    setLoading(true);
    try {
      const result = await apiCall('/api/fyers/connect', { method: 'POST' });
      showNotification(result.message || 'Connected to Fyers', 'success');
      setLoginSteps(prev => ({ ...prev, fyers: 2 }));
      await loadBrokerStatus();
    } catch (error) {
      showNotification('Fyers connection failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFyersLogin = async () => {
    setLoading(true);
    try {
      const result = await apiCall('/api/fyers/login', { method: 'POST' });
      if (result.success && result.login_url) {
        window.open(result.login_url, '_blank', 'width=800,height=600');
        showNotification('Please complete login and then verify', 'info');
        setLoginSteps(prev => ({ ...prev, fyers: 3 }));
      }
    } catch (error) {
      showNotification('Failed to get Fyers login URL: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFyersVerify = async () => {
    setLoading(true);
    try {
      const result = await apiCall('/api/fyers/verify-auth', { method: 'POST' });
      if (result.success) {
        showNotification('Fyers authenticated successfully!', 'success');
        setLoginSteps(prev => ({ ...prev, fyers: 1 }));
        await loadBrokerStatus();
      }
    } catch (error) {
      showNotification('Fyers verification failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFyersFlow = () => {
    if (loginSteps.fyers === 1) handleFyersConnect();
    else if (loginSteps.fyers === 2) handleFyersLogin();
    else if (loginSteps.fyers === 3) handleFyersVerify();
  };

  // ==================== KITE ====================
  const handleKiteLogin = async () => {
    setLoading(true);
    try {
      const result = await apiCall('/api/kite/login', { method: 'POST' });
      if (result.success && result.login_url) {
        window.open(result.login_url, '_blank', 'width=800,height=600');
        showNotification('Please complete Kite login', 'info');
        setTimeout(loadBrokerStatus, 3000);
      }
    } catch (error) {
      showNotification('Kite login failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== UPSTOX ====================
  const handleUpstoxLogin = async () => {
    setLoading(true);
    try {
      const result = await apiCall('/api/upstox/login');
      if (result.success && result.auth_url) {
        window.location.href = result.auth_url;
      }
    } catch (error) {
      showNotification('Upstox login failed: ' + error.message, 'error');
      setLoading(false);
    }
  };

  // ==================== BROKER SWITCHING ====================
  const switchBroker = async (broker) => {
    setLoading(true);
    try {
      const result = await apiCall('/api/broker/select', {
        method: 'POST',
        body: JSON.stringify({ broker })
      });

      if (result.success) {
        setActiveBroker(broker);
        showNotification(`Switched to ${broker.toUpperCase()}`, 'success');
        await loadBrokerStatus();
      } else if (result.status === 'need_auth') {
        showNotification(result.message, 'error');
      }
    } catch (error) {
      showNotification('Failed to switch broker: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== CHAT ====================
  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message;
    setMessage('');
    setLoading(true);

    setChatHistory(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      timestamp: Date.now()
    }]);

    try {
      const result = await apiCall('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMessage })
      });

      if (result.success) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: result.response,
          broker: result.broker,
          timestamp: Date.now()
        }]);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      showNotification('Chat error: ' + error.message, 'error');
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `❌ Error: ${error.message}\n\nPlease try again or contact support if the issue persists.`,
        broker: activeBroker,
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = async () => {
    try {
      await apiCall('/api/chat/reset', { method: 'POST' });
      setChatHistory([]);
      showNotification('Conversation reset', 'success');
    } catch (error) {
      showNotification('Failed to reset chat', 'error');
    }
  };

  const quickQuery = (query) => {
    setMessage(query);
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]');
      if (input) input.focus();
    }, 100);
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout from all brokers?')) return;
    
    setLoading(true);
    try {
      await apiCall('/api/logout', {
        method: 'POST',
        body: JSON.stringify({ broker: 'all' })
      });
      showNotification('Logged out successfully', 'success');
      setBrokerStatus(null);
      setChatHistory([]);
      await loadBrokerStatus();
    } catch (error) {
      showNotification('Logout failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {notifications.map(notif => (
          <Notification
            key={notif.id}
            message={notif.message}
            type={notif.type}
            onClose={() => removeNotification(notif.id)}
          />
        ))}
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40 backdrop-blur-lg bg-white/95">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-2 rounded-xl shadow-lg">
              <TrendingUp className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Unified Trading Dashboard
              </h1>
              <p className="text-sm text-gray-500 flex items-center gap-2">
                Multi-broker portfolio management
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                  {activeBroker.toUpperCase()}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadBrokerStatus}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh status"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin text-blue-600' : 'text-gray-600'} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={20} className="text-gray-600" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-lg transition-all"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Wallet} label="Portfolio Value" value={stats.portfolio} color="blue" />
          <StatCard icon={Activity} label="Active Positions" value={stats.positions} color="green" />
          <StatCard icon={DollarSign} label="Today's P&L" value="₹0" color="purple" change={0} />
          <StatCard icon={PieChart} label="Overall Returns" value={stats.returns + '%'} color="orange" change={stats.returns} />
        </div>

        {/* Broker Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BrokerCard
            broker="fyers"
            status={brokerStatus?.brokers?.fyers || {}}
            onLogin={handleFyersFlow}
            onSwitch={() => switchBroker('fyers')}
            isActive={activeBroker === 'fyers'}
            loading={loading}
          />
          <BrokerCard
            broker="kite"
            status={brokerStatus?.brokers?.kite || {}}
            onLogin={handleKiteLogin}
            onSwitch={() => switchBroker('kite')}
            isActive={activeBroker === 'kite'}
            loading={loading}
          />
          <BrokerCard
            broker="upstox"
            status={brokerStatus?.brokers?.upstox || {}}
            onLogin={handleUpstoxLogin}
            onSwitch={() => switchBroker('upstox')}
            isActive={activeBroker === 'upstox'}
            loading={loading}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Section */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">AI Trading Assistant</h2>
                  <p className="text-sm opacity-90 capitalize flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></span>
                    Connected to {activeBroker}
                  </p>
                </div>
              </div>
              <button
                onClick={resetChat}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors backdrop-blur-sm"
              >
                Clear Chat
              </button>
            </div>

            {/* Chat Messages */}
            <div className="h-[500px] overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
              {chatHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <div className="mb-4 relative">
                      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                        <MessageSquare size={40} className="text-blue-600" />
                      </div>
                      <div className="absolute top-0 right-1/3 w-3 h-3 bg-purple-400 rounded-full animate-bounce"></div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">
                      Welcome to AI Trading Assistant
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Ask me about your portfolio, stock prices, market analysis, or trading strategies
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button 
                        onClick={() => quickQuery('Show my portfolio')}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
                      >
                        📊 My Portfolio
                      </button>
                      <button 
                        onClick={() => quickQuery('Show positions')}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors"
                      >
                        📈 Positions
                      </button>
                      <button 
                        onClick={() => quickQuery('Show my orders')}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 transition-colors"
                      >
                        📝 Orders
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {chatHistory.map((msg, idx) => (
                    <ChatMessage
                      key={idx}
                      message={msg.content}
                      isUser={msg.role === 'user'}
                      broker={msg.broker}
                      timestamp={msg.timestamp}
                    />
                  ))}
                  {loading && (
                    <div className="flex justify-start mb-4">
                      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin text-blue-600" />
                          <span className="text-sm text-gray-600">AI is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask about portfolio, stock prices, orders, or get trading insights..."
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-sm"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !message.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <span>Send</span>
                  )}
                </button>
              </div>
              
              {/* Suggested Queries */}
              {chatHistory.length === 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => quickQuery('What is my current portfolio value?')}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 transition-colors"
                  >
                    💰 Portfolio Value
                  </button>
                  <button
                    onClick={() => quickQuery('Show me NIFTY 50 stocks')}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 transition-colors"
                  >
                    📊 NIFTY 50
                  </button>
                  <button
                    onClick={() => quickQuery('What are my holdings?')}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 transition-colors"
                  >
                    📈 My Holdings
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                <BarChart3 size={20} className="text-blue-600" />
                Quick Actions
              </h3>
              <div className="space-y-2">
                <QuickAction
                  icon={Wallet}
                  label="Portfolio Summary"
                  onClick={() => quickQuery('Show me my complete portfolio summary with current values')}
                  loading={loading}
                  color="blue"
                />
                <QuickAction
                  icon={TrendingUp}
                  label="Current Positions"
                  onClick={() => quickQuery('What are my current open positions?')}
                  loading={loading}
                  color="green"
                />
                <QuickAction
                  icon={FileText}
                  label="Recent Orders"
                  onClick={() => quickQuery('Show my recent orders and their status')}
                  loading={loading}
                  color="purple"
                />
                <QuickAction
                  icon={DollarSign}
                  label="Available Funds"
                  onClick={() => quickQuery('How much funds and margin do I have available?')}
                  loading={loading}
                  color="orange"
                />
                <QuickAction
                  icon={Activity}
                  label="Market Watch"
                  onClick={() => quickQuery('Show me my watchlist stocks')}
                  loading={loading}
                  color="pink"
                />
              </div>
            </div>

            {/* Market Insights */}
            <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-xl p-5 border border-blue-100 shadow-md">
              <h4 className="font-bold mb-3 text-gray-800 flex items-center gap-2">
                <span className="text-xl">💡</span>
                Sample Queries
              </h4>
              <ul className="space-y-2.5 text-sm text-gray-700">
                <li className="flex items-start gap-2 p-2 hover:bg-white/60 rounded-lg transition-colors cursor-pointer" onClick={() => quickQuery('What is the price of Reliance?')}>
                  <span className="text-blue-600 font-bold">•</span>
                  <span>"What is the price of Reliance?"</span>
                </li>
                <li className="flex items-start gap-2 p-2 hover:bg-white/60 rounded-lg transition-colors cursor-pointer" onClick={() => quickQuery('Show my holdings')}>
                  <span className="text-purple-600 font-bold">•</span>
                  <span>"Show my holdings with P&L"</span>
                </li>
                <li className="flex items-start gap-2 p-2 hover:bg-white/60 rounded-lg transition-colors cursor-pointer" onClick={() => quickQuery('Search for HDFC Bank')}>
                  <span className="text-green-600 font-bold">•</span>
                  <span>"Search for HDFC Bank"</span>
                </li>
                <li className="flex items-start gap-2 p-2 hover:bg-white/60 rounded-lg transition-colors cursor-pointer" onClick={() => quickQuery('Get quote for TCS and Infosys')}>
                  <span className="text-orange-600 font-bold">•</span>
                  <span>"Get quote for TCS and Infosys"</span>
                </li>
                <li className="flex items-start gap-2 p-2 hover:bg-white/60 rounded-lg transition-colors cursor-pointer" onClick={() => quickQuery('What are my open positions?')}>
                  <span className="text-pink-600 font-bold">•</span>
                  <span>"What are my open positions?"</span>
                </li>
              </ul>
            </div>

            {/* Tips Card */}
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-5 border border-yellow-200 shadow-md">
              <h4 className="font-bold mb-3 text-gray-800 flex items-center gap-2">
                <span className="text-xl">💭</span>
                Pro Tips
              </h4>
              <ul className="space-y-2 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Use natural language for queries</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Switch brokers anytime without losing session</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <span>AI remembers context within conversation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Get real-time market data and analysis</span>
                </li>
              </ul>
            </div>

            {/* Active Broker Info */}
            <div className="bg-white rounded-xl p-5 border-2 border-green-200 shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity size={20} className="text-green-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">Active Broker</h4>
                  <p className="text-xs text-gray-500">Currently trading with</p>
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <p className="text-lg font-bold text-green-700 capitalize text-center">
                  {activeBroker}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                All queries will be executed through {activeBroker.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>System Online</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Session ID: {brokerStatus?.session_id || 'Loading...'}</span>
              <span>•</span>
              <span>Multi-Broker Trading Platform</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        
        /* Smooth scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        
        /* Gradient text animation */
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        /* Pulse animation for status indicators */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default UnifiedTradingDashboard;