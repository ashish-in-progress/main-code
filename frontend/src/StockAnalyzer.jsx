// StockDashboard.jsx
// PatternAI Pro – Rich visual dashboard (no Tailwind)

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
            <span className="empty-state-symbol">TCS.NS</span>.
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
            placeholder="Enter ticker (e.g. AAPL, TCS.NS)"
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
// SIDE INSIGHTS (overview)
// ==============================
function SideInsights({ data }) {
  const summary = data.candlestick_patterns?.summary;
  const recent = data.candlestick_patterns?.recent || [];

  return (
    <div className="side-panel">
      <h3 className="side-title">Quick insights</h3>

      <div className="side-section">
        <h4 className="side-section-title">Candlestick patterns</h4>
        {summary ? (
          <ul className="side-list">
            <li>Total: {summary.total_detected}</li>
            <li>Bullish: {summary.bullish}</li>
            <li>Bearish: {summary.bearish}</li>
            <li>Confirmed: {summary.confirmed}</li>
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
            {data.metadata?.avg_similarity != null
              ? `${data.metadata.avg_similarity.toFixed(1)}%`
              : "--"}
          </li>
          <li>Matches: {data.metadata?.total_similarity_matches ?? "--"}</li>
          <li>
            Candle patterns:{" "}
            {data.metadata?.total_candlestick_patterns ?? "--"}
          </li>
        </ul>
      </div>
    </div>
  );
}

// ==============================
// PATTERNS TAB
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
// PREDICTIONS TAB (with sparklines)
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
    <div className="predictions-grid">
      {entries.map(([label, v]) => {
        const x = [0, 1];
        return (
          <div key={label} className="prediction-card">
            <div className="prediction-header-row">
              <div className="prediction-label">{label}</div>
              <div
                className={`prediction-value ${
                  v.mean >= 0 ? "prediction-positive" : "prediction-negative"
                }`}
              >
                {v.mean >= 0 ? "+" : ""}
                {v.mean.toFixed(2)}%
              </div>
            </div>
            <div className="prediction-range">
              Range: {v.min.toFixed(1)}% – {v.max.toFixed(1)}%
            </div>
            <div className="prediction-sparkline">
              <Plot
                data={[
                  {
                    x,
                    y: [v.min, v.max],
                    type: "scatter",
                    mode: "lines",
                    line: { color: "#e5e7eb", width: 0 },
                    fill: "tozeroy",
                    fillcolor: "rgba(37,99,235,0.15)",
                    showlegend: false,
                  },
                  {
                    x,
                    y: [v.mean, v.mean],
                    type: "scatter",
                    mode: "lines",
                    line: {
                      color: v.mean >= 0 ? "#16a34a" : "#dc2626",
                      width: 2,
                    },
                    showlegend: false,
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { l: 0, r: 0, t: 0, b: 0 },
                  xaxis: { visible: false },
                  yaxis: { visible: false },
                  paper_bgcolor: "rgba(0,0,0,0)",
                  plot_bgcolor: "rgba(0,0,0,0)",
                }}
                config={{ displayModeBar: false, staticPlot: true }}
                style={{ width: "100%", height: 80 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==============================
// AI REPORT TAB (with visual summary)
// ==============================
// ==============================
// AI REPORT TAB - MODERN REDESIGN
// ==============================
function AiReportTab({ data }) {
  const metadata = data.metadata || {};
  const predictions = data.predictions || {};
  const analysis = data.analysis || {};
  const indicators = data.indicators || {};
  const patterns = data.candlestick_patterns || {};

  // Pattern type pie chart data
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Section */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #1d4ed8 100%)',
        borderRadius: '16px',
        padding: '32px',
        color: 'white',
        boxShadow: '0 20px 40px rgba(37, 99, 235, 0.25)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '32px',
        alignItems: 'center'
      }}>
        {/* Left: Signal Badge */}
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Signal</div>
          <div style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            marginTop: '8px'
          }}>
            {analysis.signal || 'N/A'}
          </div>
        </div>

        {/* Middle: Description */}
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.8rem', fontWeight: '700' }}>
            AI Analysis Dashboard
          </h2>
          <p style={{ margin: '0 0 16px', opacity: 0.95, fontSize: '0.95rem', lineHeight: '1.6' }}>
            {analysis.reason || 'Comprehensive AI-powered market analysis with pattern recognition and forecasting'}
          </p>
          <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem' }}>
            <div>
              <div style={{ opacity: 0.7 }}>Confidence</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '700' }}>
                {analysis.confidence?.toFixed(0)}%
              </div>
            </div>
            <div>
              <div style={{ opacity: 0.7 }}>Avg Similarity</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '700' }}>
                {metadata.avg_similarity?.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Right: Stats */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          textAlign: 'right'
        }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px 20px', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Matches Found</div>
            <div style={{ fontSize: '2rem', fontWeight: '700' }}>{metadata.total_similarity_matches || 0}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px 20px', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Patterns</div>
            <div style={{ fontSize: '2rem', fontWeight: '700' }}>{patterns.summary?.total_detected || 0}</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {/* Prediction Scenarios Chart */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)'
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '4px', height: '24px', background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)', borderRadius: '2px' }} />
            Prediction Scenarios
          </h3>
          <PredictionHorizonsChart predictions={predictions} />
        </div>

        {/* Pattern Distribution Pie */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)'
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '4px', height: '24px', background: 'linear-gradient(180deg, #10b981, #059669)', borderRadius: '2px' }} />
            Pattern Distribution
          </h3>
          <PatternPieChart patternTypes={patternTypes} />
        </div>

        {/* Technical Indicators Gauge */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)',
          gridColumn: 'span 1'
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '4px', height: '24px', background: 'linear-gradient(180deg, #f59e0b, #d97706)', borderRadius: '2px' }} />
            Technical Indicators
          </h3>
          <TechnicalGauges rsi={indicators.rsi_14} volatility={indicators.volatility} />
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* AI Report Text */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)',
          maxHeight: '500px',
          overflowY: 'auto'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>
            📋 AI Report
          </h3>
          <div style={{
            fontSize: '0.9rem',
            lineHeight: '1.7',
            color: '#374151'
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {data.ai_report || 'No AI report generated. Please analyze a stock first.'}
            </ReactMarkdown>
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick Stats Card */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.04)'
          }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>
              ⚡ Quick Stats
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            border: `2px solid ${signalColor.border}`,
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.04)'
          }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: '600', color: signalColor.text }}>
              🎯 Market Signal
            </h4>
            <div style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: signalColor.text,
              marginBottom: '8px'
            }}>
              {analysis.signal || 'N/A'}
            </div>
            <div style={{
              fontSize: '0.85rem',
              color: signalColor.text,
              opacity: 0.8
            }}>
              Confidence: {analysis.confidence?.toFixed(0)}%
            </div>
          </div>

          {/* Similarity Heatmap */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)'
          }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>
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
        borderRadius: '14px',
        padding: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px'
      }}>
        <FooterStatBox label="Data Points" value={metadata.total_candlestick_patterns} icon="📊" />
        <FooterStatBox label="Avg Similarity" value={`${metadata.avg_similarity?.toFixed(1)}%`} icon="🎯" />
        <FooterStatBox label="Top Match" value={`${data.similarity_matches?.[0]?.score?.toFixed(1)}%`} icon="⭐" />
        <FooterStatBox label="Confidence" value={`${analysis.confidence?.toFixed(0)}%`} icon="✨" />
      </div>
    </div>
  );
}

// ==============================
// Helper Components
// ==============================

function StatRow({ label, value, unit, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '1.2rem', fontWeight: '700', color: color }}>
        {value} <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{unit}</span>
      </span>
    </div>
  );
}

function FooterStatBox({ label, value, icon }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '12px',
      borderRadius: '10px',
      background: '#ffffff',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#1f2937' }}>{value || '--'}</div>
    </div>
  );
}

// ==============================
// Chart Components
// ==============================

function PredictionHorizonsChart({ predictions }) {
  if (!Object.keys(predictions).length) {
    return <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>No predictions available</p>;
  }

  const labels = Object.keys(predictions);
  const means = labels.map(k => predictions[k].mean || 0);
  const colors = means.map(m => m >= 0 ? '#10b981' : '#ef4444');

  return (
    <Plot
      data={[
        {
          x: labels,
          y: means,
          type: 'bar',
          marker: {
            color: colors,
            line: { color: colors.map(c => c === '#10b981' ? '#059669' : '#991b1b'), width: 2 }
          },
          text: means.map(m => `${m >= 0 ? '+' : ''}${m.toFixed(2)}%`),
          textposition: 'outside',
          hovertemplate: '%{x}<br>Return: %{y:.2f}%<extra></extra>'
        }
      ]}
      layout={{
        autosize: true,
        margin: { t: 20, b: 40, l: 50, r: 20 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { family: 'system-ui', color: '#6b7280' },
        xaxis: {
          title: 'Time Horizon',
          tickfont: { color: '#6b7280', size: 11 },
          showgrid: false,
          zeroline: false
        },
        yaxis: {
          title: 'Expected Return %',
          tickfont: { color: '#6b7280', size: 11 },
          gridcolor: '#e5e7eb',
          zeroline: true,
          zerolinecolor: '#d1d5db',
          zerolinewidth: 1
        },
        height: 280
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function PatternPieChart({ patternTypes }) {
  const labels = Object.keys(patternTypes);
  const values = labels.map(k => patternTypes[k]);

  if (!labels.length) {
    return <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>No patterns detected</p>;
  }

  const colorMap = {
    'bullish': '#10b981',
    'bearish': '#ef4444',
    'reversal_bullish': '#34d399',
    'reversal_bearish': '#f87171',
    'neutral': '#f59e0b'
  };

  const colors = labels.map(l => colorMap[l] || '#94a3af');

  return (
    <Plot
      data={[
        {
          labels,
          values,
          type: 'pie',
          hole: 0.5,
          marker: { colors, line: { color: '#ffffff', width: 2 } },
          textinfo: 'label+percent',
          textposition: 'inside',
          textfont: { size: 12, color: '#ffffff' },
          hovertemplate: '%{label}<br>Count: %{value}<br>%{percent}<extra></extra>'
        }
      ]}
      layout={{
        autosize: true,
        margin: { t: 20, b: 20, l: 20, r: 20 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { family: 'system-ui', color: '#6b7280' },
        showlegend: true,
        legend: { x: -0.1, y: -0.15, orientation: 'h', font: { size: 11 } },
        height: 280
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function TechnicalGauges({ rsi, volatility }) {
  const gauges = [
    {
      label: 'RSI (14)',
      value: rsi || 50,
      max: 100,
      minGood: 30,
      maxGood: 70,
      unit: '',
      getColor: (v) => v > 70 ? '#ef4444' : v < 30 ? '#10b981' : '#f59e0b'
    },
    {
      label: 'Volatility',
      value: volatility || 15,
      max: 50,
      minGood: 10,
      maxGood: 20,
      unit: '%',
      getColor: (v) => v > 20 ? '#ef4444' : v < 10 ? '#10b981' : '#2563eb'
    }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px'
    }}>
      {gauges.map((gauge, i) => {
        const percent = Math.min((gauge.value / gauge.max) * 100, 100);
        const color = gauge.getColor(gauge.value);

        return (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '12px', fontWeight: '500' }}>
              {gauge.label}
            </div>
            <div style={{
              position: 'relative',
              width: '100px',
              height: '100px',
              margin: '0 auto',
              background: 'conic-gradient(from 0deg, #e5e7eb 0deg, #d1d5db 360deg)',
              borderRadius: '50%',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                background: `conic-gradient(from 0deg, ${color} 0deg, ${color} ${percent * 3.6}deg, #e5e7eb ${percent * 3.6}deg)`,
                borderRadius: '50%'
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                border: `2px solid ${color}`
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color }}>{gauge.value.toFixed(0)}</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{gauge.unit}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SimilarityHeatmap({ similarity_matches }) {
  if (!similarity_matches?.length) {
    return <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>No matches found</p>;
  }

  const topMatches = similarity_matches.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {topMatches.map((match, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #f3f4f6'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: '700'
          }}>
            #{i + 1}
          </div>
          <div style={{ flex: 1, fontSize: '0.8rem' }}>
            <div style={{ color: '#1f2937', fontWeight: '500' }}>{match.start_date}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Similarity match</div>
          </div>
          <div style={{
            fontSize: '1.1rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {match.score?.toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ==============================
// CANDLESTICK STRIP
// ==============================
function CandlestickStrip({ data }) {
  const summary = data.candlestick_patterns?.summary;
  const recent = data.candlestick_patterns?.recent || [];

  if (!summary && recent.length === 0) return null;

  return (
    <div className="candle-strip">
      {summary && (
        <div className="candle-summary">
          <span>Total: {summary.total_detected}</span>
          <span>Bullish: {summary.bullish}</span>
          <span>Bearish: {summary.bearish}</span>
          <span>Confirmed: {summary.confirmed}</span>
        </div>
      )}

      {recent.length > 0 && (
        <div className="candle-chips">
          {recent.slice(0, 5).map((p) => (
            <div
              key={p.date + p.name}
              className={`candle-chip candle-chip-${p.type}`}
              title={p.description}
            >
              <span className="candle-name">{p.name}</span>
              <span className="candle-date">{p.date}</span>
              <span className="candle-conf">{p.confidence}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
