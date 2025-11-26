import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { TechnicalService } from '../services/analysis/technical.service.js';
import { AIInsightsService } from '../services/analysis/ai-insights.service.js';
import { TavilyService } from '../services/external/tavily.service.js';
import { EmailService } from '../services/email/email.service.js';

export class StockInsightsJob {
  /**
   * Main job function - runs on schedule
   */
  static async execute() {
    logger.info('🚀 Starting Stock Insights Job...');

    try {
      // Initialize services
      TavilyService.initialize();
      AIInsightsService.initialize();
      EmailService.initialize();

      // Get all users who have holdings
      const users = await this.getUsersWithHoldings();
      
      if (users.length === 0) {
        logger.info('No users with holdings found');
        return;
      }

      logger.info(`Processing insights for ${users.length} users`);

      // Process each user
      for (const user of users) {
        try {
          await this.processUserInsights(user.user_email);
        } catch (error) {
          logger.error(`Failed to process insights for ${user.user_email}:`, error.message);
          // Continue with next user
        }
      }

      logger.info('✅ Stock Insights Job completed successfully');
    } catch (error) {
      logger.error('❌ Stock Insights Job failed:', error.message);
      throw error;
    }
  }

  /**
   * Get all users who have holdings in database
   */
  static async getUsersWithHoldings() {
    try {
      const [users] = await db.query(`
        SELECT DISTINCT user_email 
        FROM User_Holdings 
        WHERE last_updated >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY user_email
      `);

      return users;
    } catch (error) {
      logger.error('Error fetching users:', error.message);
      return [];
    }
  }

  /**
   * Process insights for a single user
   */
  static async processUserInsights(userEmail) {
    logger.info(`Processing insights for ${userEmail}`);

    // 1. Fetch user's holdings from database
    const holdings = await this.getUserHoldings(userEmail);

    if (holdings.length === 0) {
      logger.warn(`No holdings found for ${userEmail}`);
      return;
    }

    logger.info(`Found ${holdings.length} holdings for ${userEmail}`);

    // 2. Get market sentiment
    const marketSentiment = await TavilyService.getMarketSentiment();

    // 3. Analyze each holding
    const analyzedHoldings = [];

    for (const holding of holdings) {
      try {
        logger.info(`Analyzing ${holding.symbol}...`);

        // Get technical analysis
        const technicalData = await TechnicalService.analyzeTechnicals(
          holding.symbol,
          holding.broker,
          holding.current_price
        );

        // Get latest news
        const news = await TavilyService.searchStockNews("NSE:"+holding.symbol, null, 5);

        // Generate AI insights
        const aiInsight = await AIInsightsService.generateStockInsight(
          holding,
          technicalData,
          news
        );

        analyzedHoldings.push({
          ...holding,
          technical: technicalData,
          news: news,
          aiInsight: aiInsight
        });

        // Small delay to avoid rate limits
        await this.sleep(1000);
      } catch (error) {
        logger.error(`Error analyzing ${holding.symbol}:`, error.message);
        
        // Add holding with basic info even if analysis fails
        analyzedHoldings.push({
          ...holding,
          technical: { signal: 'HOLD', reason: 'Analysis unavailable' },
          news: [],
          aiInsight: `${holding.symbol}: Currently ${holding.pnl >= 0 ? 'in profit' : 'in loss'} at ${holding.pnl_percentage}%. Monitor closely.`
        });
      }
    }

    // 4. Generate overall portfolio summary
    const overallSummary = await AIInsightsService.generatePortfolioSummary(
      analyzedHoldings,
      marketSentiment
    );

    // 5. Prepare insights object
    const insights = {
      userEmail,
      date: new Date().toISOString(),
      holdings: analyzedHoldings,
      analysis: {
        totalHoldings: analyzedHoldings.length,
        totalPnL: analyzedHoldings.reduce((sum, h) => sum + h.pnl, 0),
        avgPnLPercent: analyzedHoldings.reduce((sum, h) => sum + h.pnl_percentage, 0) / analyzedHoldings.length,
        gainers: analyzedHoldings.filter(h => h.pnl > 0).length,
        losers: analyzedHoldings.filter(h => h.pnl < 0).length
      },
      overallSummary,
      marketSentiment: marketSentiment.summary
    };

    // 6. Send email
    await EmailService.sendInsightsEmail(userEmail, insights);

    logger.info(`✅ Insights sent to ${userEmail}`);
  }

  /**
   * Get user's holdings from database
   */
  
  static async getUserHoldings(userEmail) {
    try {
      const [holdings] = await db.query(`
        SELECT 
          symbol,
          broker,
          quantity,
          average_price,
          current_price,
          ltp,
          pnl,
          pnl_percentage,
          product,
          exchange,
          isin,
          last_updated
        FROM User_Holdings
        WHERE user_email = ?
        ORDER BY pnl_percentage DESC
      `, [userEmail]);

      return holdings;
    } catch (error) {
      logger.error(`Error fetching holdings for ${userEmail}:`, error.message);
      return [];
    }
  }

  /**
   * Sleep utility
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test function - run immediately without waiting for cron
   */
  static async test(userEmail) {
    logger.info('🧪 Running test job for specific user...');
    
    try {
      TavilyService.initialize();
      AIInsightsService.initialize();
      EmailService.initialize();

      await this.processUserInsights(userEmail);
      
      logger.info('✅ Test completed');
    } catch (error) {
      logger.error('❌ Test failed:', error.message);
      throw error;
    }
  }
}