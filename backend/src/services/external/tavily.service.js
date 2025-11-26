import { tavily } from '@tavily/core';
import { logger } from '../../utils/logger.js';

export class TavilyService {
  static client = null;

  /**
   * Initialize Tavily client
   */
  static initialize() {
    if (this.client) return;

    if (!process.env.TAVILY_API_KEY) {
      logger.warn('TAVILY_API_KEY not set, web search will be disabled');
      return;
    }

    this.client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    logger.info('Tavily service initialized');
  }

  /**
   * Search for recent news about a stock
   */
  static async searchStockNews(symbol, companyName = null, limit = 5) {
    if (!this.client) {
      this.initialize();
    }

    if (!this.client) {
      return [];
    }

    try {
      const query = companyName 
        ? `${companyName} ${symbol} stock news latest analysis`
        : `${symbol} stock news latest analysis`;
      
      const response = await this.client.search(query, {
        searchDepth: "advanced",
        maxResults: limit,
        includeDomains: [
          'moneycontrol.com',
          'economictimes.indiatimes.com',
          'livemint.com',
          'reuters.com',
          'bloomberg.com',
          'business-standard.com'
        ],
        topic: 'news',
        days: 7 // Last 7 days
      });

      logger.info(`Found ${response.results.length} news articles for ${symbol}`);

      return response.results.map(result => ({
        title: result.title,
        url: result.url,
        content: result.content,
        snippet: result.content?.substring(0, 200) + '...',
        publishedDate: result.publishedDate,
        score: result.score
      }));
    } catch (error) {
      logger.error(`Tavily search error for ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * Search for overall market sentiment
   */
  static async getMarketSentiment() {
    if (!this.client) {
      this.initialize();
    }

    if (!this.client) {
      return {
        summary: 'Market sentiment data unavailable',
        articles: []
      };
    }

    try {
      const query = 'Indian stock market sentiment outlook today NSE BSE';
      
      const response = await this.client.search(query, {
        searchDepth: "basic",
        maxResults: 5,
        topic: 'news',
        days: 2
      });

      const summary = response.results
        .slice(0, 3)
        .map(r => r.content)
        .join(' ');

      return {
        summary: summary.substring(0, 500) + '...',
        articles: response.results
      };
    } catch (error) {
      logger.error('Market sentiment search error:', error.message);
      return {
        summary: 'Unable to fetch market sentiment',
        articles: []
      };
    }
  }

  /**
   * Search for specific stock events (earnings, announcements, etc.)
   */
  static async searchStockEvents(symbol, limit = 3) {
    if (!this.client) {
      this.initialize();
    }

    if (!this.client) {
      return [];
    }

    try {
      const query = `${symbol} earnings announcement dividend corporate action`;
      
      const response = await this.client.search(query, {
        searchDepth: "basic",
        maxResults: limit,
        days: 30
      });

      return response.results;
    } catch (error) {
      logger.error(`Stock events search error for ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * Get sector-specific news
   */
  static async getSectorNews(sector, limit = 3) {
    if (!this.client) {
      this.initialize();
    }

    if (!this.client) {
      return [];
    }

    try {
      const query = `${sector} sector India stock market outlook`;
      
      const response = await this.client.search(query, {
        searchDepth: "basic",
        maxResults: limit,
        days: 7
      });

      return response.results;
    } catch (error) {
      logger.error(`Sector news search error for ${sector}:`, error.message);
      return [];
    }
  }
}