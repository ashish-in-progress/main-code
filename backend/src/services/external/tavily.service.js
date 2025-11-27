import { tavily } from '@tavily/core';
import { logger } from '../../utils/logger.js';

export class TavilyService {
  static client = null;
  static isInitialized = false;

  /**
   * Initialize Tavily client with better error handling
   */
  static initialize() {
    if (this.isInitialized && this.client) return true;

    if (!process.env.TAVILY_API_KEY) {
      logger.warn('⚠️ TAVILY_API_KEY not set, web search will be disabled');
      this.isInitialized = false;
      return false;
    }

    try {
      this.client = tavily({ apiKey: process.env.TAVILY_API_KEY });
      this.isInitialized = true;
      logger.info('✅ Tavily service initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Tavily:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Search for recent news about a stock with better error handling
   */
  static async searchStockNews(symbol, companyName = null, limit = 5) {
    // Try to initialize if not already done
    if (!this.isInitialized) {
      const initialized = this.initialize();
      if (!initialized) {
        logger.warn(`Tavily not available for ${symbol}`);
        return [];
      }
    }

    try {
      // Clean symbol (remove exchange suffix like .NS, .BO)
      const cleanSymbol = symbol.replace(/\.(NS|BO|BSE)$/i, '');
      
      // Build search query
      const query = companyName 
        ? `${companyName} ${cleanSymbol} stock news India latest`
        : `${cleanSymbol} stock news India latest`;
      
      logger.info(`🔍 Searching news for: ${query}`);

      const response = await this.client.search(query, {
        searchDepth: "basic",  // Changed from "advanced" to avoid rate limits
        maxResults: limit,
        includeAnswer: false,
        includeDomains: [
          'moneycontrol.com',
          'economictimes.indiatimes.com',
          'livemint.com',
          'business-standard.com',
          'financialexpress.com',
          'reuters.com',
          'bloomberg.com'
        ],
        excludeDomains: [
          'facebook.com',
          'twitter.com',
          'instagram.com',
          'youtube.com'
        ]
      });

      if (!response || !response.results || response.results.length === 0) {
        logger.warn(`No news found for ${symbol}`);
        return [];
      }

      logger.info(`✅ Found ${response.results.length} news articles for ${symbol}`);

      return response.results.map(result => ({
        title: result.title || 'No title',
        url: result.url || '',
        content: result.content || '',
        snippet: result.content?.substring(0, 200) + '...' || '',
        publishedDate: result.publishedDate || null,
        score: result.score || 0
      }));

    } catch (error) {
      logger.error(`❌ Tavily search error for ${symbol}:`, error.message);
      
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Search for overall market sentiment with retry logic
   */
  static async getMarketSentiment() {
    if (!this.isInitialized) {
      const initialized = this.initialize();
      if (!initialized) {
        return {
          summary: 'Market sentiment data unavailable (Tavily not configured)',
          articles: []
        };
      }
    }

    try {
      const query = 'Indian stock market Nifty Sensex today outlook news';
      
      logger.info('🔍 Fetching market sentiment');

      const response = await this.client.search(query, {
        searchDepth: "basic",
        maxResults: 3,
        includeAnswer: false
      });

      if (!response || !response.results) {
        return {
          summary: 'Market sentiment data unavailable',
          articles: []
        };
      }

      const summary = response.results
        .slice(0, 2)
        .map(r => r.content)
        .filter(Boolean)
        .join(' ')
        .substring(0, 500);

      logger.info('✅ Market sentiment fetched');

      return {
        summary: summary || 'Indian markets showing mixed trends today',
        articles: response.results
      };

    } catch (error) {
      logger.error('❌ Market sentiment search error:', error.message);
      return {
        summary: 'Market sentiment data temporarily unavailable',
        articles: []
      };
    }
  }

  /**
   * Get company name from symbol (helper function)
   */
  static getCompanyName(symbol) {
    // Common Indian stock symbols to company names mapping
    const symbolMap = {
      'RELIANCE': 'Reliance Industries',
      'TCS': 'Tata Consultancy Services',
      'HDFCBANK': 'HDFC Bank',
      'INFY': 'Infosys',
      'HINDUNILVR': 'Hindustan Unilever',
      'ICICIBANK': 'ICICI Bank',
      'KOTAKBANK': 'Kotak Mahindra Bank',
      'SBIN': 'State Bank of India',
      'BHARTIARTL': 'Bharti Airtel',
      'ITC': 'ITC Limited',
      'ASIANPAINT': 'Asian Paints',
      'AXISBANK': 'Axis Bank',
      'LT': 'Larsen & Toubro',
      'MARUTI': 'Maruti Suzuki',
      'WIPRO': 'Wipro',
      'TATAMOTORS': 'Tata Motors',
      'TATASTEEL': 'Tata Steel',
      'SUNPHARMA': 'Sun Pharmaceutical',
      'BAJFINANCE': 'Bajaj Finance',
      'POWERGRID': 'Power Grid Corporation',
      'ADANIGREEN': 'Adani Green Energy',
      'ADANIPORTS': 'Adani Ports',
      'TITAN': 'Titan Company',
      'ULTRACEMCO': 'UltraTech Cement',
      'NESTLEIND': 'Nestle India',
      'JSWSTEEL': 'JSW Steel',
      'M&M': 'Mahindra & Mahindra',
      'NTPC': 'NTPC Limited',
      'ONGC': 'Oil and Natural Gas Corporation',
      'TECHM': 'Tech Mahindra',
      'HCLTECH': 'HCL Technologies',
      'BAJAJFINSV': 'Bajaj Finserv',
      'DIVISLAB': 'Divi\'s Laboratories',
      'DRREDDY': 'Dr. Reddy\'s Laboratories',
      'CIPLA': 'Cipla',
      'GRASIM': 'Grasim Industries',
      'SHREECEM': 'Shree Cement',
      'HINDALCO': 'Hindalco Industries',
      'COALINDIA': 'Coal India',
      'BRITANNIA': 'Britannia Industries',
      'APOLLOHOSP': 'Apollo Hospitals',
      'IDEA': 'Vodafone Idea'
    };

    const cleanSymbol = symbol.replace(/\.(NS|BO|BSE)$/i, '').toUpperCase();
    return symbolMap[cleanSymbol] || null;
  }

  /**
   * Batch search for multiple stocks (with rate limiting)
   */
  static async searchBatch(symbols, limit = 3) {
    const results = {};
    
    for (const symbol of symbols) {
      const companyName = this.getCompanyName(symbol);
      const news = await this.searchStockNews(symbol, companyName, limit);
      results[symbol] = news;
      
      // Rate limiting: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Test if Tavily is working
   */
  static async test() {
    logger.info('🧪 Testing Tavily service...');
    
    if (!this.initialize()) {
      logger.error('❌ Tavily initialization failed');
      return false;
    }

    try {
      const testNews = await this.searchStockNews('RELIANCE', 'Reliance Industries', 2);
      
      if (testNews && testNews.length > 0) {
        logger.info('✅ Tavily test successful');
        return true;
      } else {
        logger.warn('⚠️ Tavily returned no results');
        return false;
      }
    } catch (error) {
      logger.error('❌ Tavily test failed:', error.message);
      return false;
    }
  }
}