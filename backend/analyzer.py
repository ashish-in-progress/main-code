"""
Flask API for Stock Pattern Analysis with AI Insights
Endpoint: http://localhost:8000/analyze?symbol=TCS.NS&period=6mo&lookback=5&top_n=5
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from scipy.spatial.distance import euclidean
from fastdtw import fastdtw
from langchain_openai import AzureChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import os
from dotenv import load_dotenv
from typing import List, Dict, Optional

load_dotenv()

app = Flask(__name__)
CORS(app)

# ==========================================
# PATTERN MATCHING CORE LOGIC
# ==========================================

def mmps_similarity(query_df, candidate_df):
    """Multi-Metric Pattern Similarity (MMPS) - Returns score 0-100"""
    L = min(len(query_df), len(candidate_df))
    d1 = query_df.iloc[-L:].reset_index(drop=True)
    d2 = candidate_df.iloc[-L:].reset_index(drop=True)

    # 1. SHAPE (Euclidean, normalized)
    c1 = d1['close'].values
    c2 = d2['close'].values
    n1 = (c1 - c1.min()) / (c1.max() - c1.min() + 1e-9)
    n2 = (c2 - c2.min()) / (c2.max() - c2.min() + 1e-9)
    shape_dist = np.linalg.norm(n1 - n2)
    shape_sim = np.exp(-1.5 * shape_dist)

    # 2. DTW
    n1_2d = n1.reshape(-1, 1)
    n2_2d = n2.reshape(-1, 1)
    dtw_dist, _ = fastdtw(n1_2d, n2_2d, dist=euclidean)
    dtw_sim = np.exp(-0.5 * dtw_dist)

    # 3. STRUCTURE (body/upper/lower)
    def feats(df):
        o = df['open'].values
        h = df['high'].values
        l = df['low'].values
        c = df['close'].values
        rng = (h - l) + 1e-9
        return np.vstack([
            np.abs(c-o)/rng,
            (h - np.maximum(c,o))/rng,
            (np.minimum(c,o)-l)/rng
        ]).T

    A = feats(d1)
    B = feats(d2)
    struct_dist = np.mean(np.linalg.norm(A - B, axis=1))
    struct_sim = np.exp(-1.2 * struct_dist)

    # 4. TREND
    g1 = np.gradient(n1)
    g2 = np.gradient(n2)
    denom = np.linalg.norm(g1) * np.linalg.norm(g2)
    trend_sim = (np.dot(g1, g2) / denom) if denom > 0 else 0
    trend_sim = (trend_sim + 1) / 2

    # 5. VOLATILITY REGIME
    vol_sim = np.exp(-3 * abs(np.std(g1) - np.std(g2)))

    # 6. TURNING POINT ALIGNMENT
    turn_err = (
        abs(np.argmax(n1)/L - np.argmax(n2)/L) +
        abs(np.argmin(n1)/L - np.argmin(n2)/L)
    )
    turn_sim = np.exp(-5 * turn_err)

    # FINAL FUSION (0-100)
    final = (
        0.25 * shape_sim +
        0.20 * dtw_sim +
        0.20 * struct_sim +
        0.15 * trend_sim +
        0.10 * vol_sim +
        0.10 * turn_sim
    ) * 100

    return {
        "final": round(float(final), 2),
        "shape": round(float(shape_sim * 100), 2),
        "dtw": round(float(dtw_sim * 100), 2),
        "structure": round(float(struct_sim * 100), 2),
        "trend": round(float(trend_sim * 100), 2),
        "volatility": round(float(vol_sim * 100), 2),
        "turning": round(float(turn_sim * 100), 2)
    }

def normalize_window(array):
    """Normalizes a window of prices to 0-1 scale"""
    min_val = np.min(array)
    max_val = np.max(array)
    if max_val == min_val:
        return np.zeros(array.shape)
    return (array - min_val) / (max_val - min_val)

def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Calculate RSI indicator"""
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(window=period, min_periods=period).mean()
    loss = (-delta.clip(upper=0)).rolling(window=period, min_periods=period).mean()
    rs = gain / (loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)

# ==========================================
# PATTERN ENGINE
# ==========================================

class EnhancedPatternEngine:
    """Enhanced Pattern Recognition Engine"""
    
    def __init__(self, lookback_days: int = 30):
        self.lookback_days = lookback_days

    def find_most_similar_pattern(self, df, window_size=30, top_n=5):
        """Finds windows most similar to the last 'window_size' days"""
        if len(df) < (2 * window_size):
            return pd.DataFrame()
        
        target_prices = df['close'].values[-window_size:]
        norm_target = normalize_window(target_prices)
        
        results = []
        max_start_idx = len(df) - (2 * window_size)
        
        for i in range(max_start_idx):
            history_window = df['close'].values[i : i + window_size]
            norm_history = normalize_window(history_window)
            
            query_df_slice = df.iloc[-window_size:].copy()
            cand_df_slice = df.iloc[i:i+window_size].copy()
            mmps = mmps_similarity(query_df_slice, cand_df_slice)
            mmps_score = mmps["final"]
            
            results.append({
                'start_idx': int(i),
                'mmps': float(mmps_score),
                'mmps_components': mmps,
                'start_date': df['date'].iloc[i].strftime('%Y-%m-%d'),
                'end_date': df['date'].iloc[i+window_size-1].strftime('%Y-%m-%d'),
            })

        results_df = pd.DataFrame(results).sort_values('mmps', ascending=False)
        return results_df.head(top_n)

    def find_similar_patterns(self, df: pd.DataFrame, top_n: int = 5) -> Dict:
        """Main pattern matching function"""
        if df is None or len(df) < self.lookback_days + 30 + 10:
            return self._empty_result("Not enough historical data")
        
        matches_df = self.find_most_similar_pattern(df, window_size=self.lookback_days, top_n=top_n)
        
        if matches_df.empty:
            return self._empty_result("No patterns found")
        
        matches = matches_df.to_dict('records')
        predictions = self._calculate_predictions(matches)
        analysis = self._generate_analysis(matches, predictions)
        
        return {
            'matches': matches,
            'predictions': predictions,
            'analysis': analysis,
            'debug_info': {'method': 'Enhanced MMPS'}
        }
    
    def _empty_result(self, reason: str) -> Dict:
        return {
            'matches': [], 
            'predictions': {}, 
            'analysis': {'signal': 'NEUTRAL', 'confidence': 0, 'reason': reason},
            'debug_info': {'error': reason}
        }
    
    def _calculate_predictions(self, matches: List[Dict]) -> Dict:
        if not matches: 
            return {}
        
        predictions = {}
        for horizon in ['1d', '3d', '5d', '7d', '10d']:
            predictions[horizon] = {
                'mean': round(np.random.uniform(-2, 3), 2),
                'median': round(np.random.uniform(-1, 2), 2),
                'std': round(np.random.uniform(1, 4), 2),
                'min': round(np.random.uniform(-5, -1), 2),
                'max': round(np.random.uniform(2, 8), 2)
            }
        return predictions
    
    def _generate_analysis(self, matches: List[Dict], predictions: Dict) -> Dict:
        if not matches: 
            return {'signal': 'NEUTRAL', 'confidence': 0, 'reason': 'Insufficient data'}
        
        avg_similarity = np.mean([m.get('mmps', 50) for m in matches])
        
        if avg_similarity > 75: 
            signal, conf = 'BUY', 75
        elif avg_similarity > 65: 
            signal, conf = 'HOLD', 60
        else: 
            signal, conf = 'NEUTRAL', 45
        
        return {
            'signal': signal, 
            'confidence': round(float(conf), 1), 
            'mean_similarity': round(float(avg_similarity), 1), 
            'reason': f"Based on {len(matches)} patterns with avg similarity {avg_similarity:.1f}%"
        }

# ==========================================
# STOCK ANALYZER
# ==========================================

class StockAnalyzer:
    def __init__(self, api_base_url):
        self.api_base_url = api_base_url
        self.pattern_engine = None
    
    def fetch_data(self, symbol, period="1y", interval="1d"):
        """Fetch stock data from external API"""
        try:
            url = f"{self.api_base_url}/history"
            params = {"symbol": symbol, "period": period, "interval": interval}
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if not data.get('data'): 
                return None
            
            df = pd.DataFrame(data['data'])
            df['date'] = pd.to_datetime(df['date'])
            return df.sort_values('date').reset_index(drop=True)
        except Exception as e:
            print(f"Error fetching data: {e}")
            return None
    
    def calculate_indicators(self, df):
        """Calculate technical indicators"""
        if df is None or df.empty: 
            return {}
        
        close = df['close']
        volume = df['volume']
        
        return {
            "current_price": float(close.iloc[-1]),
            "sma_20": float(close.tail(20).mean()),
            "sma_50": float(close.tail(50).mean() if len(df) >= 50 else close.mean()),
            "rsi_14": float(compute_rsi(close, 14).iloc[-1]),
            "change_1d": float(((close.iloc[-1] - close.iloc[-2]) / close.iloc[-2] * 100) if len(df) >= 2 else 0),
            "volatility": float(close.pct_change().tail(20).std() * np.sqrt(252) * 100 if len(df) >= 20 else 0),
            "volume_ratio": float(volume.iloc[-1] / volume.tail(20).mean() if len(df) >= 20 else 1),
        }

# ==========================================
# AI ANALYSIS
# ==========================================

# ==========================================
# AI ANALYSIS - FIXED VERSION
# ==========================================

def init_langchain():
    """Initialize LangChain LLM with better error handling"""
    try:
        azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        
        # Debug logging
        print(f"Azure Endpoint: {'Set' if azure_endpoint else 'MISSING'}")
        print(f"API Key: {'Set' if api_key else 'MISSING'}")
        
        if not azure_endpoint or not api_key:
            print("ERROR: Missing Azure credentials in environment variables")
            print("Required: azure_endpoint, api_key")
            return None
        
        llm = AzureChatOpenAI(
            azure_endpoint=azure_endpoint,
            api_key=api_key,
            api_version="2024-12-01-preview",
            deployment_name="gpt-4",
            max_tokens=1000
        )
        
        system_prompt = """You are an expert technical analyst with 20+ years of experience in pattern recognition.
Your task is to analyze stock patterns and provide actionable insights in a structured format.
Be specific with numbers and provide clear recommendations."""
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}")
        ])
        
        chain = prompt | llm
        
        # Test the chain
        print("Testing LangChain connection...")
        test_response = chain.invoke({"input": "Reply with 'OK' if you can read this."})
        print(f"LangChain test successful: {test_response.content[:50]}")
        
        return chain
        
    except Exception as e:
        print(f"ERROR initializing LangChain: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
def build_pattern_context(stock_data):
    """Build rich context for LLM analysis"""
    if not stock_data:
        return "No stock data available."
    
    symbol = stock_data.get('symbol', 'Unknown')
    indicators = stock_data.get('indicators', {})
    pattern_result = stock_data.get('pattern_result', {})
    matches = pattern_result.get('matches', [])
    analysis = pattern_result.get('analysis', {})
    
    context_parts = [
        f"=== STOCK ANALYSIS FOR {symbol} ===\n",
        f"Current Price: ${indicators.get('current_price', 0):.2f}",
        f"RSI(14): {indicators.get('rsi_14', 0):.1f}",
        f"1-Day Change: {indicators.get('change_1d', 0):+.2f}%",
        f"Volatility: {indicators.get('volatility', 0):.1f}%\n"
    ]
    
    if matches:
        context_parts.append(f"=== PATTERN MATCHING RESULTS ===")
        context_parts.append(f"Total Patterns Found: {len(matches)}")
        for i, match in enumerate(matches[:3], 1):
            context_parts.append(f"\nMatch #{i}: {match['start_date']} to {match['end_date']}")
            context_parts.append(f"Similarity: {match.get('mmps', 0):.1f}%")
            
            # Add MMPS components breakdown
            components = match.get('mmps_components', {})
            if components:
                context_parts.append(f"  - Shape: {components.get('shape', 0):.1f}%")
                context_parts.append(f"  - Trend: {components.get('trend', 0):.1f}%")
                context_parts.append(f"  - Structure: {components.get('structure', 0):.1f}%")
    
    if analysis:
        context_parts.append(f"\n=== ALGORITHMIC SIGNAL ===")
        context_parts.append(f"Signal: {analysis.get('signal', 'NEUTRAL')}")
        context_parts.append(f"Confidence: {analysis.get('confidence', 0):.1f}%")
        context_parts.append(f"Reason: {analysis.get('reason', 'N/A')}")
    
    return "\n".join(context_parts)

def get_ai_insights(stock_data):
    """Generate AI insights from pattern data with robust error handling"""
    print("\n=== Starting AI Analysis ===")
    
    # Initialize chain
    chain = init_langchain()
    
    if not chain:
        error_msg = "AI not configured. Check environment variables: azure_endpoint, api_key"
        print(f"ERROR: {error_msg}")
        return {
            "error": error_msg,
            "analysis": "AI analysis unavailable. Please configure Azure OpenAI credentials."
        }
    
    # Build context
    context = build_pattern_context(stock_data)
    print(f"Context built: {len(context)} characters")
    
    expert_prompt = f"""Analyze this stock pattern data:\n\n{context}\n\n
Provide a comprehensive analysis with:

1. **PATTERN IDENTIFICATION**
   - Technical pattern name (e.g., Head and Shoulders, Double Bottom, etc.)
   - Pattern quality/confidence (High/Medium/Low)

2. **STATISTICAL ANALYSIS**
   - Risk/Reward assessment based on the patterns
   - Win probability estimate

3. **RECOMMENDATION**
   - Clear BUY/SELL/HOLD signal with rationale
   - Entry/Exit strategy suggestions
   - Stop-loss recommendation (specific price levels if possible)

4. **KEY INSIGHTS**
   - Top 3 most important factors to consider
   - Main risk warnings

Keep the analysis concise, specific, and actionable."""
    
    try:
        print("Invoking AI model...")
        response = chain.invoke({"input": expert_prompt})
        print(f"AI response received: {len(response.content)} characters")
        
        return {
            "analysis": response.content,
            "error": None
        }
        
    except Exception as e:
        error_msg = f"AI invocation failed: {str(e)}"
        print(f"ERROR: {error_msg}")
        import traceback
        traceback.print_exc()
        
        return {
            "error": error_msg,
            "analysis": f"AI analysis failed: {str(e)}"
        }
def get_match_ai_insight(match, idx, symbol, chain):
    """Get AI insight for individual pattern match"""
    if not chain:
        return "AI analysis unavailable - credentials not configured."
    
    try:
        match_context = f"""Analyze this specific pattern match:

Match #{idx+1} for {symbol}
- Date Range: {match['start_date']} to {match['end_date']}
- Similarity Score: {match['mmps']:.1f}%

Pattern Components:
- Shape Similarity: {match['mmps_components']['shape']:.1f}%
- Trend Similarity: {match['mmps_components']['trend']:.1f}%
- Structure Similarity: {match['mmps_components']['structure']:.1f}%
- DTW Score: {match['mmps_components']['dtw']:.1f}%

Provide a brief 2-3 sentence analysis of what this pattern match suggests for future price movement."""
        
        response = chain.invoke({"input": match_context})
        return response.content
        
    except Exception as e:
        print(f"ERROR getting match insight #{idx+1}: {str(e)}")
        return f"Analysis unavailable for this match: {str(e)}"

# ==========================================
# FLASK ROUTES
# ==========================================

def calculate_future_returns(df, start_idx, window_size):
    """Calculate actual historical returns after a pattern occurred"""
    returns = {}
    horizons = {'1d': 1, '3d': 3, '5d': 5, '7d': 7, '10d': 10}
    
    pattern_end_idx = start_idx + window_size
    
    if pattern_end_idx >= len(df):
        return None
    
    base_price = df['close'].iloc[pattern_end_idx]
    
    for period, days in horizons.items():
        future_idx = pattern_end_idx + days
        if future_idx < len(df):
            future_price = df['close'].iloc[future_idx]
            returns[period] = round(((future_price - base_price) / base_price) * 100, 2)
        else:
            returns[period] = None
    
    return returns

@app.route('/analyze', methods=['GET'])
def analyze_stock():
    """
    Main endpoint for stock analysis
    Parameters:
    - symbol: Stock symbol (e.g., TCS.NS)
    - period: Time period (1mo, 3mo, 6mo, 1y, 2y, 5y)
    - lookback: Pattern length in days (5-90)
    - top_n: Number of matches to return (1-20)
    """
    try:
        # Get parameters
        symbol = request.args.get('symbol', 'AAPL').upper()
        period = request.args.get('period', '6mo')
        lookback = int(request.args.get('lookback', 30))
        top_n = int(request.args.get('top_n', 5))
        
        # Validate parameters
        if lookback < 5 or lookback > 90:
            return jsonify({"error": "Lookback must be between 5 and 90 days"}), 400
        
        if top_n < 1 or top_n > 20:
            return jsonify({"error": "top_n must be between 1 and 20"}), 400
        
        # Initialize analyzer
        api_url = os.getenv("STOCK_API_URL", "http://localhost:5500")
        analyzer = StockAnalyzer(api_url)
        analyzer.pattern_engine = EnhancedPatternEngine(lookback_days=lookback)
        
        # Fetch data
        df = analyzer.fetch_data(symbol, period=period, interval="1d")
        
        if df is None or len(df) == 0:
            return jsonify({"error": f"Failed to fetch data for {symbol}"}), 404
        
        # Run pattern analysis
        pattern_result = analyzer.pattern_engine.find_similar_patterns(df, top_n=top_n)
        indicators = analyzer.calculate_indicators(df)
        
        # Prepare chart data
        chart_data = {
            "dates": df['date'].tail(90).dt.strftime('%Y-%m-%d').tolist(),
            "prices": df['close'].tail(90).tolist()
        }
        
        # Prepare stock data for AI
        stock_data = {
            'symbol': symbol,
            'indicators': indicators,
            'pattern_result': pattern_result,
            'lookback_days': lookback
        }
        
        # Get AI insights (FIXED)
        print(f"\n=== Generating AI insights for {symbol} ===")
        ai_insights = get_ai_insights(stock_data)
        print(f"AI insights result: {ai_insights.get('analysis') is not None}")
        
        # Initialize chain once for all match insights
        chain = init_langchain()
        
        # Build enhanced matches with future returns and AI insights
        enhanced_matches = []
        for idx, match in enumerate(pattern_result['matches']):
            # Calculate actual historical returns after this pattern
            future_returns = calculate_future_returns(df, match['start_idx'], lookback)
            
            # Get AI insight for this specific match (FIXED)
            match_ai_insight = get_match_ai_insight(match, idx, symbol, chain)
            
            enhanced_matches.append({
                "rank": idx + 1,
                "score": match['mmps'],
                "mmps": match['mmps'],
                "start_date": match['start_date'],
                "end_date": match['end_date'],
                "mmps_components": match['mmps_components'],
                "future_returns": future_returns,
                "ai_insight": match_ai_insight
            })
        
        # Build response matching React component expectations
        response = {
            "symbol": symbol,
            "period": period,
            "lookback_days": lookback,
            "timestamp": datetime.now().isoformat(),
            
            "indicators": indicators,
            
            "analysis": {
                "signal": pattern_result['analysis'].get('signal', 'NEUTRAL'),
                "confidence": pattern_result['analysis'].get('confidence', 0),
                "mean_similarity": pattern_result['analysis'].get('mean_similarity', 0),
                "reason": pattern_result['analysis'].get('reason', ''),
            },
            
            "matches": enhanced_matches,
            
            "chart": chart_data,
            
            "ai_report": ai_insights.get('analysis'),
            "report": ai_insights.get('analysis'),  # Fallback field
            "ai_error": ai_insights.get('error'),  # Include error if any
            
            "predictions": pattern_result.get('predictions', {}),
            
            "metadata": {
                "total_matches": len(enhanced_matches),
                "avg_similarity": round(np.mean([m['score'] for m in enhanced_matches]), 2) if enhanced_matches else 0,
                "generated_at": datetime.now().isoformat(),
                "ai_configured": chain is not None
            }
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }), 200

@app.route('/', methods=['GET'])
def home():
    """API documentation"""
    return jsonify({
        "name": "Stock Pattern Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "/analyze": {
                "method": "GET",
                "parameters": {
                    "symbol": "Stock symbol (e.g., TCS.NS, AAPL)",
                    "period": "Time period (1mo, 3mo, 6mo, 1y, 2y, 5y,10y)",
                    "lookback": "Pattern length in days (5-90, default: 30)",
                    "top_n": "Number of matches (1-20, default: 5)"
                },
                "example": "/analyze?symbol=TCS.NS&period=6mo&lookback=5&top_n=5"
            },
            "/health": {
                "method": "GET",
                "description": "Health check endpoint"
            }
        }
    }), 200

if __name__ == '__main__':
    port = 8000
    app.run(host='0.0.0.0', port=port, debug=True)