// StockDashboard.jsx
// PatternAI Pro – Light theme, embeddable dashboard (no Tailwind)

import React, { useState } from "react";
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
} from "lucide-react";

import "./analyzer.css";

const API_BASE_URL = "http://localhost:8000";

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
      {/* Top header / brand bar */}
      <Header />

      <div className="dashboard-section-stack">
        {/* Search + controls in a hero-style card */}
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
              <Card
                title="Market overview"
                subtitle="Key indicators and price action"
              >
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
            <span className="empty-state-symbol">TSLA</span>, or{" "}
            <span className="empty-state-symbol">MSFT</span>.
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
        {/* Search bar */}
        <div className="search-input-wrapper">
          <Search className="search-input-icon" />
          <input
            className="search-input"
            placeholder="Enter ticker (e.g. AAPL)"
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

        {/* Controls */}
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
              ["10y","10 years"]
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
      <Metrics data={data} getSignalColor={getSignalColor} />
      <MainCharts data={data} />
    </div>
  );
}

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
  if (!symbol) return "$"; // default

  symbol = symbol.toUpperCase();

  if (symbol.endsWith(".NS") || symbol.endsWith(".BO")) {
    return "₹"; // NSE/BSE use INR
  }
  return "$"; // everything else USD
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

function MainCharts({ data }) {
  const [history, setHistory] = React.useState([]);

React.useEffect(() => {
  async function loadHistory() {
    try {
      console.log("hi",data.symbol)
      const res = await fetch(
        `http://localhost:5500/history?symbol=${data.symbol}&period=${period}&interval=${lookback}`
      );
      const json = await res.json();
      console.log("hi",json)

      if (json?.data) {
        setHistory(json.data);
      }
    } catch (e) {
      console.error("History fetch failed", e);
    }
  }

  loadHistory();
}, [data]);
// const dates = history.map((d) => d.date);
// const prices = history.map((d) => d.close);
history.sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="charts-grid">
      <div className="chart-main">
        <h3 className="chart-title">Price action</h3>
        <div className="chart-plot-wrapper">

          <Plot
  data={[
    {
      x: history.map((d) => d.date),
      open: history.map((d) => d.open),
      high: history.map((d) => d.high),
      low: history.map((d) => d.low),
      close: history.map((d) => d.close),
      increasing: { line: { color: "#10B981" } }, // green
  decreasing: { line: { color: "#EF4444" } }, // red
      type: "candlestick",
    },
  ]}
  layout={{
    autosize: true,
    margin: { l: 40, r: 20, t: 20, b: 40 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    xaxis: {
      tickfont: { color: "#6B7280" },
      gridcolor: "#E5E7EB",
      type: "date",
    },
    yaxis: {
      tickfont: { color: "#6B7280" },
      gridcolor: "#E5E7EB",
    },
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
          <Info
            label="Volatility"
            value={
              data.indicators?.volatility != null
                ? `${data.indicators.volatility.toFixed(2)}%`
                : "--"
            }
          />
          <Info
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

function Info({ label, value }) {
  return (
    <div className="info-block">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );
}

// ==============================
// PATTERNS TAB
// ==============================
function PatternsTab({ data, expandedMatch, setExpandedMatch }) {
  if (!data.matches || data.matches.length === 0) {
    return (
      <p className="text-muted">
        No pattern matches found for this configuration.
      </p>
    );
  }

  return (
    <div className="patterns-list">
      {data.matches.map((m, idx) => (
        <div key={idx} className="pattern-card">
          <button
            type="button"
            className="pattern-header"
            onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
          >
            <div className="pattern-header-left">
              <div className="pattern-rank">
                #{m.rank ?? idx + 1}
              </div>
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
                <span className="pattern-score">
                  {m.score.toFixed(1)}%
                </span>
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
                            v >= 0 ? "future-return-positive" : "future-return-negative"
                          }`}
                        >
                          <div className="future-return-label">
                            {k}
                          </div>
                          <div className="future-return-value">
                            {v >= 0 ? "+" : ""}
                            {v.toFixed(2)}%
                          </div>
                        </div>
                      ))}
                  </div>
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
// PREDICTIONS TAB
// ==============================
function PredictionsTab({ data }) {
  if (!data.predictions) {
    return (
      <p className="text-muted">
        No prediction scenarios available for this configuration.
      </p>
    );
  }

  return (
    <div className="predictions-grid">
      {Object.entries(data.predictions).map(([k, v]) => (
        <div key={k} className="prediction-card">
          <div className="prediction-label">{k}</div>
          <div
            className={`prediction-value ${
              v.mean >= 0 ? "prediction-positive" : "prediction-negative"
            }`}
          >
            {v.mean >= 0 ? "+" : ""}
            {v.mean.toFixed(2)}%
          </div>
          <div className="prediction-range">
            Range: {v.min.toFixed(1)}% – {v.max.toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ==============================
// AI REPORT TAB
// ==============================
function AiReportTab({ data }) {
  const metadata = data.metadata || {};

  return (
    <div className="ai-report">
      <div className="ai-report-hero">
        <h2 className="ai-report-title">
          <BrainCircuit className="icon-lg icon-inverse" /> AI analysis report
        </h2>
        <p className="ai-report-subtitle">
          Narrative-style explanation of pattern matches, risk, and likely outcomes.
        </p>
      </div>

      <div className="ai-report-body">
        {!data.ai_error ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (p) => <h1 className="ai-markdown-h1" {...p} />,
              h2: (p) => <h2 className="ai-markdown-h2" {...p} />,
              p: (p) => <p className="ai-markdown-p" {...p} />,
              li: (p) => <li className="ai-markdown-li" {...p} />,
            }}
          >
            {data.ai_report || "No report generated."}
          </ReactMarkdown>
        ) : (
          <div className="ai-error-banner">
            <AlertCircle className="icon-sm" />
            <div>
              <h3 className="ai-error-title">Analysis unavailable</h3>
              <p className="ai-error-text">{data.ai_error}</p>
            </div>
          </div>
        )}

        {metadata && (
          <div className="ai-report-footer">
            <div className="ai-status">
              {metadata.ai_configured ? (
                <CheckCircle className="icon-xs icon-positive" />
              ) : (
                <XCircle className="icon-xs icon-negative" />
              )}
              <span>
                AI status:{" "}
                {metadata.ai_configured
                  ? "Online and configured"
                  : "Offline / not configured"}
              </span>
            </div>
            {metadata.generated_at && (
              <div className="ai-generated-at">
                <Clock className="icon-xs" />
                <span>
                  Generated:{" "}
                  {new Date(metadata.generated_at).toLocaleString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
