import { AzureChatOpenAI } from '@langchain/openai';
import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { AZURE_CONFIG_KITE } from '../../config/constants.js';

export class AIInsightsService {
  static model = null;

  /**
   * Fetch current price from external API
   */
  static async getCurrentPrice(symbol) {
    try {
      logger.info(`Fetching current price for ${symbol} from API`);
      
      const response = await axios.get(`https://33trpk9t-5500.inc1.devtunnels.ms/current?symbol=${symbol}.NS`);
      
      if (response.data && response.data.current_price) {
        return response.data.current_price;
      }
      
      logger.warn(`No current price returned for ${symbol}`);
      return null;
    } catch (error) {
      logger.error(`Error fetching current price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Initialize Azure OpenAI model
   */
  static initialize() {
    if (this.model) return;

    this.model = new AzureChatOpenAI({
      azureOpenAIApiKey: AZURE_CONFIG_KITE.apiKey,
      azureOpenAIApiInstanceName: this.extractInstanceName(AZURE_CONFIG_KITE.endpoint),
      azureOpenAIApiDeploymentName: AZURE_CONFIG_KITE.deployment,
      azureOpenAIApiVersion: AZURE_CONFIG_KITE.apiVersion,
      temperature: 0.7,
    });

    logger.info('AI Insights service initialized');
  }

  static extractInstanceName(endpoint) {
    const match = endpoint.match(/https:\/\/([^.]+)\.openai\.azure\.com/);
    return match ? match[1] : 'codestore-ai';
  }

  /**
   * Generate insights for a single stock with real-time price
   */
  static async generateStockInsight(holding, technicalData, newsArticles) {
    if (!this.model) {
      this.initialize();
    }

    try {
      // Fetch current price
      const currentPrice = await this.getCurrentPrice(holding.symbol);
      
      // Update holding with current price if fetched successfully
      if (currentPrice) {
        const avgPrice = Number(holding.average_price) || 0;
        const quantity = Number(holding.quantity) || 0;
        
        // Recalculate PnL with updated price
        const updatedPnl = (currentPrice - avgPrice) * quantity;
        const updatedPnlPercentage = ((currentPrice - avgPrice) / avgPrice) * 100;
        
        holding = {
          ...holding,
          current_price: currentPrice,
          pnl: updatedPnl,
          pnl_percentage: updatedPnlPercentage
        };
        
        logger.info(`Updated ${holding.symbol} with current price: ₹${currentPrice}`);
      }

      const prompt = this.buildStockAnalysisPrompt(holding, technicalData, newsArticles);
      
      const response = await this.model.invoke(prompt);
      
      logger.info(`Generated AI insight for ${holding.symbol}`);
      
      return response.content;
    } catch (error) {
      logger.error(`AI insight generation error for ${holding.symbol}:`, error.message);
      return this.getFallbackInsight(holding, technicalData);
    }
  }

  /**
   * Build comprehensive prompt for stock analysis
   */
  static buildStockAnalysisPrompt(holding, technicalData, newsArticles) {
    const newsContext = newsArticles && newsArticles.length > 0
      ? newsArticles.map(n => `- ${n.title}: ${n.snippet || n.content?.substring(0, 150)}`).join('\n')
      : 'No recent news available';

    // Convert to numbers
    const avgPrice = Number(holding.average_price) || 0;
    const currentPrice = Number(holding.current_price) || 0;
    const pnl = Number(holding.pnl) || 0;
    const pnlPercentage = Number(holding.pnl_percentage) || 0;
    const quantity = Number(holding.quantity) || 0;

    return `You are an expert stock market analyst. Analyze the following stock and provide a concise, actionable insight (3-4 sentences max).

**Stock Details:**
- Symbol: ${holding.symbol}
- Quantity: ${quantity}
- Average Price: ₹${avgPrice.toFixed(2)}
- Current Price: ₹${currentPrice.toFixed(2)}
- P&L: ₹${pnl.toFixed(2)} (${pnlPercentage.toFixed(2)}%)
- Broker: ${holding.broker}

**Technical Analysis:**
- RSI: ${technicalData.rsi || 'N/A'}
- Signal: ${technicalData.signal || 'HOLD'}
- Strength: ${technicalData.strength || 'NEUTRAL'}
- Reason: ${technicalData.reason || 'N/A'}
- MA20: ${technicalData.ma20 || 'N/A'}
- MA50: ${technicalData.ma50 || 'N/A'}

**Recent News:**
${newsContext}

Provide:
1. Brief assessment of current position
2. Key technical or fundamental point
3. One clear recommendation (Hold/Buy More/Book Profit/Review)
4. Risk factor or opportunity to watch

Be specific, actionable, and concise. Focus on what matters most for this position.`;
  }

  /**
   * Generate overall portfolio summary with real-time prices
   */
  static async generatePortfolioSummary(allHoldings, marketSentiment) {
    if (!this.model) {
      this.initialize();
    }

    try {
      // Update all holdings with current prices
      const updatedHoldings = await Promise.all(
        allHoldings.map(async (holding) => {
          const currentPrice = await this.getCurrentPrice(holding.symbol);
          
          if (currentPrice) {
            const avgPrice = Number(holding.average_price) || 0;
            const quantity = Number(holding.quantity) || 0;
            const updatedPnl = (currentPrice - avgPrice) * quantity;
            const updatedPnlPercentage = ((currentPrice - avgPrice) / avgPrice) * 100;
            
            return {
              ...holding,
              current_price: currentPrice,
              pnl: updatedPnl,
              pnl_percentage: updatedPnlPercentage
            };
          }
          
          return holding;
        })
      );

      // Convert all values to numbers before calculations
      const totalValue = updatedHoldings.reduce((sum, h) => {
        const currentPrice = Number(h.current_price) || 0;
        const quantity = Number(h.quantity) || 0;
        return sum + (currentPrice * quantity);
      }, 0);

      const totalPnL = updatedHoldings.reduce((sum, h) => {
        const pnl = Number(h.pnl) || 0;
        return sum + pnl;
      }, 0);

      const avgPnLPercent = updatedHoldings.reduce((sum, h) => {
        const pnlPercent = Number(h.pnl_percentage) || 0;
        return sum + pnlPercent;
      }, 0) / updatedHoldings.length;

      const topGainers = updatedHoldings
        .filter(h => Number(h.pnl) > 0)
        .sort((a, b) => Number(b.pnl_percentage) - Number(a.pnl_percentage))
        .slice(0, 3);

      const topLosers = updatedHoldings
        .filter(h => Number(h.pnl) < 0)
        .sort((a, b) => Number(a.pnl_percentage) - Number(b.pnl_percentage))
        .slice(0, 3);

      const prompt = `You are a portfolio manager. Provide a brief overall summary of this portfolio (4-5 sentences).

**Portfolio Overview:**
- Total Holdings: ${updatedHoldings.length} stocks
- Total Portfolio Value: ₹${totalValue.toFixed(2)}
- Overall P&L: ₹${totalPnL.toFixed(2)} (${avgPnLPercent.toFixed(2)}%)

**Top Gainers:**
${topGainers.map(h => `- ${h.symbol}: +${Number(h.pnl_percentage).toFixed(2)}%`).join('\n') || 'None'}

**Top Losers:**
${topLosers.map(h => `- ${h.symbol}: ${Number(h.pnl_percentage).toFixed(2)}%`).join('\n') || 'None'}

**Market Context:**
${marketSentiment?.summary || 'Market sentiment data unavailable'}

Provide:
1. Overall portfolio health assessment
2. Key strength or concern
3. One strategic recommendation
4. What to watch today

Be concise and actionable.`;

      const response = await this.model.invoke(prompt);
      
      logger.info('Generated portfolio summary with updated prices');
      
      return response.content;
    } catch (error) {
      logger.error('Portfolio summary generation error:', error.message);
      return this.getFallbackPortfolioSummary(allHoldings);
    }
  }

  /**
   * Fallback insight when AI fails
   */
  static getFallbackInsight(holding, technicalData) {
    const pnl = Number(holding.pnl) || 0;
    const pnlPercentage = Number(holding.pnl_percentage) || 0;
    const pnlStatus = pnl >= 0 ? 'profit' : 'loss';
    const signal = technicalData.signal || 'HOLD';

    return `${holding.symbol} is currently in ${pnlStatus} (${pnlPercentage.toFixed(2)}%). Technical analysis suggests ${signal}. ${technicalData.reason || 'Monitor price movement closely.'}`;
  }

  /**
   * Fallback portfolio summary
   */
  static getFallbackPortfolioSummary(allHoldings) {
    const totalPnL = allHoldings.reduce((sum, h) => sum + (Number(h.pnl) || 0), 0);
    const status = totalPnL >= 0 ? 'profitable' : 'in loss';
    const gainers = allHoldings.filter(h => Number(h.pnl) > 0).length;
    const losers = allHoldings.filter(h => Number(h.pnl) < 0).length;

    return `Your portfolio of ${allHoldings.length} stocks is currently ${status} with overall P&L of ₹${totalPnL.toFixed(2)}. ${gainers} stocks are in profit and ${losers} are in loss. Review individual positions and consider rebalancing based on technical signals.`;
  }

  /**
   * Generate recommendation based on technical + news sentiment
   */
  static generateRecommendation(technicalSignal, newsArticles) {
    // Analyze news sentiment (simple keyword-based)
    let newsSentiment = 'NEUTRAL';
    
    if (newsArticles && newsArticles.length > 0) {
      const positiveKeywords = ['surge', 'gain', 'profit', 'growth', 'bullish', 'upgrade', 'buy'];
      const negativeKeywords = ['fall', 'loss', 'decline', 'bearish', 'downgrade', 'sell'];
      
      let positiveCount = 0;
      let negativeCount = 0;

      newsArticles.forEach(article => {
        const text = (article.title + ' ' + article.content).toLowerCase();
        positiveKeywords.forEach(kw => {
          if (text.includes(kw)) positiveCount++;
        });
        negativeKeywords.forEach(kw => {
          if (text.includes(kw)) negativeCount++;
        });
      });

      if (positiveCount > negativeCount) {
        newsSentiment = 'POSITIVE';
      } else if (negativeCount > positiveCount) {
        newsSentiment = 'NEGATIVE';
      }
    }

    // Combine technical + news
    if (technicalSignal === 'BUY' && newsSentiment === 'POSITIVE') {
      return { action: 'STRONG_BUY', confidence: 'HIGH' };
    } else if (technicalSignal === 'SELL' && newsSentiment === 'NEGATIVE') {
      return { action: 'STRONG_SELL', confidence: 'HIGH' };
    } else if (technicalSignal === 'BUY') {
      return { action: 'BUY', confidence: 'MODERATE' };
    } else if (technicalSignal === 'SELL') {
      return { action: 'SELL', confidence: 'MODERATE' };
    } else {
      return { action: 'HOLD', confidence: 'MODERATE' };
    }
  }
}