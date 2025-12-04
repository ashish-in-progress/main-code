// MainApp.jsx
import React, { useState, useEffect, useRef } from "react";

import PortfolioSuggestor from "./PortfolioSuggestor.jsx";
import StockAnalyzer from "./StockAnalyzer.jsx";
import PortfolioHoldings from "./PortfolioHoldings.jsx";
import InsightsPage from "./InsightsPage.jsx";
import API from "./api.js";
// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function MainApp() {
  // View Management
  const [activeView, setActiveView] = useState("trading");  // 'trading', 'holdings', 'portfolio', 'analyzer'

  // Broker State
  const [activeBroker, setActiveBroker] = useState("fyers");
  const [brokerStatus, setBrokerStatus] = useState({
    fyers: { authenticated: false, active: false },
    kite: { authenticated: false, active: false },
    upstox: { authenticated: false, active: false },
  });

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Authentication State
  const [loginUrl, setLoginUrl] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showManualVerify, setShowManualVerify] = useState(false);
  const [currentBrokerLogin, setCurrentBrokerLogin] = useState(null);

  // User State
  const [userInfo, setUserInfo] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial setup
  useEffect(() => {
    checkUserSession();
    checkBrokerStatus();

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("login") === "success") {
      const broker = urlParams.get("broker");
      if (broker) {
        setActiveBroker(broker);
        addMessage("system", `✅ Successfully logged in to ${broker.toUpperCase()}!`);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => checkBrokerStatus(), 500);
    }

    if (urlParams.get("error")) {
      addMessage("error", `❌ Authentication failed: ${urlParams.get("error")}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Check user session
  const checkUserSession = async () => {
    try {
      const response = await API.get("/me");
      if (response.data) {
        setUserInfo(response.data);
      }
    } catch (error) {
      console.error("Error checking user session:", error);
    }
  };

  // Check broker authentication status
  const checkBrokerStatus = async () => {
    try {
      const response = await API.get("/api/broker/status");
      if (response.data) {
        setBrokerStatus(response.data.brokers);
        setActiveBroker(response.data.active_broker);
      }
    } catch (error) {
      console.error("Error checking broker status:", error);
    }
  };

  // Add message to chat
  const addMessage = (role, content) => {
    setMessages((prev) => [
      ...prev,
      {
        role,
        content,
        timestamp: new Date(),
      },
    ]);
  };

  // Handle broker login
  const handleBrokerLogin = async (broker) => {
    setIsAuthenticating(true);
    setLoginUrl(null);
    setShowManualVerify(false);
    setCurrentBrokerLogin(broker);

    try {
      if (broker === "fyers") {
        addMessage("system", "🔌 Connecting to Fyers...");

        const connectRes = await API.post("/api/fyers/connect");
        if (!connectRes.data.success) {
          addMessage("error", "❌ Failed to connect to Fyers");
          return;
        }

        addMessage("system", "✅ Connected to Fyers MCP");

        const loginRes = await API.post("/api/fyers/login");
        if (!loginRes.data.success || !loginRes.data.login_url) {
          addMessage("error", "❌ Failed to get Fyers login URL");
          return;
        }

        setLoginUrl(loginRes.data.login_url);

        const loginWindow = window.open(
          loginRes.data.login_url,
          "Fyers Login",
          "width=600,height=700,scrollbars=yes"
        );

        setShowManualVerify(true);

        if (!loginWindow || loginWindow.closed) {
          addMessage("error", "❌ Popup blocked! Allow popups and try again.");
        } else {
          addMessage("system", "⏳ Complete login in popup, then click Verify.");
        }
      } else if (broker === "kite") {
        addMessage("system", "🔌 Connecting to Kite/Zerodha...");

        const response = await API.post("/api/kite/login");
        if (!response.data.success || !response.data.login_url) {
          addMessage("error", "❌ Failed to get Kite login URL");
          return;
        }

        setLoginUrl(response.data.login_url);

        const win = window.open(
          response.data.login_url,
          "Kite Login",
          "width=600,height=700,scrollbars=yes"
        );

        setShowManualVerify(true);

        if (!win || win.closed) {
          addMessage("error", "❌ Popup blocked! Allow popups.");
        } else {
          addMessage("system", "⏳ Complete login in popup, then verify.");
        }
      } else if (broker === "upstox") {
        addMessage("system", "🔌 Redirecting to Upstox login...");
        const response = await API.get("/api/upstox/login");
        if (response.data.success && response.data.auth_url) {
          window.location.href = response.data.auth_url;
        } else {
          addMessage("error", "❌ Failed to get Upstox auth URL");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      addMessage("error", `❌ Login failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle manual verification after popup login
  const handleManualVerify = async () => {
    addMessage("system", "🔍 Verifying authentication...");

    try {
      const endpoint =
        currentBrokerLogin === "kite" ? "/api/kite/verify-auth" : "/api/fyers/verify-auth";

      const response = await API.post(endpoint);

      if (response.data.success && response.data.authenticated) {
        addMessage("system", `✅ ${currentBrokerLogin.toUpperCase()} authenticated!`);
        addMessage("system", `🤖 AI Agent initialized with ${response.data.tools_count} tools`);

        setActiveBroker(currentBrokerLogin);
        setShowManualVerify(false);
        setCurrentBrokerLogin(null);

        await checkBrokerStatus();
      } else {
        addMessage("error", `❌ Authentication incomplete. ${response.data.message || ""}`);
      }
    } catch (error) {
      addMessage("error", `❌ Verification failed: ${error.response?.data?.error || error.message}`);
    }
  };

  // Switch active broker
  const handleBrokerSwitch = async (broker) => {
    if (!brokerStatus[broker]?.authenticated) {
      addMessage("system", `⚠️ Please login to ${broker.toUpperCase()} first.`);
      return;
    }

    try {
      const response = await API.post("/api/broker/select", { broker });
      if (response.data.success) {
        setActiveBroker(broker);
        addMessage("system", `🔄 Switched to ${broker.toUpperCase()}`);
        await checkBrokerStatus();
      } else {
        addMessage("error", response.data.message || "❌ Failed to switch broker");
      }
    } catch (error) {
      addMessage("error", `❌ Failed to switch: ${error.message}`);
    }
  };

  // Send chat message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    if (!brokerStatus[activeBroker]?.authenticated) {
      addMessage("system", `⚠️ Please login to ${activeBroker.toUpperCase()} first.`);
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage("");
    addMessage("user", userMessage);
    setLoading(true);

    try {
      const response = await API.post("/api/chat", { message: userMessage });

      if (response.data.success) {
        addMessage("assistant", response.data.response);
      } else {
        addMessage("error", response.data.error || "❌ Failed to get response");
      }
    } catch (error) {
      addMessage("error", `❌ Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // Reset conversation
  const handleResetChat = async () => {
    try {
      await API.post("/api/chat/reset");
      setMessages([]);
      addMessage("system", "🔄 Conversation reset");
    } catch (error) {
      addMessage("error", "❌ Failed to reset conversation");
    }
  };

  // Logout from brokers
  const handleLogout = async (broker = "all") => {
    try {
      await API.post("/api/broker/logout", { broker });

      if (broker === "all") {
        setMessages([]);
        setBrokerStatus({
          fyers: { authenticated: false, active: false },
          kite: { authenticated: false, active: false },
          upstox: { authenticated: false, active: false },
        });
        addMessage("system", "🚪 Logged out from all brokers");
      } else {
        addMessage("system", `🚪 Logged out from ${broker.toUpperCase()}`);
      }

      await checkBrokerStatus();
    } catch (error) {
      addMessage("error", "❌ Failed to logout");
    }
  };

  // Logout user
  const handleUserLogout = async () => {
    try {
      await API.post("/logout", {}, { withCredentials: true });
      window.location.href = "/";
    } catch (error) {
      console.error("User logout error:", error);
    }
  };

  // Render messages
  const renderMessage = (msg, index) => {
    const roleClass = {
      user: "message-user",
      assistant: "message-assistant",
      system: "message-system",
      error: "message-error",
    }[msg.role];

    return (
      <div key={index} className={`message ${roleClass}`}>
        {msg.role !== "system" && msg.role !== "error" && (
          <span className="message-meta">
            {msg.role === "user" ? "👤 You" : `🤖 ${activeBroker.toUpperCase()} AI`} •{" "}
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <div className="message-content">
          {msg.content.split("\n").map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < msg.content.split("\n").length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // Broker Card Component
  const BrokerItem = ({ id, name, status }) => (
    <div className={`broker-item ${activeBroker === id ? "active" : ""}`}>
      <div className="broker-info">
        <div className={`broker-status-dot ${status.authenticated ? "connected" : ""}`} />
        <span className="broker-name">{name}</span>
      </div>
      <div className="broker-actions">
        {!status.authenticated ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleBrokerLogin(id)}
            disabled={isAuthenticating}
          >
            {isAuthenticating && currentBrokerLogin === id ? "⏳" : "🔗"} Connect
          </button>
        ) : (
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleBrokerSwitch(id)}
              disabled={activeBroker === id}
            >
              {activeBroker === id ? "✅ Active" : "Switch"}
            </button>
            <button
              className="btn btn-sm"
              onClick={() => handleLogout(id)}
              style={{ padding: "4px 8px" }}
            >
              🚪
            </button>
          </>
        )}
      </div>
    </div>
  );

  // Quick Actions
  const quickActions = [
    { label: "📊 Holdings", message: "Show my holdings" },
    { label: "📈 Positions", message: "Show my positions" },
    { label: "💰 Margin", message: "Check my margin" },
    { label: "👤 Profile", message: "Show my profile" },
  ];

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🚀</span>
          <span className="logo-text">TradeAI</span>
        </div>

        {/* User Info */}
        {userInfo && (
          <div className="user-info-card">
            <div className="user-avatar">👤</div>
            <div className="user-details">
              <span className="user-email">
                {userInfo.session_id?.substring(0, 8)}...
              </span>
              <button className="btn-link" onClick={handleUserLogout}>
                🔓 Logout
              </button>
            </div>
          </div>
        )}

        {/* Broker Accounts */}
        <div className="sidebar-section">
          <h3>🏦 Broker Accounts</h3>
          <BrokerItem id="fyers" name="Fyers" status={brokerStatus.fyers} />
          <BrokerItem id="kite" name="Zerodha Kite" status={brokerStatus.kite} />
          <BrokerItem id="upstox" name="Upstox" status={brokerStatus.upstox} />

          {showManualVerify && (
            <div className="verify-prompt">
              <p>Complete login in popup, then:</p>
              <button
                className="btn btn-success btn-sm"
                style={{ width: "100%", marginTop: "8px" }}
                onClick={handleManualVerify}
              >
                Verify Login
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="sidebar-section">
          <h3>⚡ Quick Actions</h3>
          <div className="quick-actions-grid">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                className="quick-action-btn"
                onClick={() => setInputMessage(action.message)}
                disabled={!brokerStatus[activeBroker]?.authenticated}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* System Actions */}
        <div className="sidebar-section" style={{ marginTop: "auto" }}>
          <h3>⚙️ System</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button className="btn btn-secondary btn-sm" onClick={handleResetChat}>
              🔄 Reset Chat
            </button>
            <button 
      className="btn btn-warning btn-sm" 
      onClick={() => handleLogout('all')}
    >
      Logout All Brokers
    </button>
    
    {/* ✅ NEW: User Logout (Safe - keeps brokers) */}
    <button 
      className="btn btn-danger btn-sm" 
      onClick={handleUserLogout}
    >
      Logout User
    </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="main-content">
        {/* HEADER */}
        <header className="top-header">
          <div className="header-title">
            <h1>AI Trading Dashboard</h1>
            <span className="subtitle">
              Multi-Broker Portfolio Management with AI Insights
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="view-switcher">
              <button
                className={`btn ${activeView === "trading" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveView("trading")}
              >
                💬 Assistant
              </button>

              <button
                className={`btn ${activeView === "holdings" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveView("holdings")}
              >
                📊 Holdings
              </button>
              <button
  className={`btn ${activeView === "insights" ? "btn-primary" : "btn-secondary"}`}
  onClick={() => setActiveView("insights")}
>
  📧 Insights
</button>
              <button
                className={`btn ${activeView === "portfolio" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveView("portfolio")}
              >
                🤖 AI Suggestions
              </button>

              <button
                className={`btn ${activeView === "analyzer" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveView("analyzer")}
              >
                📉 Analyzer
              </button>
            </div>

            {/* User Logout Button */}
            <button 
      className="btn btn-danger" 
      style={{ padding: '10px 14px', fontSize: '13px' }}
      onClick={handleUserLogout}
    >
      Logout User
    </button>
          </div>
        </header>

        {/* DASHBOARD CONTENT */}
        <div className="dashboard-container">
          {activeView === "insights" ? (
  <InsightsPage 
    onBack={() => setActiveView("trading")} 
    userEmail={userInfo?.user?.email || userInfo?.session_id}
  />
) : activeView === "holdings" ? (
  <PortfolioHoldings onBack={() => setActiveView("trading")} />
) : activeView === "portfolio" ? (
  <PortfolioSuggestor onBackToTrading={() => setActiveView("trading")} />
) : activeView === "analyzer" ? (
  <div className="analyzer-overlay">
    <div className="analyzer-header">
      <button className="analyzer-back-btn" onClick={() => setActiveView("trading")}>
        ← Back
      </button>
      <h2 className="analyzer-title">Market Pattern Analyzer</h2>
    </div>
    <div className="analyzer-body">
      <StockAnalyzer />
    </div>
  </div>
) : (
            /* CHAT VIEW */
            <div className="chat-card">
              <div className="chat-header">
                <div className="chat-header-left">
                  <h2>
                    {activeBroker.charAt(0).toUpperCase() + activeBroker.slice(1)} AI Assistant
                  </h2>

                  {brokerStatus[activeBroker]?.authenticated && (
                    <span className="model-badge">🤖 LangChain GPT</span>
                  )}
                </div>

                <span
                  className={`chat-status ${
                    brokerStatus[activeBroker]?.authenticated ? "active" : ""
                  }`}
                >
                  {brokerStatus[activeBroker]?.authenticated ? "● Live Agent" : "○ Offline"}
                </span>
              </div>

              <div className="messages-area">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🤖</div>
                    <h3>Welcome to AI Trading Assistant!</h3>
                    <p>Connect a broker from the sidebar to start trading.</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => renderMessage(msg, idx))}

                    {loading && (
                      <div className="message message-assistant">
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div ref={messagesEndRef} />
              </div>

              <form className="input-area" onSubmit={handleSendMessage}>
                <input
                  ref={inputRef}
                  type="text"
                  className="chat-input"
                  placeholder={
                    brokerStatus[activeBroker]?.authenticated
                      ? "Ask about holdings, positions, quotes, or place orders..."
                      : "Please connect a broker first..."
                  }
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={loading || !brokerStatus[activeBroker]?.authenticated}
                />

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    loading || !inputMessage.trim() || !brokerStatus[activeBroker]?.authenticated
                  }
                >
                  {loading ? "⏳" : "➤"} Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Styles */}
      <style>{`
        :root {
          --primary-dark: #0f172a;
          --primary-blue: #3b82f6;
          --success-green: #10b981;
          --danger-red: #ef4444;
          --warning-orange: #f59e0b;
          --bg-light: #f1f5f9;
          --card-bg: #ffffff;
          --text-main: #1e293b;
          --text-muted: #64748b;
          --border-color: #e2e8f0;
          --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          --radius-lg: 16px;
          --radius-md: 8px;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: var(--bg-light);
          color: var(--text-main);
          -webkit-font-smoothing: antialiased;
        }

        /* Layout */
        .app {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }

        /* Sidebar */
        .sidebar {
          width: 300px;
          background-color: var(--card-bg);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          padding: 24px;
          overflow-y: auto;
          flex-shrink: 0;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid var(--border-color);
        }

        .logo-icon {
          font-size: 32px;
        }

        .logo-text {
          font-size: 24px;
          font-weight: 800;
          background: linear-gradient(135deg, var(--primary-dark), var(--primary-blue));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .user-info-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 16px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          color: white;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .user-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .user-email {
          font-size: 12px;
          font-weight: 600;
          opacity: 0.9;
        }

        .btn-link {
          background: none;
          border: none;
          color: white;
          font-size: 11px;
          cursor: pointer;
          text-align: left;
          padding: 0;
          text-decoration: underline;
        }

        .sidebar-section {
          margin-bottom: 28px;
        }

        .sidebar-section h3 {
          font-size: 11px;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 1.2px;
          margin-bottom: 14px;
          font-weight: 700;
        }

        /* Broker Items */
        .broker-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 12px;
          border-radius: var(--radius-md);
          border: 1.5px solid var(--border-color);
          background: var(--card-bg);
          margin-bottom: 10px;
          transition: all 0.2s ease;
        }

        .broker-item:hover {
          border-color: var(--primary-blue);
          transform: translateX(2px);
        }

        .broker-item.active {
          border-color: var(--primary-blue);
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .broker-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .broker-status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: var(--danger-red);
          transition: all 0.3s;
        }

        .broker-status-dot.connected {
          background-color: var(--success-green);
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .broker-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--text-main);
        }

        .broker-actions {
          display: flex;
          gap: 6px;
        }

        /* Verify Prompt */
        .verify-prompt {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          padding: 14px;
          border-radius: var(--radius-md);
          margin-top: 12px;
          border: 1px solid #6ee7b7;
        }

        .verify-prompt p {
          font-size: 12px;
          color: #065f46;
          font-weight: 600;
          margin-bottom: 8px;
        }

        /* Buttons */
        .btn {
          padding: 10px 18px;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--primary-dark), #1e293b);
          color: white;
          box-shadow: var(--shadow-sm);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .btn-success {
          background: var(--success-green);
          color: white;
        }

        .btn-secondary {
          background: #f1f5f9;
          color: var(--text-main);
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .btn-danger {
          background: #fee2e2;
          color: var(--danger-red);
        }

        .btn-danger:hover:not(:disabled) {
          background: #fecaca;
        }

        /* Quick Actions */
        .quick-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .quick-action-btn {
          background: white;
          border: 1.5px solid var(--border-color);
          padding: 12px 8px;
          border-radius: var(--radius-md);
          font-size: 11px;
          color: var(--text-main);
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          font-weight: 500;
        }

        .quick-action-btn:hover:not(:disabled) {
          border-color: var(--primary-blue);
          background: #eff6ff;
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }

        .quick-action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Main Content */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg-light);
        }

        /* Header */
        .top-header {
          height: 80px;
          background: var(--card-bg);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          box-shadow: var(--shadow-sm);
        }

        .header-title h1 {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 4px;
        }

        .header-title .subtitle {
          font-size: 13px;
          color: var(--text-muted);
        }

        .view-switcher {
          display: flex;
          gap: 12px;
        }

        /* Dashboard */
        .dashboard-container {
          padding: 24px;
          height: calc(100vh - 80px);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        /* Chat Card */
        .chat-card {
          background: var(--card-bg);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }

        .chat-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
        }

        .chat-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chat-header h2 {
          font-size: 18px;
          font-weight: 700;
        }

        .model-badge {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .chat-status {
          font-size: 12px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 20px;
          background: #f1f5f9;
          color: var(--text-muted);
        }

        .chat-status.active {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          color: #065f46;
          animation: pulse 2s infinite;
        }

        /* Messages Area */
        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Messages */
        .message {
          max-width: 75%;
          padding: 14px 18px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.6;
          position: relative;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message-user {
          align-self: flex-end;
          background: linear-gradient(135deg, var(--primary-dark), #1e293b);
          color: white;
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.3);
        }

        .message-assistant {
          align-self: flex-start;
          background: white;
          border: 1px solid var(--border-color);
          color: var(--text-main);
          border-bottom-left-radius: 4px;
          box-shadow: var(--shadow-sm);
        }

        .message-system {
          align-self: center;
          background: #fffbeb;
          color: #92400e;
          border: 1px solid #fde047;
          font-size: 13px;
          text-align: center;
          max-width: 100%;
          padding: 10px 16px;
        }

        .message-error {
          align-self: center;
          background: #fef2f2;
          color: var(--danger-red);
          border: 1px solid #fecaca;
          max-width: 100%;
        }

        .message-meta {
          font-size: 11px;
          margin-bottom: 6px;
          opacity: 0.75;
          display: block;
          font-weight: 600;
        }

        /* Empty State */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 40px;
          text-align: center;
          height: 100%;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 24px;
          animation: bounce 2s infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .empty-state h3 {
          font-size: 24px;
          margin-bottom: 12px;
          color: var(--text-main);
        }

        .empty-state p {
          color: var(--text-muted);
          margin-bottom: 32px;
          font-size: 15px;
        }

        .features-row {
          display: flex;
          gap: 20px;
          justify-content: center;
          margin-bottom: 40px;
          flex-wrap: wrap;
        }

        .feature-card {
          background: white;
          padding: 24px 20px;
          border-radius: var(--radius-lg);
          border: 2px solid var(--border-color);
          width: 180px;
          text-align: center;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .feature-card:hover {
          transform: translateY(-4px);
          border-color: var(--primary-blue);
          box-shadow: var(--shadow-md);
        }

        .feature-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .feature-card strong {
          display: block;
          font-size: 15px;
          color: var(--text-main);
          margin-bottom: 4px;
        }

        .feature-card span:last-child {
          font-size: 12px;
          color: var(--text-muted);
        }

        .getting-started {
          background: white;
          padding: 24px;
          border-radius: var(--radius-lg);
          border: 2px solid var(--border-color);
          text-align: left;
          max-width: 500px;
        }

        .getting-started h4 {
          margin-bottom: 16px;
          color: var(--text-main);
          font-size: 16px;
        }

        .getting-started ol {
          padding-left: 24px;
          color: var(--text-muted);
          line-height: 1.8;
        }

        .getting-started li {
          margin-bottom: 8px;
        }

        /* Typing Indicator */
        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 8px;
        }

        .typing-indicator span {
          display: inline-block;
          width: 8px;
          height: 8px;
          background-color: var(--text-muted);
          border-radius: 50%;
          animation: bounce-typing 1.4s infinite ease-in-out both;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce-typing {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        /* Input Area */
        .input-area {
          padding: 20px 24px;
          background: white;
          border-top: 1px solid var(--border-color);
          display: flex;
          gap: 12px;
        }

        .chat-input {
          flex: 1;
          padding: 14px 18px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
          background: #f8fafc;
          font-family: inherit;
        }

        .chat-input:focus {
          border-color: var(--primary-blue);
          background: white;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .chat-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Analyzer Overlay (light, full-page inside main content) */
        .analyzer-overlay {
          background: var(--card-bg);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          flex: 1;
          display: flex;
          flex-direction: column;
          animation: analyzerSlideIn 0.3s ease-out;
        }

        @keyframes analyzerSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .analyzer-header {
          height: 64px;
          padding: 0 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 16px;
          background: #f8fafc;
        }

        .analyzer-back-btn {
          padding: 8px 14px;
          background: #e5e7eb;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid #d1d5db;
          color: var(--text-main);
        }

        .analyzer-back-btn:hover {
          background: #d1d5db;
        }

        .analyzer-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-main);
        }

        .analyzer-body {
          flex: 1;
          overflow-y: auto;
          background: #f3f4f6;
          padding: 16px 20px;
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #e2e8f0;
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .sidebar {
            width: 260px;
          }

          .features-row {
            flex-direction: column;
            align-items: center;
          }
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: -300px;
            z-index: 1000;
            transition: left 0.3s;
          }

          .app {
            flex-direction: column;
          }

          .quick-actions-grid {
            grid-template-columns: 1fr;
          }

          .view-switcher {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}
