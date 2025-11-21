// A cleaner, simplified, more modular rewrite of your StockDashboard component
// Focus: clearer structure, reduced visual clutter, better grouping, cleaner JSX
// Note: You will still need to re-integrate API types and your CSS if needed.

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
  TrendingDown,
  Sparkles,
  CheckCircle,
  XCircle,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8000";
import "./analyzer.css";

// NOTE: Next step: apply full Tailwind + shadcn/ui design system and match PatternAI UI
// This placeholder marks where we'll begin integrating shadcn primitives.
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
    BUY: "text-emerald-700 bg-emerald-50 border-emerald-200",
    SELL: "text-rose-700 bg-rose-50 border-rose-200",
    HOLD: "text-amber-700 bg-amber-50 border-amber-200",
    NEUTRAL: "text-slate-700 bg-slate-50 border-slate-200",
  };

  const getSignalColor = (s) => signalColor[s] || signalColor.NEUTRAL;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <Header />

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

      {data && (
        <div className="max-w-7xl mx-auto px-4">
          <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

          {activeTab === "overview" && (
            <OverviewTab data={data} getSignalColor={getSignalColor} />
          )}

          {activeTab === "patterns" && (
            <PatternsTab
              data={data}
              expandedMatch={expandedMatch}
              setExpandedMatch={setExpandedMatch}
            />
          )}

          {activeTab === "predictions" && <PredictionsTab data={data} />}

          {activeTab === "ai-report" && <AiReportTab data={data} />}
        </div>
      )}
    </div>
  );
}

// -------------------------------
// HEADER
// -------------------------------
function Header() {
  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          PatternAI <span className="text-indigo-600">Pro</span>
        </h1>
      </div>
    </div>
  );
}

// -------------------------------
// SEARCH + CONTROLS
// -------------------------------
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
    <div className="bg-white border-b border-slate-200 pt-8 pb-10 mb-8 shadow-sm">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold">Analyze Market Patterns</h2>
          <p className="text-slate-500">AI-driven historical similarity search</p>
        </div>

        <form onSubmit={fetchData} className="space-y-6">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-3 text-slate-400" />
            <input
              className="block w-full pl-12 pr-32 py-4 bg-slate-50 border rounded-2xl text-lg"
              placeholder="AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
            <button
              type="submit"
              disabled={loading || !symbol}
              className="absolute right-2 top-2 h-12 px-6 bg-indigo-600 rounded-xl text-white flex items-center gap-2"
            >
              {loading ? "Scanning..." : "Analyze"}
              {!loading && <Sparkles className="w-4 h-4" />}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto pt-2">
            <Select label="Period" value={period} onChange={setPeriod} options={[
              ["1mo", "1 Month"],
              ["3mo", "3 Months"],
              ["6mo", "6 Months"],
              ["1y", "1 Year"],
              ["2y", "2 Years"],
              ["5y", "5 Years"],
            ]} />

            <NumberInput label="Lookback (Days)" value={lookback} setValue={setLookback} min={5} max={90} />
            <NumberInput label="Matches" value={topN} setValue={setTopN} min={1} max={20} />
          </div>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-3 text-rose-700">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 bg-white border rounded-xl"
      >
        {options.map(([val, txt]) => (
          <option value={val} key={val}>{txt}</option>
        ))}
      </select>
    </div>
  );
}

function NumberInput({ label, value, setValue, min, max }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(parseInt(e.target.value))}
        className="w-full p-3 bg-white border rounded-xl"
      />
    </div>
  );
}

// -------------------------------
// TABS
// -------------------------------
function Tabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "patterns", label: "Matches", icon: Target },
    { id: "predictions", label: "Predictions", icon: BarChart3 },
    { id: "ai-report", label: "AI Report", icon: BrainCircuit },
  ];

  return (
    <div className="flex overflow-x-auto gap-6 border-b border-slate-200 mb-8 pb-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id)}
          className={`flex items-center gap-2 pb-3 px-1 font-semibold ${
            activeTab === t.id ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500"
          }`}
        >
          <t.icon className="w-4 h-4" /> {t.label}
        </button>
      ))}
    </div>
  );
}

// -------------------------------
// OVERVIEW TAB
// -------------------------------
function OverviewTab({ data, getSignalColor }) {
  return (
    <div className="space-y-6 animate-in fade-in">
      <Metrics data={data} getSignalColor={getSignalColor} />
      <MainCharts data={data} />
    </div>
  );
}

function Metrics({ data, getSignalColor }) {
  const d = data.indicators;
  const a = data.analysis;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Price"
        value={`$${d?.current_price?.toFixed(2)}`}
        subValue={`${d?.change_1d >= 0 ? "+" : ""}${d?.change_1d?.toFixed(2)}%`}
        subColor={d?.change_1d >= 0 ? "text-emerald-600" : "text-rose-600"}
      />
      <MetricCard
        label="RSI"
        value={d?.rsi_14?.toFixed(0)}
        subValue={d?.rsi_14 > 70 ? "Overbought" : d?.rsi_14 < 30 ? "Oversold" : "Neutral"}
      />
      <div className={`p-6 rounded-2xl border shadow-sm ${getSignalColor(a?.signal)}`}>
        <div className="text-sm font-semibold opacity-75 mb-1">AI Signal</div>
        <div className="text-3xl font-bold">{a?.signal}</div>
      </div>
      <MetricCard
        label="Pattern Confidence"
        value={`${a?.confidence?.toFixed(0)}%`}
        subValue="Similarity"
        subColor="text-indigo-600"
      />
    </div>
  );
}

function MainCharts({ data }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border shadow-sm">
        <h3 className="text-lg font-bold mb-4">Price Action</h3>
        <div className="h-[400px] border rounded-lg">
          <Plot
            data={{
              x: data.chart?.dates,
              y: data.chart?.prices,
              type: "scatter",
              mode: "lines",
              line: { color: "#4F46E5" },
              fill: "tozeroy",
              fillcolor: "rgba(79,70,229,0.05)",
            }}
            layout={{ autosize: true, margin: { l: 40, r: 20, t: 20, b: 40 } }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
            config={{ displayModeBar: false }}
          />
        </div>
      </div>

      <div className="bg-indigo-50/50 p-6 rounded-2xl border">
        <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> Analysis
        </h3>
        <p className="text-slate-800 mb-6">{data.analysis?.reason}</p>

        <div className="grid grid-cols-2 gap-4">
          <Info label="Volatility" value={`${data.indicators?.volatility?.toFixed(2)}%`} />
          <Info label="Volume Ratio" value={`${data.indicators?.volume_ratio?.toFixed(2)}x`} />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs font-bold text-indigo-400 uppercase mb-1">{label}</div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
    </div>
  );
}

function MetricCard({ label, value, subValue, subColor }) {
  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm">
      <div className="text-sm font-semibold text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value || "--"}</div>
      {subValue && <div className={`text-sm mt-2 font-semibold ${subColor}`}>{subValue}</div>}
    </div>
  );
}

// -------------------------------
// PATTERNS
// -------------------------------
function PatternsTab({ data, expandedMatch, setExpandedMatch }) {
  return (
    <div className="space-y-4">
      {data.matches?.map((m, idx) => (
        <div key={idx} className="bg-white border rounded-2xl shadow-sm">
          <div
            className="p-5 flex items-center justify-between cursor-pointer bg-slate-50"
            onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
                #{m.rank}
              </div>
              <div>
                <div className="font-bold">
                  {m.start_date} → {m.end_date}
                </div>
                <div className="text-sm text-slate-500">Correlation</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold text-emerald-600">{m.score?.toFixed(1)}%</span>
              {expandedMatch === idx ? <ChevronUp /> : <ChevronDown />}
            </div>
          </div>

          {expandedMatch === idx && (
            <div className="p-6 border-t bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-sm uppercase mb-3">Historical Returns</h4>
                  <div className="flex gap-2">
                    {m.future_returns &&
                      Object.entries(m.future_returns).map(([k, v]) => (
                        <div
                          key={k}
                          className={`flex-1 p-3 rounded-xl border text-center ${v >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}
                        >
                          <div className="text-xs font-bold text-slate-500 uppercase">{k}</div>
                          <div className={`font-bold ${v >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {v >= 0 ? "+" : ""}{v.toFixed(2)}%
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {m.ai_insight && (
                  <div className="bg-slate-50 p-4 rounded-xl border text-sm leading-relaxed">
                    <span className="font-bold text-indigo-600 block mb-1">AI Insight:</span>
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

// -------------------------------
// PREDICTIONS
// -------------------------------
function PredictionsTab({ data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {data.predictions &&
        Object.entries(data.predictions).map(([k, v]) => (
          <div key={k} className="bg-white p-6 rounded-2xl border shadow-sm text-center">
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">{k}</div>
            <div className={`text-3xl font-bold mb-2 ${v.mean >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {v.mean >= 0 ? "+" : ""}{v.mean.toFixed(2)}%
            </div>
            <div className="text-xs text-slate-500">
              Range: {v.min.toFixed(1)}% - {v.max.toFixed(1)}%
            </div>
          </div>
        ))}
    </div>
  );
}

// -------------------------------
// AI REPORT
// -------------------------------
function AiReportTab({ data }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 opacity-80" /> AI Analysis Report
        </h2>
        <p className="text-indigo-100 mt-2">Full breakdown from GPT.</p>
      </div>

      <div className="p-8">
        {!data.ai_error ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (p) => <h1 className="text-2xl font-bold mt-6 mb-4" {...p} />,
              p: (p) => <p className="mb-4 text-slate-700 leading-relaxed" {...p} />,
            }}
          >
            {data.ai_report || "No report generated."}
          </ReactMarkdown>
        ) : (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800 flex gap-4">
            <AlertCircle className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-lg mb-1">Analysis Unavailable</h3>
              <p>{data.ai_error}</p>
            </div>
          </div>
        )}

        {data.metadata && (
          <div className="mt-8 pt-8 border-t flex gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              {data.metadata.ai_configured ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-500" />
              )}
              AI Status: {data.metadata.ai_configured ? "Online" : "Offline"}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Generated: {new Date(data.metadata.generated_at).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
