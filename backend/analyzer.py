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
# ==========================================
# CANDLESTICK PATTERN DEFINITIONS
# ==========================================
def convert_to_json_serializable(obj):
    """Recursively convert numpy types to native Python types"""
    import numpy as np
    
    if isinstance(obj, dict):
        return {k: convert_to_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    else:
        return obj
class PatternType:
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    REVERSAL_BULLISH = "reversal_bullish"
    REVERSAL_BEARISH = "reversal_bearish"

class CandlestickPatternDetector:
    """Detects classical candlestick patterns"""
    
    def __init__(self):
        self.min_body_ratio = 0.1
        self.doji_threshold = 0.05
        self.long_shadow_ratio = 2.0
        self.engulfing_threshold = 0.9
    def _detect_single_patterns(self, df, i) -> List[Dict]:
        """Detect single candlestick patterns"""
        patterns = []
        row = df.iloc[i]
        metrics = self._get_candle_metrics(row)
        date = row['date'].strftime('%Y-%m-%d')
        
        # 1. DOJI - Small body, indecision
        if metrics['body_ratio'] < self.doji_threshold:
            patterns.append({
                'name': 'Doji',
                'type': PatternType.NEUTRAL,
                'confidence': 75,
                'date': date,
                'index': i,
                'description': 'Market indecision - potential reversal point',
                'reliability': 'Medium',
                'confirmation': False,
                'components': {'price': metrics['close']}
            })
        
        # 2. HAMMER - Long lower shadow, small body at top (bullish reversal)
        if (metrics['lower_shadow'] > metrics['body'] * self.long_shadow_ratio and
            metrics['upper_shadow'] < metrics['body'] * 0.3 and
            metrics['body_ratio'] > self.min_body_ratio):
            
            patterns.append({
                'name': 'Hammer',
                'type': PatternType.REVERSAL_BULLISH,
                'confidence': 80,
                'date': date,
                'index': i,
                'description': 'Bullish reversal - buyers rejected lower prices',
                'reliability': 'High',
                'confirmation': False,
                'components': {'price': metrics['close'], 'low': metrics['low']}
            })
        
        # 3. SHOOTING STAR - Long upper shadow, small body at bottom (bearish reversal)
        if (metrics['upper_shadow'] > metrics['body'] * self.long_shadow_ratio and
            metrics['lower_shadow'] < metrics['body'] * 0.3 and
            metrics['body_ratio'] > self.min_body_ratio):
            
            patterns.append({
                'name': 'Shooting Star',
                'type': PatternType.REVERSAL_BEARISH,
                'confidence': 80,
                'date': date,
                'index': i,
                'description': 'Bearish reversal - sellers rejected higher prices',
                'reliability': 'High',
                'confirmation': False,
                'components': {'price': metrics['close'], 'high': metrics['high']}
            })
        
        # 4. SPINNING TOP - Small body, long shadows both sides
        if (metrics['body_ratio'] < 0.3 and
            metrics['upper_shadow'] > metrics['body'] and
            metrics['lower_shadow'] > metrics['body']):
            
            patterns.append({
                'name': 'Spinning Top',
                'type': PatternType.NEUTRAL,
                'confidence': 65,
                'date': date,
                'index': i,
                'description': 'Indecision - balance between buyers and sellers',
                'reliability': 'Low',
                'confirmation': False,
                'components': {'price': metrics['close']}
            })
        
        return patterns    
    def detect_all_patterns(self, df: pd.DataFrame) -> List[Dict]:
        """Scan entire dataframe for all patterns"""
        all_patterns = []
        
        for i in range(2, len(df)):
            # Single candle patterns
            all_patterns.extend(self._detect_single_patterns(df, i))
            
            # Two candle patterns (need previous candle)
            if i >= 1:
                all_patterns.extend(self._detect_two_candle_patterns(df, i))
            
            # Three candle patterns (need 2 previous candles)
            if i >= 2:
                all_patterns.extend(self._detect_three_candle_patterns(df, i))
        
        return all_patterns
    
    def _get_candle_metrics(self, row):
        """Calculate candlestick metrics"""
        o, h, l, c = row['open'], row['high'], row['low'], row['close']
        
        body = abs(c - o)
        total_range = h - l
        upper_shadow = h - max(c, o)
        lower_shadow = min(c, o) - l
        
        is_bullish = bool(c > o)  # ← Convert to native Python bool
        
        return {
            'open': float(o), 
            'high': float(h), 
            'low': float(l), 
            'close': float(c),
            'body': float(body),
            'range': float(total_range),
            'upper_shadow': float(upper_shadow),
            'lower_shadow': float(lower_shadow),
            'is_bullish': is_bullish,
            'body_ratio': float(body / (total_range + 1e-9))
        }
    def _detect_two_candle_patterns(self, df, i) -> List[Dict]:
        """Detect two-candle patterns"""
        patterns = []
        
        prev_row = df.iloc[i-1]
        curr_row = df.iloc[i]
        
        prev_metrics = self._get_candle_metrics(prev_row)
        curr_metrics = self._get_candle_metrics(curr_row)
        
        date = curr_row['date'].strftime('%Y-%m-%d')
        
        # 1. BULLISH ENGULFING - Large bullish candle engulfs previous bearish
        if (not prev_metrics['is_bullish'] and curr_metrics['is_bullish'] and
            curr_metrics['open'] <= prev_metrics['close'] and
            curr_metrics['close'] >= prev_metrics['open'] and
            curr_metrics['body'] > prev_metrics['body'] * self.engulfing_threshold):
            
            patterns.append({
                'name': 'Bullish Engulfing',
                'type': PatternType.REVERSAL_BULLISH,
                'confidence': 85,
                'date': date,
                'index': i,
                'description': 'Strong bullish reversal - buyers overwhelm sellers',
                'reliability': 'High',
                'confirmation': False,
                'components': {
                    'prev_close': prev_metrics['close'],
                    'curr_close': curr_metrics['close']
                }
            })
        
        # 2. BEARISH ENGULFING - Large bearish candle engulfs previous bullish
        if (prev_metrics['is_bullish'] and not curr_metrics['is_bullish'] and
            curr_metrics['open'] >= prev_metrics['close'] and
            curr_metrics['close'] <= prev_metrics['open'] and
            curr_metrics['body'] > prev_metrics['body'] * self.engulfing_threshold):
            
            patterns.append({
                'name': 'Bearish Engulfing',
                'type': PatternType.REVERSAL_BEARISH,
                'confidence': 85,
                'date': date,
                'index': i,
                'description': 'Strong bearish reversal - sellers overwhelm buyers',
                'reliability': 'High',
                'confirmation': False,
                'components': {
                    'prev_close': prev_metrics['close'],
                    'curr_close': curr_metrics['close']
                }
            })
        
        # 3. BULLISH HARAMI - Small bullish candle within previous large bearish
        if (not prev_metrics['is_bullish'] and curr_metrics['is_bullish'] and
            curr_metrics['open'] >= prev_metrics['close'] and
            curr_metrics['close'] <= prev_metrics['open'] and
            curr_metrics['body'] < prev_metrics['body'] * 0.5):
            
            patterns.append({
                'name': 'Bullish Harami',
                'type': PatternType.REVERSAL_BULLISH,
                'confidence': 70,
                'date': date,
                'index': i,
                'description': 'Potential bullish reversal - selling pressure weakening',
                'reliability': 'Medium',
                'confirmation': False,
                'components': {
                    'prev_close': prev_metrics['close'],
                    'curr_close': curr_metrics['close']
                }
            })
        
        # 4. BEARISH HARAMI - Small bearish candle within previous large bullish
        if (prev_metrics['is_bullish'] and not curr_metrics['is_bullish'] and
            curr_metrics['open'] <= prev_metrics['close'] and
            curr_metrics['close'] >= prev_metrics['open'] and
            curr_metrics['body'] < prev_metrics['body'] * 0.5):
            
            patterns.append({
                'name': 'Bearish Harami',
                'type': PatternType.REVERSAL_BEARISH,
                'confidence': 70,
                'date': date,
                'index': i,
                'description': 'Potential bearish reversal - buying pressure weakening',
                'reliability': 'Medium',
                'confirmation': False,
                'components': {
                    'prev_close': prev_metrics['close'],
                    'curr_close': curr_metrics['close']
                }
            })
        
        # 5. PIERCING LINE - Bullish reversal at downtrend bottom
        if (not prev_metrics['is_bullish'] and curr_metrics['is_bullish'] and
            curr_metrics['open'] < prev_metrics['low'] and
            curr_metrics['close'] > (prev_metrics['open'] + prev_metrics['close']) / 2 and
            curr_metrics['close'] < prev_metrics['open']):
            
            patterns.append({
                'name': 'Piercing Line',
                'type': PatternType.REVERSAL_BULLISH,
                'confidence': 75,
                'date': date,
                'index': i,
                'description': 'Bullish reversal - strong buying after gap down',
                'reliability': 'Medium',
                'confirmation': False,
                'components': {
                    'prev_close': prev_metrics['close'],
                    'curr_close': curr_metrics['close']
                }
            })
        
        # 6. DARK CLOUD COVER - Bearish reversal at uptrend top
        if (prev_metrics['is_bullish'] and not curr_metrics['is_bullish'] and
            curr_metrics['open'] > prev_metrics['high'] and
            curr_metrics['close'] < (prev_metrics['open'] + prev_metrics['close']) / 2 and
            curr_metrics['close'] > prev_metrics['open']):
            
            patterns.append({
                'name': 'Dark Cloud Cover',
                'type': PatternType.REVERSAL_BEARISH,
                'confidence': 75,
                'date': date,
                'index': i,
                'description': 'Bearish reversal - strong selling after gap up',
                'reliability': 'Medium',
                'confirmation': False,
                'components': {
                    'prev_close': prev_metrics['close'],
                    'curr_close': curr_metrics['close']
                }
            })
        
        return patterns
    def convert_to_json_serializable(obj):
        """Recursively convert numpy types to native Python types"""
        import numpy as np
        
        if isinstance(obj, dict):
            return {k: convert_to_json_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_to_json_serializable(item) for item in obj]
        elif isinstance(obj, np.bool_):
            return bool(obj)
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        else:
            return obj
    def _detect_three_candle_patterns(self, df, i) -> List[Dict]:
        """Detect three-candle patterns"""
        patterns = []
        
        c1 = self._get_candle_metrics(df.iloc[i-2])
        c2 = self._get_candle_metrics(df.iloc[i-1])
        c3 = self._get_candle_metrics(df.iloc[i])
        
        date = df.iloc[i]['date'].strftime('%Y-%m-%d')
        
        # 1. MORNING STAR - Bullish reversal (bearish, doji/small, bullish)
        if (not c1['is_bullish'] and 
            c2['body_ratio'] < 0.3 and
            c3['is_bullish'] and
            c3['close'] > (c1['open'] + c1['close']) / 2):
            
            patterns.append({
                'name': 'Morning Star',
                'type': PatternType.REVERSAL_BULLISH,
                'confidence': 90,
                'date': date,
                'index': i,
                'description': 'Strong bullish reversal - trend change confirmed',
                'reliability': 'High',
                'confirmation': True,
                'components': {
                    'c1_close': c1['close'],
                    'c2_close': c2['close'],
                    'c3_close': c3['close']
                }
            })
        
        # 2. EVENING STAR - Bearish reversal (bullish, doji/small, bearish)
        if (c1['is_bullish'] and 
            c2['body_ratio'] < 0.3 and
            not c3['is_bullish'] and
            c3['close'] < (c1['open'] + c1['close']) / 2):
            
            patterns.append({
                'name': 'Evening Star',
                'type': PatternType.REVERSAL_BEARISH,
                'confidence': 90,
                'date': date,
                'index': i,
                'description': 'Strong bearish reversal - trend change confirmed',
                'reliability': 'High',
                'confirmation': True,
                'components': {
                    'c1_close': c1['close'],
                    'c2_close': c2['close'],
                    'c3_close': c3['close']
                }
            })
        
        # 3. THREE WHITE SOLDIERS - Bullish continuation (3 consecutive bullish)
        if (c1['is_bullish'] and c2['is_bullish'] and c3['is_bullish'] and
            c2['close'] > c1['close'] and c3['close'] > c2['close'] and
            c1['body_ratio'] > 0.5 and c2['body_ratio'] > 0.5 and c3['body_ratio'] > 0.5):
            
            patterns.append({
                'name': 'Three White Soldiers',
                'type': PatternType.BULLISH,
                'confidence': 85,
                'date': date,
                'index': i,
                'description': 'Strong bullish momentum - sustained buying pressure',
                'reliability': 'High',
                'confirmation': True,
                'components': {
                    'c1_close': c1['close'],
                    'c2_close': c2['close'],
                    'c3_close': c3['close']
                }
            })
        
        # 4. THREE BLACK CROWS - Bearish continuation (3 consecutive bearish)
        if (not c1['is_bullish'] and not c2['is_bullish'] and not c3['is_bullish'] and
            c2['close'] < c1['close'] and c3['close'] < c2['close'] and
            c1['body_ratio'] > 0.5 and c2['body_ratio'] > 0.5 and c3['body_ratio'] > 0.5):
            
            patterns.append({
                'name': 'Three Black Crows',
                'type': PatternType.BEARISH,
                'confidence': 85,
                'date': date,
                'index': i,
                'description': 'Strong bearish momentum - sustained selling pressure',
                'reliability': 'High',
                'confirmation': True,
                'components': {
                    'c1_close': c1['close'],
                    'c2_close': c2['close'],
                    'c3_close': c3['close']
                }
            })
        
        return patterns
class PatternValidator:
    """Validates candlestick patterns with volume and trend context"""
    
    def __init__(self):
        self.trend_period = 20  # Days to determine trend
        self.volume_period = 20  # Days for average volume
    
    def validate_patterns(self, patterns: List[Dict], df: pd.DataFrame) -> List[Dict]:
        """Add confirmation signals to detected patterns"""
        validated = []
        
        for pattern in patterns:
            idx = pattern['index']
            
            # Skip if not enough historical data
            if idx < self.trend_period:
                validated.append(pattern)
                continue
            
            # Get trend context
            trend = self._get_trend(df, idx)
            
            # Get volume confirmation
            volume_confirmed = self._check_volume(df, idx)
            
            # Add validation data
            pattern['trend_context'] = trend
            pattern['volume_confirmed'] = volume_confirmed
            
            # Update confirmation status
            if volume_confirmed and self._is_trend_appropriate(pattern, trend):
                pattern['confirmation'] = True
                pattern['confidence'] = min(pattern['confidence'] + 10, 100)
            
            validated.append(pattern)
        
        return validated
    
    def _get_trend(self, df: pd.DataFrame, idx: int) -> str:
        """Determine if we're in uptrend, downtrend, or sideways"""
        if idx < self.trend_period:
            return "unknown"
        
        recent_closes = df['close'].iloc[idx - self.trend_period:idx].values
        sma = np.mean(recent_closes)
        current_price = df['close'].iloc[idx]
        
        # Calculate trend strength
        slope = np.polyfit(range(len(recent_closes)), recent_closes, 1)[0]
        
        if slope > 0 and current_price > sma * 1.02:
            return "uptrend"
        elif slope < 0 and current_price < sma * 0.98:
            return "downtrend"
        else:
            return "sideways"
    
    def _check_volume(self, df: pd.DataFrame, idx: int) -> bool:
        """Check if volume confirms the pattern"""
        if idx < self.volume_period or 'volume' not in df.columns:
            return False
        
        current_volume = df['volume'].iloc[idx]
        avg_volume = df['volume'].iloc[idx - self.volume_period:idx].mean()
        
        # Volume should be at least 1.2x average for confirmation
        return current_volume > avg_volume * 1.2
    
    def _is_trend_appropriate(self, pattern: Dict, trend: str) -> bool:
        """Check if pattern makes sense in current trend context"""
        pattern_type = pattern['type']
        
        # Bullish reversal patterns should appear in downtrends
        if pattern_type == PatternType.REVERSAL_BULLISH:
            return trend == "downtrend"
        
        # Bearish reversal patterns should appear in uptrends
        if pattern_type == PatternType.REVERSAL_BEARISH:
            return trend == "uptrend"
        
        # Continuation patterns should match the trend
        if pattern_type == PatternType.BULLISH:
            return trend == "uptrend"
        
        if pattern_type == PatternType.BEARISH:
            return trend == "downtrend"
        
        # Neutral patterns work in any trend
        return True
def calculate_pattern_statistics(patterns: List[Dict], df: pd.DataFrame) -> Dict:
    """Calculate historical success rates for detected patterns"""
    
    if not patterns:
        return {}
    
    stats = {}
    horizons = [1, 3, 5, 7, 10]  # Days ahead to check
    
    for pattern in patterns:
        pattern_name = pattern['name']
        pattern_type = pattern['type']
        idx = pattern['index']
        
        if pattern_name not in stats:
            stats[pattern_name] = {
                'count': 0,
                'type': pattern_type,
                'outcomes': {f'{h}d': [] for h in horizons}
            }
        
        stats[pattern_name]['count'] += 1
        
        # Calculate future returns for this pattern occurrence
        for horizon in horizons:
            future_idx = idx + horizon
            
            if future_idx < len(df):
                base_price = df['close'].iloc[idx]
                future_price = df['close'].iloc[future_idx]
                return_pct = ((future_price - base_price) / base_price) * 100
                
                stats[pattern_name]['outcomes'][f'{horizon}d'].append(return_pct)
    
    # Calculate summary statistics
    for pattern_name in stats:
        for horizon in [f'{h}d' for h in horizons]:
            outcomes = stats[pattern_name]['outcomes'][horizon]
            
            if outcomes:
                stats[pattern_name]['outcomes'][horizon] = {
                    'mean': round(np.mean(outcomes), 2),
                    'median': round(np.median(outcomes), 2),
                    'success_rate': round(sum(1 for x in outcomes if x > 0) / len(outcomes) * 100, 1),
                    'avg_gain': round(np.mean([x for x in outcomes if x > 0]), 2) if any(x > 0 for x in outcomes) else 0,
                    'avg_loss': round(np.mean([x for x in outcomes if x < 0]), 2) if any(x < 0 for x in outcomes) else 0,
                    'count': len(outcomes)
                }
            else:
                stats[pattern_name]['outcomes'][horizon] = None
    
    return stats
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
    def find_similar_patterns(self, df: pd.DataFrame, top_n: int = 5) -> Dict:
        """Main pattern matching function"""
        if df is None or len(df) < self.lookback_days + 30 + 10:
            return self._empty_result("Not enough historical data")
        
        matches_df = self.find_most_similar_pattern(df, window_size=self.lookback_days, top_n=top_n)
        
        if matches_df.empty:
            return self._empty_result("No patterns found")
        
        matches = matches_df.to_dict('records')
        predictions = self._calculate_predictions(matches, df)  # ← Pass df here
        analysis = self._generate_analysis(matches, predictions)
        
        return {
            'matches': matches,
            'predictions': predictions,
            'analysis': analysis,
            'debug_info': {'method': 'Enhanced MMPS'}
        }
    def _calculate_predictions(self, matches: List[Dict], df: pd.DataFrame) -> Dict:
        """Calculate REAL predictions based on historical pattern outcomes"""
        if not matches: 
            return {}
        
        predictions = {}
        horizons = {'1d': 1, '3d': 3, '5d': 5, '7d': 7, '10d': 10}
        
        for period, days in horizons.items():
            returns_list = []
            
            # Collect actual historical returns for each match
            for match in matches:
                start_idx = match['start_idx']
                window_size = self.lookback_days
                pattern_end_idx = start_idx + window_size
                
                # Check if we have future data
                future_idx = pattern_end_idx + days
                if future_idx < len(df):
                    base_price = df['close'].iloc[pattern_end_idx]
                    future_price = df['close'].iloc[future_idx]
                    return_pct = ((future_price - base_price) / base_price) * 100
                    returns_list.append(return_pct)
            
            # Calculate statistics from REAL historical returns
            if returns_list:
                predictions[period] = {
                    'mean': round(float(np.mean(returns_list)), 2),
                    'median': round(float(np.median(returns_list)), 2),
                    'std': round(float(np.std(returns_list)), 2),
                    'min': round(float(np.min(returns_list)), 2),
                    'max': round(float(np.max(returns_list)), 2),
                    'count': len(returns_list),
                    'positive_rate': round(sum(1 for r in returns_list if r > 0) / len(returns_list) * 100, 1)
                }
            else:
                # No future data available for this horizon
                predictions[period] = {
                    'mean': None,
                    'median': None,
                    'std': None,
                    'min': None,
                    'max': None,
                    'count': 0,
                    'positive_rate': None
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
    def detect_candlestick_patterns(self, df, lookback_days=90):
        """Detect classical candlestick patterns in recent data"""
        if df is None or df.empty:
            return []
        
        # Only analyze recent data (last lookback_days)
        recent_df = df.tail(lookback_days).reset_index(drop=True)
        
        # Initialize detector
        detector = CandlestickPatternDetector()
        
        # Detect all patterns
        all_patterns = detector.detect_all_patterns(recent_df)
        
        # Sort by date (most recent first)
        all_patterns.sort(key=lambda x: x['date'], reverse=True)
        
        return all_patterns
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
    
    expert_prompt = f"""Analyze this indian stock pattern data:\n\n{context}\n\n
    give only in inr
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
    Enhanced endpoint with TRUE candlestick pattern recognition
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
        
        print(f"\n=== Analyzing {symbol} ===")
        print(f"Data points: {len(df)}")
        
        # 1. Run similarity-based pattern analysis
        pattern_result = analyzer.pattern_engine.find_similar_patterns(df, top_n=top_n)
        
        # 2. Detect classical candlestick patterns
        print("Detecting candlestick patterns...")
        candlestick_patterns = analyzer.detect_candlestick_patterns(df, lookback_days=90)
        
        # 3. Validate patterns with volume and trend
        print("Validating patterns...")
        validator = PatternValidator()
        validated_patterns = validator.validate_patterns(candlestick_patterns, df)
        
        # 4. Calculate pattern statistics
        print("Calculating pattern statistics...")
        pattern_stats = calculate_pattern_statistics(validated_patterns, df)
        
        # 5. Calculate technical indicators
        indicators = analyzer.calculate_indicators(df)
        
        
        # Get recent patterns only (last 30 days)
        recent_patterns = [p for p in validated_patterns if p['index'] >= len(df) - 30]
        
        # Prepare stock data for AI
        stock_data = {
            'symbol': symbol,
            'indicators': indicators,
            'pattern_result': pattern_result,
            'candlestick_patterns': recent_patterns,
            'pattern_stats': pattern_stats,
            'lookback_days': lookback
        }
        
        # Get AI insights
        print(f"Generating AI insights for {symbol}...")
        ai_insights = get_ai_insights(stock_data)
        
        # Initialize chain for match insights
        chain = init_langchain()
        
        # Build enhanced matches with future returns and AI insights
        enhanced_matches = []
        for idx, match in enumerate(pattern_result['matches']):
            future_returns = calculate_future_returns(df, match['start_idx'], lookback)
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
        
        # Build comprehensive response
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
            
            # Similarity-based matches
            "similarity_matches": enhanced_matches,
            
            # NEW: Classical candlestick patterns
            "candlestick_patterns": {
                "recent": recent_patterns[:10],  # Last 10 recent patterns
                "all": validated_patterns,
                "statistics": pattern_stats,
                "summary": {
                    "total_detected": len(validated_patterns),
                    "bullish": sum(1 for p in recent_patterns if 'bullish' in p['type'].lower()),
                    "bearish": sum(1 for p in recent_patterns if 'bearish' in p['type'].lower()),
                    "confirmed": sum(1 for p in recent_patterns if p['confirmation'])
                }
            },
            
            
            "ai_report": ai_insights.get('analysis'),
            "ai_error": ai_insights.get('error'),
            
            "predictions": pattern_result.get('predictions', {}),
            
            "metadata": {
                "total_similarity_matches": len(enhanced_matches),
                "total_candlestick_patterns": len(validated_patterns),
                "avg_similarity": round(np.mean([m['score'] for m in enhanced_matches]), 2) if enhanced_matches else 0,
                "generated_at": datetime.now().isoformat(),
                "ai_configured": chain is not None
            }
        }
        
        print(f"✓ Analysis complete for {symbol}")
        response = convert_to_json_serializable(response)  # ← Add this line
        return jsonify(response), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = 8000
    app.run(host='0.0.0.0', port=port)