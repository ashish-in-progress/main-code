import React, { useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
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
  Shield
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);
import "./analyzer.css"
const API_BASE_URL = "http://localhost:8000";

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
      const res = await fetch(`${API_BASE_URL}/analyze?symbol=${symbol.toUpperCase()}&period=${period}&lookback=${lookback}&top_n=${topN}`);
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || "Failed to fetch data");
      }
      
      setData(result);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch data. Ensure backend is running.");
    }
    setLoading(false);
  };

  const chartData = {
    labels: data?.chart?.dates || [],
    datasets: [
      {
        label: "Stock Price",
        data: data?.chart?.prices || [],
        borderColor: "#4F46E5",
        backgroundColor: "rgba(79, 70, 229, 0.1)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "#1E293B",
        titleColor: "#fff",
        bodyColor: "#fff",
        padding: 10,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, color: "#94a3b8" },
      },
      y: {
        grid: { color: "#f1f5f9" },
        ticks: { color: "#94a3b8" },
      },
    },
  };

  const getSignalColor = (signal) => {
    const colors = {
      BUY: "text-green-600 bg-green-50",
      SELL: "text-red-600 bg-red-50",
      HOLD: "text-yellow-600 bg-yellow-50",
      NEUTRAL: "text-gray-600 bg-gray-50"
    };
    return colors[signal] || colors.NEUTRAL;
  };

  const getScoreColor = (score) => {
    if (score > 80) return "bg-green-100 text-green-700";
    if (score > 60) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans">
      
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-1.5 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              PatternAI Pro
            </span>
          </div>
          <div className="text-sm text-gray-500 hidden sm:block">
            AI-Powered Technical Analysis & Pattern Recognition
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Search Section */}
        <div className="max-w-3xl mx-auto mb-8">
          <h1 className="text-3xl font-bold mb-3 text-gray-900 text-center">Analyze Market Patterns</h1>
          <p className="text-gray-500 mb-6 text-center">Enter a stock symbol to detect historical similarities and get AI insights.</p>
          
          <form onSubmit={fetchData} className="space-y-4">
            <div className="relative flex items-center">
              <input
                type="text"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-lg"
                placeholder="Enter Symbol (e.g., AAPL, TSLA, TCS.NS)"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
              <Search className="absolute left-4 text-gray-400 w-6 h-6" />
              <button
                type="submit"
                disabled={loading || !symbol}
                className="absolute right-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Scanning..." : "Analyze"}
              </button>
            </div>
            
            {/* Advanced Options */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="1mo">1 Month</option>
                  <option value="3mo">3 Months</option>
                  <option value="6mo">6 Months</option>
                  <option value="1y">1 Year</option>
                  <option value="2y">2 Years</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pattern Length</label>
                <input
                  type="number"
                  min="5"
                  max="90"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={lookback}
                  onChange={(e) => setLookback(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Top Matches</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={topN}
                  onChange={(e) => setTopN(parseInt(e.target.value))}
                />
              </div>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center justify-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {data && (
          <div className="space-y-6">
            
            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
              {["overview", "patterns", "charts"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? "text-indigo-600 border-b-2 border-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Current Price</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${data.indicators?.current_price?.toFixed(2)}
                    </div>
                    <div className={`text-sm mt-1 ${data.indicators?.change_1d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {data.indicators?.change_1d >= 0 ? '+' : ''}{data.indicators?.change_1d?.toFixed(2)}%
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">RSI (14)</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {data.indicators?.rsi_14?.toFixed(0)}
                    </div>
                    <div className="text-sm mt-1 text-gray-500">
                      {data.indicators?.rsi_14 > 70 ? 'Overbought' : data.indicators?.rsi_14 < 30 ? 'Oversold' : 'Neutral'}
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">AI Signal</div>
                    <div className={`text-2xl font-bold ${data.analysis?.signal === 'BUY' ? 'text-green-600' : data.analysis?.signal === 'SELL' ? 'text-red-600' : 'text-gray-600'}`}>
                      {data.analysis?.signal || 'NEUTRAL'}
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">Confidence</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {data.analysis?.confidence?.toFixed(0)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
                      <Activity className="w-5 h-5 text-indigo-500" />
                      Price Action
                    </h2>
                    <div className="h-[350px] w-full">
                      <Line data={chartData} options={chartOptions} />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-4">
                      <BrainCircuit className="w-6 h-6 text-violet-600" />
                      <h2 className="text-xl font-semibold text-gray-900">AI Assessment</h2>
                    </div>
                    
                    <div className="prose prose-sm text-gray-600 space-y-3">
                      <p className="whitespace-pre-line">{data.ai_report || data.report}</p>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Generated via GPT-4 & Pattern Engine
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Patterns Tab */}
            {activeTab === "patterns" && (
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-500" />
                    Historical Pattern Matches Found ({data.matches?.length || 0})
                  </h3>
                  
                  {data.matches && data.matches.length > 0 ? (
                    <div className="space-y-4">
                      {data.matches.map((match, idx) => (
                        <div 
                          key={idx} 
                          className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                        >
                          <div 
                            className="p-4 bg-gray-50 cursor-pointer flex items-center justify-between"
                            onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-lg font-bold text-gray-700">#{idx + 1}</div>
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {match.start_date} to {match.end_date}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Pattern Length: {lookback} days
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(match.score)}`}>
                                {match.score?.toFixed(1)}% Match
                              </span>
                              {expandedMatch === idx ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
                          </div>
                          
                          {expandedMatch === idx && (
                            <div className="p-6 bg-white space-y-6">
                              
                              {/* Stats Grid */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-3 bg-blue-50 rounded-lg">
                                  <div className="text-xs text-gray-600 mb-1">MMPS Score</div>
                                  <div className="text-lg font-bold text-blue-700">{match.mmps?.toFixed(1)}%</div>
                                </div>
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                  <div className="text-xs text-gray-600 mb-1">Shape Match</div>
                                  <div className="text-lg font-bold text-green-700">{match.mmps_components?.shape?.toFixed(1)}%</div>
                                </div>
                                <div className="text-center p-3 bg-purple-50 rounded-lg">
                                  <div className="text-xs text-gray-600 mb-1">Trend Match</div>
                                  <div className="text-lg font-bold text-purple-700">{match.mmps_components?.trend?.toFixed(1)}%</div>
                                </div>
                                <div className="text-center p-3 bg-orange-50 rounded-lg">
                                  <div className="text-xs text-gray-600 mb-1">Structure</div>
                                  <div className="text-lg font-bold text-orange-700">{match.mmps_components?.structure?.toFixed(1)}%</div>
                                </div>
                              </div>

                              {/* Future Returns */}
                              {match.future_returns && (
                                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-4 rounded-xl">
                                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4" />
                                    Historical Subsequent Returns
                                  </h4>
                                  <div className="grid grid-cols-5 gap-3">
                                    {Object.entries(match.future_returns).map(([period, value]) => (
                                      <div key={period} className="text-center">
                                        <div className="text-xs text-gray-600 mb-1">{period}</div>
                                        <div className={`text-lg font-bold ${value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {value >= 0 ? '+' : ''}{value?.toFixed(2)}%
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* AI Insight */}
                              {match.ai_insight && (
                                <div className="bg-white border-2 border-violet-100 p-4 rounded-xl">
                                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <BrainCircuit className="w-4 h-4 text-violet-600" />
                                    AI Pattern Analysis
                                  </h4>
                                  <div className="prose prose-sm text-gray-700 whitespace-pre-line">
                                    {match.ai_insight}
                                  </div>
                                </div>
                              )}

                              {/* Risk Assessment */}
                              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <Shield className="w-4 h-4 text-amber-600" />
                                  Risk Assessment
                                </h4>
                                <p className="text-sm text-gray-700">
                                  This pattern occurred {match.start_date} and showed {match.future_returns?.['5d'] >= 0 ? 'positive' : 'negative'} momentum over the following 5 days. 
                                  Historical patterns are not guarantees of future performance.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No pattern matches found. Try adjusting the pattern length or period.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Charts Tab */}
            {activeTab === "charts" && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Detailed Technical Charts</h3>
                <div className="h-[500px]">
                  <Line data={chartData} options={{...chartOptions, maintainAspectRatio: false}} />
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}