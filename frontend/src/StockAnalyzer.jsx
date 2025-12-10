// StockDashboard.jsx
// PatternAI Pro – Enhanced Dashboard with Full API Utilization

import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Search,
  TrendingUp,
  Activity,
  BrainCircuit,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Target,
  Sparkles,
  CheckCircle,
  XCircle,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

import "./analyzer.css";

const API_BASE_URL = "https://33trpk9t-5500.inc1.devtunnels.ms";

// ==============================
// ROOT DASHBOARD
// ==============================
export default function StockDashboard() {
  const [symbol, setSymbol] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedMatch, setExpandedMatch] = useState(null);

  const [period, setPeriod] = useState("6mo");
  const [lookback, setLookback] = useState(30);
  const [topN, setTopN] = useState(5);

  const fetchData = async (e) => {
    e.preventDefault();
    if (!symbol) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        period,
        lookback: lookback.toString(),
        top_n: topN.toString(),
      });

      const res = await fetch(`${API_BASE_URL}/analyze?${params}`);
      const contentType = res.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        throw new Error("Invalid server response");
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.detail || "Error fetching data");

      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const signalColor = {
    BUY: "signal-buy",
    SELL: "signal-sell",
    HOLD: "signal-hold",
    NEUTRAL: "signal-neutral",
  };

  const getSignalColor = (s) => signalColor[s] || signalColor.NEUTRAL;

  return (
    <DashboardShell>
      <Header />

      <div className="dashboard-section-stack">
        <Card className="card-hero">
          <SearchSection
            symbol={symbol}
            setSymbol={setSymbol}
            period={period}
            setPeriod={setPeriod}
            lookback={lookback}
            setLookback={setLookback}
            topN={topN}
            setTopN={setTopN}
            loading={loading}
            fetchData={fetchData}
            error={error}
          />
        </Card>

        {data ? (
          <main className="dashboard-main">
            <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

            {activeTab === "overview" && (
              <Card title="Market overview" subtitle="Key indicators and price action">
                <OverviewTab data={data} getSignalColor={getSignalColor} />
              </Card>
            )}

            {activeTab === "patterns" && (
              <Card
                title="Historical pattern matches"
                subtitle="Top similar periods from history and their future outcomes"
              >
                <PatternsTab
                  data={data}
                  expandedMatch={expandedMatch}
                  setExpandedMatch={setExpandedMatch}
                />
              </Card>
            )}

            {activeTab === "predictions" && (
              <Card
                title="Forecasts & scenarios"
                subtitle="Scenario-based return projections based on matched patterns"
              >
                <PredictionsTab data={data} />
              </Card>
            )}

            {activeTab === "ai-report" && (
              <Card className="card-ai-report">
                <AiReportTab data={data} />
              </Card>
            )}
          </main>
        ) : (
          <EmptyState />
        )}
      </div>
    </DashboardShell>
  );
}

// ==============================
// LAYOUT PRIMITIVES
// ==============================
function DashboardShell({ children }) {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-inner">{children}</div>
    </div>
  );
}

function Card({ title, subtitle, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle) && (
        <header className="card-header">
          {title && <h2 className="card-title">{title}</h2>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

// ==============================
// HEADER
// ==============================
function Header() {
  return (
    <header className="dashboard-header">
      <div className="header-left">
        <div className="header-icon">
          <TrendingUp className="icon-md icon-inverse" />
        </div>
        <div>
          <h1 className="header-title">
            PatternAI <span className="header-title-accent">Pro</span>
          </h1>
          <p className="header-subtitle">
            AI-powered pattern recognition &amp; market forecasting
          </p>
        </div>
      </div>
    </header>
  );
}

// ==============================
// EMPTY STATE
// ==============================
function EmptyState() {
  return (
    <Card
      title="Start with a symbol"
      subtitle="Analyze any stock by entering its ticker above. PatternAI will search history for similar regimes and generate forecasts."
    >
      <div className="empty-state">
        <div className="empty-state-icon">
          <Sparkles className="icon-lg icon-main" />
        </div>
        <div>
          <p className="empty-state-text">
            Try symbols like <span className="empty-state-symbol">AAPL</span>,{" "}
            <span className="empty-state-symbol">TSLA</span>,{" "}
            <span className="empty-state-symbol">RELIANCE.NS</span>.
          </p>
          <p className="empty-state-caption">
            Pattern matching runs over the selected window and compares regimes
            across history.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ==============================
// SEARCH + CONTROLS
// ==============================
function SearchSection(props) {
  const {
    symbol,
    setSymbol,
    period,
    setPeriod,
    lookback,
    setLookback,
    topN,
    setTopN,
    loading,
    fetchData,
    error,
  } = props;

  return (
    <div className="search-section">
      <div className="search-heading-row">
        <div>
          <h2 className="search-title">Analyze market patterns</h2>
          <p className="search-subtitle">
            Historical similarity search with AI commentary and scenario
            projections.
          </p>
        </div>
      </div>

      <form onSubmit={fetchData} className="search-form">
        <div className="search-input-wrapper">
          <Search className="search-input-icon" />
          <input
            className="search-input"
            placeholder="Enter ticker (e.g. AAPL, RELIANCE.NS)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
          <button
            type="submit"
            disabled={loading || !symbol}
            className={`search-button ${loading || !symbol ? "is-disabled" : ""}`}
          >
            {loading ? "Scanning..." : "Analyze"}
            {!loading && <Sparkles className="icon-sm" />}
          </button>
        </div>

        <div className="search-controls-grid">
          <Select
            label="History window"
            value={period}
            onChange={setPeriod}
            options={[
              ["1mo", "1 Month"],
              ["3mo", "3 Months"],
              ["6mo", "6 Months"],
              ["1y", "1 Year"],
              ["2y", "2 Years"],
              ["5y", "5 Years"],
              ["10y", "10 Years"],
            ]}
          />
          <NumberInput
            label="Lookback (days)"
            value={lookback}
            setValue={setLookback}
            min={5}
            max={90}
          />
          <NumberInput
            label="Top matches"
            value={topN}
            setValue={setTopN}
            min={1}
            max={20}
          />
        </div>
      </form>

      {error && (
        <div className="error-banner">
          <AlertCircle className="icon-sm" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-select"
      >
        {options.map(([val, txt]) => (
          <option value={val} key={val}>
            {txt}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberInput({ label, value, setValue, min, max }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(parseInt(e.target.value || "0", 10))}
        className="field-input"
      />
    </div>
  );
}

// ==============================
// TABS
// ==============================
function Tabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "patterns", label: "Matches", icon: Target },
    { id: "predictions", label: "Predictions", icon: BarChart3 },
    { id: "ai-report", label: "AI Report", icon: BrainCircuit },
  ];

  return (
    <nav className="tabs-nav">
      {tabs.map((t) => {
        const ActiveIcon = t.icon;
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`tab-button ${isActive ? "tab-button-active" : ""}`}
          >
            <ActiveIcon className="icon-sm" />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

// ==============================
// OVERVIEW TAB
// ==============================
function OverviewTab({ data, getSignalColor }) {
  return (
    <div className="overview-layout">
      <div className="overview-main">
        <Metrics data={data} getSignalColor={getSignalColor} />
        <MainCharts data={data} />
        <CandlestickStrip data={data} />
        <CandlestickStatistics data={data} />
      </div>
      <aside className="overview-side">
        <SideInsights data={data} />
      </aside>
    </div>
  );
}

// ==============================
// METRICS
// ==============================
function Metrics({ data, getSignalColor }) {
  const d = data.indicators || {};
  const a = data.analysis || {};

  const priceChangeClass =
    d.change_1d != null
      ? d.change_1d >= 0
        ? "metric-subvalue-positive"
        : "metric-subvalue-negative"
      : "metric-subvalue-neutral";

  function getCurrencySymbol(symbol) {
    if (!symbol) return "₹";
    const s = symbol.toUpperCase();
    if (s.endsWith(".NS") || s.endsWith(".BO")) return "₹";
    return "$";
  }

  return (
    <div className="metrics-grid">
      <MetricCard
        label="Price"
        value={
          d.current_price != null
            ? `${getCurrencySymbol(data.symbol)}${d.current_price.toFixed(2)}`
            : "--"
        }
        subValue={
          d.change_1d != null
            ? `${d.change_1d >= 0 ? "+" : ""}${d.change_1d.toFixed(2)}%`
            : null
        }
        subColor={priceChangeClass}
      />
      <MetricCard
        label="SMA 20"
        value={
          d.sma_20 != null
            ? `${getCurrencySymbol(data.symbol)}${d.sma_20.toFixed(2)}`
            : "--"
        }
      />
      <MetricCard
        label="SMA 50"
        value={
          d.sma_50 != null
            ? `${getCurrencySymbol(data.symbol)}${d.sma_50.toFixed(2)}`
            : "--"
        }
      />
      <MetricCard
        label="RSI (14)"
        value={d.rsi_14 != null ? d.rsi_14.toFixed(0) : "--"}
        subValue={
          d.rsi_14 != null
            ? d.rsi_14 > 70
              ? "Overbought"
              : d.rsi_14 < 30
              ? "Oversold"
              : "Neutral"
            : null
        }
      />
      <div className={`metric-ai-signal ${getSignalColor(a.signal)}`}>
        <div className="metric-ai-label">AI signal</div>
        <div className="metric-ai-value">{a.signal || "--"}</div>
        {a.time_horizon && (
          <div className="metric-ai-horizon">Horizon: {a.time_horizon}</div>
        )}
      </div>
      <MetricCard
        label="Pattern confidence"
        value={a.confidence != null ? `${a.confidence.toFixed(0)}%` : "--"}
        subValue="Similarity score"
        subColor="metric-subvalue-emphasis"
      />
    </div>
  );
}

function MetricCard({ label, value, subValue, subColor }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value || "--"}</div>
      {subValue && (
        <div className={`metric-subvalue ${subColor || ""}`}>{subValue}</div>
      )}
    </div>
  );
}

// ==============================
// MAIN CHARTS (price + volume)
// ==============================
function MainCharts({ data }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    async function loadHistory() {
      try {
        if (!data?.symbol || !data?.period) return;
        const res = await fetch(
          `${API_BASE_URL}/history?symbol=${data.symbol}&period=${data.period}&interval=1d`
        );
        const json = await res.json();
        if (json?.data) setHistory(json.data || json);
      } catch (e) {
        console.error("History fetch failed", e);
      }
    }
    loadHistory();
  }, [data]);

  if (!history.length) {
    return (
      <div className="charts-grid">
        <div className="chart-main">
          <h3 className="chart-title">Price & volume</h3>
          <p className="text-muted">No historical data available.</p>
        </div>
      </div>
    );
  }

  const dates = history.map((d) => d.date);
  const opens = history.map((d) => d.open);
  const highs = history.map((d) => d.high);
  const lows = history.map((d) => d.low);
  const closes = history.map((d) => d.close);
  const volumes = history.map((d) => d.volume);

  return (
    <div className="charts-grid">
      <div className="chart-main">
        <h3 className="chart-title">Price & volume</h3>
        <div className="chart-plot-wrapper">
          <Plot
            data={[
              {
                x: dates,
                open: opens,
                high: highs,
                low: lows,
                close: closes,
                type: "candlestick",
                name: "Price",
                increasing: { line: { color: "#16a34a" } },
                decreasing: { line: { color: "#dc2626" } },
                xaxis: "x",
                yaxis: "y1",
              },
              {
                x: dates,
                y: volumes,
                type: "bar",
                name: "Volume",
                marker: { color: "#9ca3af" },
                opacity: 0.6,
                xaxis: "x",
                yaxis: "y2",
              },
            ]}
            layout={{
              autosize: true,
              showlegend: false,
              margin: { l: 40, r: 20, t: 20, b: 30 },
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              xaxis: {
                domain: [0, 1],
                rangeslider: { visible: false },
                showgrid: false,
                tickfont: { color: "#6b7280" },
                type: "date",
              },
              yaxis: {
                domain: [0.35, 1],
                title: "Price",
                gridcolor: "#e5e7eb",
                tickfont: { color: "#6b7280" },
              },
              yaxis2: {
                domain: [0, 0.25],
                title: "Volume",
                gridcolor: "#f3f4f6",
                tickfont: { color: "#9ca3af" },
              },
              hovermode: "x unified",
            }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      </div>

      <div className="chart-ai-summary">
        <div>
          <h3 className="chart-ai-title">
            <Sparkles className="icon-sm" /> AI summary
          </h3>
          <p className="chart-ai-text">
            {data.analysis?.reason || "No explanation generated."}
          </p>
        </div>
        <div className="chart-ai-info-grid">
          <InfoBox
            label="Volatility"
            value={
              data.indicators?.volatility != null
                ? `${data.indicators.volatility.toFixed(2)}%`
                : "--"
            }
          />
          <InfoBox
            label="Volume ratio"
            value={
              data.indicators?.volume_ratio != null
                ? `${data.indicators.volume_ratio.toFixed(2)}x`
                : "--"
            }
          />
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="info-block">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );
}

// ==============================
// CANDLESTICK STRIP (ENHANCED)
// ==============================
function CandlestickStrip({ data }) {
  const recent = data.candlestick_patterns?.recent || [];

  if (recent.length === 0) return null;

  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>
        🕯️ Recent Candlestick Patterns
      </h3>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px'
      }}>
        {recent.slice(0, 6).map((p, idx) => {
          const typeColor = p.type.includes('bullish') ? '#10b981' :
                          p.type.includes('bearish') ? '#ef4444' : '#f59e0b';
          
          return (
            <div 
              key={idx} 
              style={{
                background: '#ffffff',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '20px',
                position: 'relative',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = typeColor;
                e.currentTarget.style.boxShadow = `0 4px 12px ${typeColor}30`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  lineHeight: '1.3'
                }}>
                  {p.name}
                </div>
                <div style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  background: `${typeColor}20`,
                  color: typeColor,
                  minWidth: '50px',
                  textAlign: 'center'
                }}>
                  {p.confidence}%
                </div>
              </div>

              {/* Badges Row */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  background: '#f3f4f6',
                  color: '#6b7280',
                  fontWeight: '600'
                }}>
                  {p.reliability}
                </span>
                
                {p.confirmation && (
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    background: '#dcfce7',
                    color: '#059669',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <CheckCircle style={{ width: '12px', height: '12px' }} />
                    Confirmed
                  </span>
                )}
                
                {p.volume_confirmed && (
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    background: '#dbeafe',
                    color: '#1e40af',
                    fontWeight: '600'
                  }}>
                    Vol ✓
                  </span>
                )}

                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  background: p.type.includes('bullish') ? '#d1fae5' : 
                             p.type.includes('bearish') ? '#fee2e2' : '#fef3c7',
                  color: p.type.includes('bullish') ? '#065f46' :
                         p.type.includes('bearish') ? '#991b1b' : '#92400e',
                  fontWeight: '600'
                }}>
                  {p.type.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {/* Description */}
              <p style={{
                margin: '0 0 12px',
                fontSize: '0.85rem',
                color: '#6b7280',
                lineHeight: '1.6'
              }}>
                {p.description}
              </p>

              {/* Footer */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '14px',
                borderTop: '1px solid #f3f4f6'
              }}>
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  📅 {p.date}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: '#f9fafb',
                  color: '#374151',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  {p.trend_context}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==============================
// CANDLESTICK STATISTICS (NEW)
// ==============================
function CandlestickStatistics({ data }) {
  const stats = data.candlestick_patterns?.statistics || {};
  
  if (!Object.keys(stats).length) return null;

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '14px',
      padding: '24px',
      marginTop: '24px'
    }}>
      <h3 style={{ 
        margin: '0 0 20px', 
        fontSize: '1.1rem', 
        fontWeight: '600',
        color: '#1f2937',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        📊 Pattern Performance History
        <span style={{
          fontSize: '0.75rem',
          color: '#6b7280',
          fontWeight: '400',
          background: '#f3f4f6',
          padding: '4px 8px',
          borderRadius: '6px'
        }}>
          Historical success rates
        </span>
      </h3>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px'
      }}>
        {Object.entries(stats).slice(0, 12).map(([patternName, patternData]) => (
          <div key={patternName} style={{
            background: '#f9fafb',
            borderRadius: '12px',
            padding: '18px',
            border: '1px solid #e5e7eb',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h4 style={{
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                {patternName}
              </h4>
              <span style={{
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: '700',
                background: patternData.type.includes('bullish') ? '#d1fae5' : 
                           patternData.type.includes('bearish') ? '#fee2e2' : '#fef3c7',
                color: patternData.type.includes('bullish') ? '#065f46' :
                       patternData.type.includes('bearish') ? '#991b1b' : '#92400e'
              }}>
                {patternData.type.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#6b7280', 
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                background: '#e5e7eb',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {patternData.count} occurrences
              </span>
            </div>

            {/* Success rates by time period */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '8px',
              marginTop: '14px'
            }}>
              {['1d', '3d', '5d', '7d', '10d'].map(period => {
                const outcome = patternData.outcomes?.[period];
                if (!outcome) return null;
                
                const successRate = outcome.success_rate || 0;
                const isPositive = successRate >= 50;
                
                return (
                  <div key={period} style={{
                    background: isPositive ? '#dcfce7' : '#fef2f2',
                    borderRadius: '8px',
                    padding: '10px 6px',
                    textAlign: 'center',
                    border: `2px solid ${isPositive ? '#86efac' : '#fca5a5'}`,
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                    
                    <div style={{
                      fontSize: '0.7rem',
                      color: '#6b7280',
                      fontWeight: '600',
                      marginBottom: '4px'
                    }}>
                      {period}
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      color: isPositive ? '#059669' : '#dc2626',
                      marginBottom: '2px'
                    }}>
                      {successRate.toFixed(0)}%
                    </div>
                    <div style={{
                      fontSize: '0.65rem',
                      color: '#9ca3af',
                      fontWeight: '600'
                    }}>
                      {outcome.mean >= 0 ? '↑' : '↓'} {Math.abs(outcome.mean).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==============================
// SIDE INSIGHTS (overview)
// ==============================
function SideInsights({ data }) {
  const summary = data.candlestick_patterns?.summary;
  const recent = data.candlestick_patterns?.recent || [];
  const analysis = data.analysis || {};

  return (
    <div className="side-panel">
      <h3 className="side-title">Quick insights</h3>

      {/* AI Signal Summary */}
      <div className="side-section" style={{
        background: analysis.signal === 'BUY' ? '#ecfdf5' :
                   analysis.signal === 'SELL' ? '#fef2f2' :
                   analysis.signal === 'HOLD' ? '#fefce8' : '#f0f9ff',
        border: `2px solid ${
          analysis.signal === 'BUY' ? '#86efac' :
          analysis.signal === 'SELL' ? '#fca5a5' :
          analysis.signal === 'HOLD' ? '#fde047' : '#93c5fd'
        }`,
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px'
      }}>
        <h4 className="side-section-title" style={{ marginBottom: '12px' }}>
          🎯 AI Signal
        </h4>
        <div style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: analysis.signal === 'BUY' ? '#059669' :
                 analysis.signal === 'SELL' ? '#dc2626' :
                 analysis.signal === 'HOLD' ? '#d97706' : '#0c4a6e',
          marginBottom: '8px'
        }}>
          {analysis.signal || 'NEUTRAL'}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
          Confidence: <strong>{analysis.confidence?.toFixed(0)}%</strong>
        </div>
      </div>

      <div className="side-section">
        <h4 className="side-section-title">Candlestick patterns</h4>
        {summary ? (
          <ul className="side-list">
            <li>Total: <strong>{summary.total_detected}</strong></li>
            <li style={{ color: '#059669' }}>Bullish: <strong>{summary.bullish}</strong></li>
            <li style={{ color: '#dc2626' }}>Bearish: <strong>{summary.bearish}</strong></li>
            <li>Confirmed: <strong>{summary.confirmed}</strong></li>
          </ul>
        ) : (
          <p className="text-muted">No patterns detected in recent window.</p>
        )}
        {recent.length > 0 && (
          <ul className="side-chip-list">
            {recent.slice(0, 3).map((p) => (
              <li
                key={p.date + p.name}
                className={`side-chip side-chip-${p.type}`}
              >
                <span>{p.name}</span>
                <span className="side-chip-meta">{p.date}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="side-section">
        <h4 className="side-section-title">Model metadata</h4>
        <ul className="side-list">
          <li>
            Avg similarity:{" "}
            {data.analysis?.mean_similarity != null
              ? `${data.analysis.mean_similarity.toFixed(1)}%`
              : "--"}
          </li>
          <li>Matches: {data.similarity_matches?.length ?? "--"}</li>
          <li>
            Candle patterns:{" "}
            {data.candlestick_patterns?.summary?.total_detected ?? "--"}
          </li>
        </ul>
      </div>
    </div>
  );
}

// ==============================
// PATTERNS TAB (ENHANCED)
// ==============================
function PatternsTab({ data, expandedMatch, setExpandedMatch }) {
  if (!data.similarity_matches || data.similarity_matches.length === 0) {
    return (
      <p className="text-muted">
        No pattern matches found for this configuration.
      </p>
    );
  }

  return (
    <div className="patterns-list">
      {data.similarity_matches.map((m, idx) => (
        <div key={idx} className="pattern-card">
          <button
            type="button"
            className="pattern-header"
            onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
          >
            <div className="pattern-header-left">
              <div className="pattern-rank">#{m.rank ?? idx + 1}</div>
              <div className="pattern-header-text">
                <div className="pattern-dates">
                  {m.start_date} → {m.end_date}
                </div>
                <div className="pattern-subtitle">
                  Historical regime • Similarity match
                </div>
              </div>
            </div>
            <div className="pattern-header-right">
              {m.score != null && (
                <span className="pattern-score">{m.score.toFixed(1)}%</span>
              )}
              {expandedMatch === idx ? (
                <ChevronUp className="icon-xs icon-muted" />
              ) : (
                <ChevronDown className="icon-xs icon-muted" />
              )}
            </div>
          </button>

          {expandedMatch === idx && (
            <div className="pattern-body">
              <div className="pattern-body-grid">
                <div>
                  <h4 className="pattern-section-title">
                    Future returns after this pattern
                  </h4>
                  <div className="pattern-future-returns">
                    {m.future_returns &&
                      Object.entries(m.future_returns).map(([k, v]) => (
                        <div
                          key={k}
                          className={`future-return-box ${
                            v >= 0
                              ? "future-return-positive"
                              : "future-return-negative"
                          }`}
                        >
                          <div className="future-return-label">{k}</div>
                          <div className="future-return-value">
                            {v >= 0 ? "+" : ""}
                            {v.toFixed(2)}%
                          </div>
                        </div>
                      ))}
                  </div>

                  {m.future_returns && (
                    <div className="pattern-future-chart">
                      <Plot
                        data={[
                          {
                            x: Object.keys(m.future_returns),
                            y: Object.values(m.future_returns),
                            type: "bar",
                            marker: {
                              color: Object.values(m.future_returns).map((v) =>
                                v >= 0 ? "#16a34a" : "#dc2626"
                              ),
                            },
                          },
                        ]}
                        layout={{
                          autosize: true,
                          margin: { l: 30, r: 10, t: 10, b: 30 },
                          paper_bgcolor: "rgba(0,0,0,0)",
                          plot_bgcolor: "rgba(0,0,0,0)",
                          xaxis: {
                            tickfont: { color: "#6b7280", size: 10 },
                            showgrid: false,
                          },
                          yaxis: {
                            title: "% return",
                            tickfont: { color: "#6b7280", size: 10 },
                            gridcolor: "#e5e7eb",
                          },
                        }}
                        config={{ displayModeBar: false, staticPlot: true }}
                        style={{ width: "100%", height: 140 }}
                      />
                    </div>
                  )}
                </div>

                {m.ai_insight && (
                  <div className="pattern-ai-insight">
                    <span className="pattern-ai-label">AI insight</span>
                    {m.ai_insight}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ==============================
// PREDICTIONS TAB (ENHANCED)
// ==============================
function PredictionsTab({ data }) {
  if (!data.predictions) {
    return (
      <p className="text-muted">
        No prediction scenarios available for this configuration.
      </p>
    );
  }

  const entries = Object.entries(data.predictions);

  return (
    <div>
      {/* Enhanced Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {entries.map(([label, v]) => {
          const isPositive = v.mean >= 0;
          const positiveRate = v.positive_rate || 50;
          
          return (
            <div key={label} style={{
              background: '#ffffff',
              border: `2px solid ${isPositive ? '#86efac' : '#fca5a5'}`,
              borderRadius: '16px',
              padding: '24px',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${isPositive ? '#10b98140' : '#ef444440'}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              
              {/* Background gradient */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '120px',
                height: '120px',
                background: `radial-gradient(circle, ${isPositive ? '#10b98130' : '#ef444430'}, transparent)`,
                pointerEvents: 'none'
              }} />

              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                position: 'relative'
              }}>
                <h4 style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Clock style={{ width: '18px', height: '18px', color: '#6b7280' }} />
                  {label}
                </h4>
                {isPositive ? (
                  <ArrowUp style={{ width: '24px', height: '24px', color: '#059669' }} />
                ) : (
                  <ArrowDown style={{ width: '24px', height: '24px', color: '#dc2626' }} />
                )}
              </div>

              {/* Main Value */}
              <div style={{
                fontSize: '3rem',
                fontWeight: '700',
                color: isPositive ? '#059669' : '#dc2626',
                marginBottom: '16px',
                lineHeight: '1',
                position: 'relative'
              }}>
                {v.mean >= 0 ? '+' : ''}{v.mean.toFixed(2)}%
              </div>

              {/* Statistics Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                marginBottom: '16px',
                position: 'relative'
              }}>
                <div style={{
                  background: '#f9fafb',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: '#9ca3af', 
                    marginBottom: '6px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    MEDIAN
                  </div>
                  <div style={{
                    fontSize: '1.3rem',
                    fontWeight: '700',
                    color: '#374151'
                  }}>
                    {v.median?.toFixed(2)}%
                  </div>
                </div>
                
                <div style={{
                  background: '#f9fafb',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: '#9ca3af', 
                    marginBottom: '6px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    SUCCESS
                  </div>
                  <div style={{
                    fontSize: '1.3rem',
                    fontWeight: '700',
                    color: positiveRate >= 50 ? '#059669' : '#dc2626'
                  }}>
                    {positiveRate.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Range Bar */}
              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: '#6b7280',
                  marginBottom: '8px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  RANGE
                </div>
                <div style={{
                  position: 'relative',
                  height: '10px',
                  background: '#e5e7eb',
                  borderRadius: '5px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '0',
                    top: 0,
                    width: '100%',
                    height: '100%',
                    background: `linear-gradient(to right, #ef4444, #f59e0b, #10b981)`,
                    opacity: 0.3
                  }} />
                  <div style={{
                    position: 'absolute',
                    left: `${((v.mean - v.min) / (v.max - v.min)) * 100}%`,
                    top: '-2px',
                    width: '14px',
                    height: '14px',
                    background: isPositive ? '#059669' : '#dc2626',
                    borderRadius: '50%',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transform: 'translateX(-50%)'
                  }} />
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '6px',
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  fontWeight: '600'
                }}>
                  <span>{v.min.toFixed(1)}%</span>
                  <span>{v.max.toFixed(1)}%</span>
                </div>
              </div>

              {/* Mini Chart */}
              <div style={{ height: '70px', marginTop: '16px', position: 'relative' }}>
                <Plot
                  data={[
                    {
                      x: [0, 1, 2],
                      y: [v.min, v.mean, v.max],
                      type: 'scatter',
                      mode: 'lines+markers',
                      line: { 
                        color: isPositive ? '#10b981' : '#ef4444', 
                        width: 3,
                        shape: 'spline'
                      },
                      marker: { 
                        size: 8, 
                        color: isPositive ? '#059669' : '#dc2626',
                        line: { color: 'white', width: 2 }
                      },
                      fill: 'tozeroy',
                      fillcolor: isPositive ? '#10b98120' : '#ef444420'
                    }
                  ]}
                  layout={{
                    autosize: true,
                    margin: { l: 0, r: 0, t: 0, b: 0 },
                    xaxis: { visible: false },
                    yaxis: { visible: false },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    showlegend: false
                  }}
                  config={{ displayModeBar: false, staticPlot: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Chart */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)'
      }}>
        <h3 style={{ 
          margin: '0 0 24px', 
          fontSize: '1.2rem', 
          fontWeight: '600',
          color: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <BarChart3 style={{ width: '24px', height: '24px', color: '#3b82f6' }} />
          Predicted Returns Comparison
        </h3>
        <PredictionComparisonChart predictions={data.predictions} />
      </div>
    </div>
  );
}

function PredictionComparisonChart({ predictions }) {
  const labels = Object.keys(predictions);
  const means = labels.map(k => predictions[k].mean);
  const mins = labels.map(k => predictions[k].min);
  const maxs = labels.map(k => predictions[k].max);

  return (
    <Plot
      data={[
        {
          x: labels,
          y: maxs,
          type: 'scatter',
          mode: 'lines',
          name: 'Best Case',
          line: { color: '#10b981', width: 2, dash: 'dot' },
          fill: 'tonexty',
          fillcolor: 'rgba(16, 185, 129, 0.1)'
        },
        {
          x: labels,
          y: means,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Expected',
          line: { color: '#3b82f6', width: 4 },
          marker: { size: 12, color: '#2563eb', line: { color: 'white', width: 2 } }
        },
        {
          x: labels,
          y: mins,
          type: 'scatter',
          mode: 'lines',
          name: 'Worst Case',
          line: { color: '#ef4444', width: 2, dash: 'dot' },
          fill: 'tonexty',
          fillcolor: 'rgba(239, 68, 68, 0.1)'
        }
      ]}
      layout={{
        autosize: true,
        height: 400,
        margin: { l: 70, r: 40, t: 20, b: 70 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { family: 'system-ui', color: '#6b7280', size: 12 },
        xaxis: {
          title: { 
            text: 'Time Horizon',
            font: { size: 14, color: '#374151', weight: 600 }
          },
          tickfont: { size: 13, color: '#6b7280', weight: 500 },
          gridcolor: '#f3f4f6',
          showline: true,
          linecolor: '#e5e7eb',
          linewidth: 2
        },
        yaxis: {
          title: { 
            text: 'Return %',
            font: { size: 14, color: '#374151', weight: 600 }
          },
          tickfont: { size: 13, color: '#6b7280', weight: 500 },
          gridcolor: '#e5e7eb',
          zeroline: true,
          zerolinecolor: '#9ca3af',
          zerolinewidth: 2
        },
        hovermode: 'x unified',
        showlegend: true,
        legend: {
          x: 0.02,
          y: 0.98,
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          bordercolor: '#e5e7eb',
          borderwidth: 2,
          font: { size: 12 }
        }
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// ==============================
// AI REPORT TAB (ENHANCED)
// ==============================
function AiReportTab({ data }) {
  const metadata = data.metadata || {};
  const predictions = data.predictions || {};
  const analysis = data.analysis || {};
  const indicators = data.indicators || {};
  const patterns = data.candlestick_patterns || {};

  // Pattern type distribution
  const patternTypes = {};
  if (patterns.all) {
    patterns.all.forEach(p => {
      const type = p.type || 'neutral';
      patternTypes[type] = (patternTypes[type] || 0) + 1;
    });
  }

  const signalColors = {
    BUY: { bg: '#ecfdf5', border: '#86efac', text: '#166534' },
    SELL: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    HOLD: { bg: '#fefce8', border: '#fde047', text: '#854d0e' },
    NEUTRAL: { bg: '#f0f9ff', border: '#93c5fd', text: '#0c4a6e' }
  };

  const signalColor = signalColors[analysis.signal] || signalColors.NEUTRAL;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Enhanced Header Section */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
        borderRadius: '20px',
        padding: '36px',
        color: 'white',
        boxShadow: '0 20px 50px rgba(37, 99, 235, 0.3)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '36px',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative background */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1), transparent)',
          pointerEvents: 'none'
        }} />

        {/* Left: Signal Badge */}
        <div style={{
          width: '130px',
          height: '130px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          backdropFilter: 'blur(10px)',
          border: '3px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
          position: 'relative'
        }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, fontWeight: '500' }}>Signal</div>
          <div style={{
            fontSize: '2.8rem',
            fontWeight: '800',
            marginTop: '8px',
            letterSpacing: '-1px'
          }}>
            {analysis.signal || 'N/A'}
          </div>
        </div>

        {/* Middle: Description */}
        <div style={{ position: 'relative' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
            AI Analysis Dashboard
          </h2>
          <p style={{ margin: '0 0 20px', opacity: 0.95, fontSize: '1rem', lineHeight: '1.7' }}>
            {analysis.reason || 'Comprehensive AI-powered market analysis with pattern recognition and forecasting'}
          </p>
          <div style={{ display: 'flex', gap: '28px', fontSize: '0.95rem' }}>
            <div>
              <div style={{ opacity: 0.8, marginBottom: '6px' }}>Confidence</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800' }}>
                {analysis.confidence?.toFixed(0)}%
              </div>
            </div>
            <div>
              <div style={{ opacity: 0.8, marginBottom: '6px' }}>Avg Similarity</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800' }}>
                {analysis.mean_similarity?.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Right: Stats */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          textAlign: 'right',
          position: 'relative'
        }}>
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.12)', 
            padding: '16px 24px', 
            borderRadius: '14px', 
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '6px' }}>Matches Found</div>
            <div style={{ fontSize: '2.2rem', fontWeight: '800' }}>{data.similarity_matches?.length || 0}</div>
          </div>
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.12)', 
            padding: '16px 24px', 
            borderRadius: '14px', 
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '6px' }}>Patterns</div>
            <div style={{ fontSize: '2.2rem', fontWeight: '800' }}>{patterns.summary?.total_detected || 0}</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {/* Prediction Scenarios Chart */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)'
        }}>
          <h3 style={{ 
            margin: '0 0 24px', 
            fontSize: '1.15rem', 
            fontWeight: '600', 
            color: '#1f2937', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px' 
          }}>
            <div style={{ 
              width: '5px', 
              height: '28px', 
              background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)', 
              borderRadius: '3px' 
            }} />
            Prediction Scenarios
          </h3>
          <PredictionHorizonsChart predictions={predictions} />
        </div>

        {/* Pattern Distribution Pie */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)'
        }}>
          <h3 style={{ 
            margin: '0 0 24px', 
            fontSize: '1.15rem', 
            fontWeight: '600', 
            color: '#1f2937', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px' 
          }}>
            <div style={{ 
              width: '5px', 
              height: '28px', 
              background: 'linear-gradient(180deg, #10b981, #059669)', 
              borderRadius: '3px' 
            }} />
            Pattern Distribution
          </h3>
          <PatternPieChart patternTypes={patternTypes} />
        </div>

        {/* Technical Indicators Gauge */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)',
          gridColumn: 'span 1'
        }}>
          <h3 style={{ 
            margin: '0 0 24px', 
            fontSize: '1.15rem', 
            fontWeight: '600', 
            color: '#1f2937', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px' 
          }}>
            <div style={{ 
              width: '5px', 
              height: '28px', 
              background: 'linear-gradient(180deg, #f59e0b, #d97706)', 
              borderRadius: '3px' 
            }} />
            Technical Indicators
          </h3>
          <TechnicalGauges rsi={indicators.rsi_14} volatility={indicators.volatility} />
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* AI Report Text */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)',
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
          <h3 style={{ 
            margin: '0 0 20px', 
            fontSize: '1.15rem', 
            fontWeight: '600', 
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <BrainCircuit style={{ width: '22px', height: '22px', color: '#3b82f6' }} />
            AI Report
          </h3>
          <div style={{
            fontSize: '0.95rem',
            lineHeight: '1.8',
            color: '#374151'
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {data.ai_report || 'No AI report generated. Please analyze a stock first.'}
            </ReactMarkdown>
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Quick Stats Card */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.04)'
          }}>
            <h4 style={{ 
              margin: '0 0 18px', 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              ⚡ Quick Stats
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <StatRow label="RSI" value={indicators.rsi_14?.toFixed(0)} unit="" color="#3b82f6" />
              <StatRow label="Volatility" value={indicators.volatility?.toFixed(2)} unit="%" color="#10b981" />
              <StatRow label="Patterns" value={patterns.summary?.total_detected || 0} unit="total" color="#f59e0b" />
              <StatRow label="Bullish" value={patterns.summary?.bullish || 0} unit="patterns" color="#059669" />
              <StatRow label="Bearish" value={patterns.summary?.bearish || 0} unit="patterns" color="#dc2626" />
            </div>
          </div>

          {/* Market Signal Card */}
          <div style={{
            background: signalColor.bg,
            border: `3px solid ${signalColor.border}`,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.04)'
          }}>
            <h4 style={{ 
              margin: '0 0 14px', 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: signalColor.text,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              🎯 Market Signal
            </h4>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: '800',
              color: signalColor.text,
              marginBottom: '10px',
              letterSpacing: '-1px'
            }}>
              {analysis.signal || 'N/A'}
            </div>
            <div style={{
              fontSize: '0.9rem',
              color: signalColor.text,
              opacity: 0.85,
              fontWeight: '500'
            }}>
              Confidence: {analysis.confidence?.toFixed(0)}%
            </div>
          </div>

          {/* Similarity Heatmap */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)'
          }}>
            <h4 style={{ 
              margin: '0 0 18px', 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              🔥 Top Matches
            </h4>
            <SimilarityHeatmap similarity_matches={data.similarity_matches || []} />
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '18px'
      }}>
        <FooterStatBox 
          label="Data Points" 
          value={patterns.all?.length || 0} 
          icon="📊" 
        />
        <FooterStatBox 
          label="Avg Similarity" 
          value={`${analysis.mean_similarity?.toFixed(1)}%`} 
          icon="🎯" 
        />
        <FooterStatBox 
          label="Top Match" 
          value={`${data.similarity_matches?.[0]?.score?.toFixed(1)}%`} 
          icon="⭐" 
        />
        <FooterStatBox 
          label="Confidence" 
          value={`${analysis.confidence?.toFixed(0)}%`} 
          icon="✨" 
        />
      </div>
    </div>
  );
}

// ==============================
// Helper Components for AI Report
// ==============================
function StatRow({ label, value, unit, color }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'baseline',
      padding: '10px 0',
      borderBottom: '1px solid #e5e7eb'
    }}>
      <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' }}>{label}</span>
      <span style={{ fontSize: '1.3rem', fontWeight: '700', color: color }}>
        {value} <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: '500' }}>{unit}</span>
      </span>
    </div>
  );
}

function FooterStatBox({ label, value, icon }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '18px',
      borderRadius: '12px',
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      transition: 'transform 0.2s'
    }}
    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
      <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px', fontWeight: '500' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>{value || '--'}</div>
    </div>
  );
}

// ==============================
// Chart Components for AI Report
// ==============================
function PredictionHorizonsChart({ predictions }) {
  if (!Object.keys(predictions).length) {
    return <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No predictions available</p>;
  }

  const labels = Object.keys(predictions);
  const values = labels.map(k => predictions[k].mean);

  return (
    <Plot
      data={[
        {
          labels: labels,
          values: values.map(Math.abs),
          type: 'pie',
          marker: {
            colors: values.map(v => 
              v >= 0 ? '#10b981' : '#ef4444'
            )
          },
          textinfo: 'label+percent',
          textfont: { size: 12, color: '#ffffff', weight: 600 },
          hovertemplate: '<b>%{label}</b><br>Return: %{value:.2f}%<extra></extra>'
        }
      ]}
      layout={{
        autosize: true,
        height: 280,
        margin: { l: 10, r: 10, t: 10, b: 10 },
        paper_bgcolor: 'transparent',
        showlegend: false
      }}
      config={{ displayModeBar: false, staticPlot: true }}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function PatternPieChart({ patternTypes }) {
  if (!Object.keys(patternTypes).length) {
    return <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No pattern data available</p>;
  }

  const colors = {
    'reversal_bullish': '#10b981',
    'reversal_bearish': '#ef4444',
    'bullish': '#059669',
    'bearish': '#dc2626',
    'neutral': '#f59e0b'
  };

  return (
    <Plot
      data={[
        {
          labels: Object.keys(patternTypes).map(k => k.replace('_', ' ').toUpperCase()),
          values: Object.values(patternTypes),
          type: 'pie',
          marker: {
            colors: Object.keys(patternTypes).map(k => colors[k] || '#9ca3af')
          },
          textinfo: 'label+value',
          textfont: { size: 11, color: '#ffffff', weight: 600 },
          hovertemplate: '<b>%{label}</b><br>Count: %{value}<extra></extra>'
        }
      ]}
      layout={{
        autosize: true,
        height: 280,
        margin: { l: 10, r: 10, t: 10, b: 10 },
        paper_bgcolor: 'transparent',
        showlegend: false
      }}
      config={{ displayModeBar: false, staticPlot: true }}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function TechnicalGauges({ rsi, volatility }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* RSI Gauge */}
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '12px',
          alignItems: 'baseline'
        }}>
          <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '600' }}>RSI (14)</span>
          <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1f2937' }}>
            {rsi?.toFixed(0) || '--'}
          </span>
        </div>
        <div style={{
          height: '12px',
          background: 'linear-gradient(to right, #10b981, #f59e0b, #ef4444)',
          borderRadius: '6px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {rsi && (
            <div style={{
              position: 'absolute',
              left: `${rsi}%`,
              top: '-4px',
              width: '20px',
              height: '20px',
              background: '#1f2937',
              borderRadius: '50%',
              border: '3px solid white',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              transform: 'translateX(-50%)'
            }} />
          )}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '0.75rem',
          color: '#9ca3af',
          fontWeight: '600'
        }}>
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* Volatility Bar */}
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '12px',
          alignItems: 'baseline'
        }}>
          <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '600' }}>Volatility</span>
          <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1f2937' }}>
            {volatility?.toFixed(1) || '--'}%
          </span>
        </div>
        <div style={{
          height: '12px',
          background: '#e5e7eb',
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          {volatility && (
            <div style={{
              width: `${Math.min(volatility * 2, 100)}%`,
              height: '100%',
              background: volatility > 20 ? '#ef4444' : volatility > 10 ? '#f59e0b' : '#10b981',
              borderRadius: '6px',
              transition: 'width 0.3s'
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

function SimilarityHeatmap({ similarity_matches }) {
  if (!similarity_matches || similarity_matches.length === 0) {
    return <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No matches available</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {similarity_matches.slice(0, 5).map((match, idx) => {
        const score = match.score || 0;
        const color = score > 70 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444';
        
        return (
          <div key={idx} style={{
            padding: '12px',
            background: '#f9fafb',
            borderRadius: '10px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
              fontSize: '0.85rem'
            }}>
              <span style={{ color: '#6b7280', fontWeight: '500' }}>
                Match #{idx + 1}
              </span>
              <span style={{ 
                fontWeight: '700', 
                color: color,
                fontSize: '1rem'
              }}>
                {score.toFixed(1)}%
              </span>
            </div>
            <div style={{
              height: '6px',
              background: '#e5e7eb',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${score}%`,
                height: '100%',
                background: color,
                borderRadius: '3px',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
