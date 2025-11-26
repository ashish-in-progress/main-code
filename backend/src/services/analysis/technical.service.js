import axios from 'axios';
import { logger } from '../../utils/logger.js';

export class TechnicalService {
  /**
   * Fetch stock data from external API with technical indicators
   */
  static async getStockData(symbol) {
    try {
      logger.info(`Fetching technical data for ${symbol} from API`);
      
      const response = await axios.get(`http://localhost:5500/?stock=${symbol}`);
      
      if (response.data && response.data.status === 'success') {
        return response.data.data;
      }
      
      logger.warn(`No data returned for ${symbol}`);
      return null;
    } catch (error) {
      logger.error(`Error fetching stock data for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get comprehensive technical analysis using external API data
   */
  static async analyzeTechnicals(symbol, broker, currentPrice) {
    try {
      // Get data from external API (already contains technical indicators)
      const stockData = await this.getStockData(symbol);
      
      if (!stockData) {
        logger.warn(`No data available for ${symbol}`);
        
        return {
          symbol,
          currentPrice,
          rsi: null,
          sma20: null,
          sma50: null,
          ema12: null,
          ema26: null,
          macd: null,
          signal: 'HOLD',
          reason: 'Insufficient data',
          strength: 'NEUTRAL'
        };
      }

      // Extract technical indicators from API response
      const rsi = stockData.rsi_14;
      const sma20 = stockData.sma20;
      const sma50 = stockData.sma50;
      const ema12 = stockData.ema12;
      const ema26 = stockData.ema26;
      const macd = {
        macd: stockData.macd,
        signal: stockData.macd_signal,
        histogram: stockData.macd_hist
      };

      // Use API's current price if not provided
      const price = currentPrice || stockData.current_price;

      // Generate trading signal
      const signal = this.generateSignal(rsi, price, sma20, sma50, ema12, ema26, macd);

      return {
        symbol,
        currentPrice: price,
        rsi: rsi,
        sma20,
        sma50,
        sma200: stockData.sma200,
        ema12,
        ema26,
        macd: macd.macd,
        macdSignal: macd.signal,
        macdHistogram: macd.histogram,
        dayHigh: stockData.day_high,
        dayLow: stockData.day_low,
        fiftyTwoWeekHigh: stockData.fifty_two_week_high,
        fiftyTwoWeekLow: stockData.fifty_two_week_low,
        volume: stockData.volume,
        avgVolume: stockData.avg_volume,
        signal: signal.action,
        reason: signal.reason,
        strength: signal.strength,
        additionalInfo: signal.additionalInfo
      };
    } catch (error) {
      logger.error(`Technical analysis error for ${symbol}:`, error.message);
      return {
        symbol,
        currentPrice,
        error: error.message,
        signal: 'HOLD',
        reason: 'Analysis failed',
        strength: 'NEUTRAL'
      };
    }
  }

  /**
   * Generate trading signal based on indicators
   */
  static generateSignal(rsi, currentPrice, sma20, sma50, ema12, ema26, macd) {
    let action = 'HOLD';
    let reason = '';
    let strength = 'NEUTRAL';
    let additionalInfo = [];

    if (!rsi) {
      return { 
        action: 'HOLD', 
        reason: 'Insufficient data', 
        strength: 'NEUTRAL',
        additionalInfo: []
      };
    }

    // RSI-based signals (primary indicator)
    if (rsi < 30) {
      action = 'BUY';
      reason = 'RSI indicates oversold condition';
      strength = 'STRONG';
      additionalInfo.push(`RSI at ${rsi.toFixed(2)} (oversold)`);
    } else if (rsi > 70) {
      action = 'SELL';
      reason = 'RSI indicates overbought condition';
      strength = 'STRONG';
      additionalInfo.push(`RSI at ${rsi.toFixed(2)} (overbought)`);
    } else if (rsi >= 30 && rsi <= 40) {
      action = 'BUY';
      reason = 'RSI approaching oversold levels';
      strength = 'MODERATE';
      additionalInfo.push(`RSI at ${rsi.toFixed(2)} (approaching oversold)`);
    } else if (rsi >= 60 && rsi <= 70) {
      action = 'SELL';
      reason = 'RSI approaching overbought levels';
      strength = 'MODERATE';
      additionalInfo.push(`RSI at ${rsi.toFixed(2)} (approaching overbought)`);
    } else {
      additionalInfo.push(`RSI at ${rsi.toFixed(2)} (neutral)`);
    }

    // Moving average trend analysis
    if (sma20 && sma50 && currentPrice) {
      if (currentPrice > sma20 && sma20 > sma50) {
        // Bullish trend
        additionalInfo.push('Price above SMA20 > SMA50 (bullish trend)');
        if (action === 'HOLD') {
          action = 'BUY';
          reason = 'Price above moving averages (bullish trend)';
          strength = 'MODERATE';
        } else if (action === 'BUY') {
          // Strengthen buy signal
          strength = 'STRONG';
          reason += ' with bullish MA confirmation';
        }
      } else if (currentPrice < sma20 && sma20 < sma50) {
        // Bearish trend
        additionalInfo.push('Price below SMA20 < SMA50 (bearish trend)');
        if (action === 'HOLD') {
          action = 'SELL';
          reason = 'Price below moving averages (bearish trend)';
          strength = 'MODERATE';
        } else if (action === 'SELL') {
          // Strengthen sell signal
          strength = 'STRONG';
          reason += ' with bearish MA confirmation';
        }
      }
    }

    // MACD confirmation
    if (macd && macd.macd !== null && macd.signal !== null) {
      if (macd.macd > macd.signal) {
        additionalInfo.push('MACD bullish crossover');
        if (action === 'BUY' && strength === 'MODERATE') {
          strength = 'STRONG';
        }
      } else if (macd.macd < macd.signal) {
        additionalInfo.push('MACD bearish crossover');
        if (action === 'SELL' && strength === 'MODERATE') {
          strength = 'STRONG';
        }
      }
    }

    // EMA crossover analysis
    if (ema12 && ema26) {
      if (ema12 > ema26) {
        additionalInfo.push('EMA12 > EMA26 (short-term bullish)');
      } else {
        additionalInfo.push('EMA12 < EMA26 (short-term bearish)');
      }
    }

    if (action === 'HOLD' && reason === '') {
      reason = 'No clear technical signal, maintain position';
    }

    return { action, reason, strength, additionalInfo };
  }

  /**
   * Get simple technical summary for positions without full analysis
   */
  static getSimpleTechnicalSummary(currentPrice, buyPrice, pnl) {
    const pnlPercent = ((currentPrice - buyPrice) / buyPrice) * 100;

    let signal = 'HOLD';
    let reason = '';
    let strength = 'NEUTRAL';
    
    if (pnlPercent > 15) {
      signal = 'BOOK_PROFIT';
      reason = 'Strong gains, consider booking partial profits';
      strength = 'STRONG';
    } else if (pnlPercent < -10) {
      signal = 'REVIEW';
      reason = 'Significant loss, review fundamentals and consider stop-loss';
      strength = 'STRONG';
    } else if (pnlPercent > 5 && pnlPercent <= 15) {
      signal = 'HOLD';
      reason = 'Good gains, hold for more upside';
      strength = 'MODERATE';
    } else if (pnlPercent >= -5 && pnlPercent <= 5) {
      signal = 'HOLD';
      reason = 'Price within normal range';
      strength = 'WEAK';
    } else {
      signal = 'REVIEW';
      reason = 'Moderate loss, monitor closely';
      strength = 'MODERATE';
    }

    return {
      signal,
      reason,
      pnlPercent: Math.round(pnlPercent * 100) / 100,
      strength
    };
  }

  /**
   * Get batch technical analysis for multiple symbols
   */
  static async analyzeBatch(symbols, broker) {
    const results = [];
    
    for (const symbol of symbols) {
      const analysis = await this.analyzeTechnicals(symbol, broker);
      results.push(analysis);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  /**
   * Format technical analysis for display
   */
  static formatAnalysis(analysis) {
    if (!analysis) return 'No analysis available';

    let output = `\n📊 Technical Analysis for ${analysis.symbol}\n`;
    output += `${'='.repeat(50)}\n`;
    output += `Current Price: ₹${analysis.currentPrice}\n\n`;

    output += `📈 Indicators:\n`;
    output += `  RSI (14): ${analysis.rsi?.toFixed(2) || 'N/A'}\n`;
    output += `  SMA (20): ₹${analysis.sma20?.toFixed(2) || 'N/A'}\n`;
    output += `  SMA (50): ₹${analysis.sma50?.toFixed(2) || 'N/A'}\n`;
    output += `  EMA (12): ₹${analysis.ema12?.toFixed(2) || 'N/A'}\n`;
    output += `  EMA (26): ₹${analysis.ema26?.toFixed(2) || 'N/A'}\n`;
    output += `  MACD: ${analysis.macd?.toFixed(2) || 'N/A'}\n`;
    
    if (analysis.macdSignal) {
      output += `  MACD Signal: ${analysis.macdSignal.toFixed(2)}\n`;
    }

    output += `\n🎯 Signal: ${analysis.signal} (${analysis.strength})\n`;
    output += `💡 Reason: ${analysis.reason}\n`;

    if (analysis.additionalInfo && analysis.additionalInfo.length > 0) {
      output += `\nℹ️  Additional Insights:\n`;
      analysis.additionalInfo.forEach(info => {
        output += `  • ${info}\n`;
      });
    }

    return output;
  }
}