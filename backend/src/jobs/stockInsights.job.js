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
      const tavilyReady = TavilyService.initialize();
      if (!tavilyReady) {
        logger.warn('⚠️ Tavily not available, continuing without news');
      }
      
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
    logger.info(`📊 Processing insights for ${userEmail}`);

    // 1. Fetch user's holdings from database
    const holdings = await this.getUserHoldings(userEmail);

    if (holdings.length === 0) {
      logger.warn(`No holdings found for ${userEmail}`);
      return;
    }

    logger.info(`Found ${holdings.length} holdings for ${userEmail}`);

    // 2. Get market sentiment (only once per user)
    let marketSentiment = null;
    try {
      marketSentiment = await TavilyService.getMarketSentiment();
    } catch (error) {
      logger.warn('Failed to fetch market sentiment:', error.message);
      marketSentiment = { summary: 'Market data unavailable', articles: [] };
    }

    // 3. Analyze each holding
    const analyzedHoldings = [];
    const uniqueSymbols = [...new Set(holdings.map(h => h.symbol))];

    logger.info(`Analyzing ${uniqueSymbols.length} unique symbols...`);

    for (const holding of holdings) {
      try {
        logger.info(`  📈 Analyzing ${holding.symbol}...`);

        // Get technical analysis from your API
        const technicalData = await TechnicalService.analyzeTechnicals(
          holding.symbol,
          holding.broker,
          holding.current_price
        );

        // Get company name for better news search
        const companyName = TavilyService.getCompanyName(holding.symbol);

        // Get latest news (with error handling)
        let news = [];
        try {
          news = await TavilyService.searchStockNews(holding.symbol, companyName, 3);
          if (news.length > 0) {
            logger.info(`    ✅ Found ${news.length} news articles`);
          } else {
            logger.warn(`    ⚠️ No news found for ${holding.symbol}`);
          }
        } catch (error) {
          logger.warn(`    ⚠️ News fetch failed for ${holding.symbol}:`, error.message);
          news = [];
        }

        // Generate AI insights
        let aiInsight;
        try {
          aiInsight = await AIInsightsService.generateStockInsight(
            holding,
            technicalData,
            news
          );
          logger.info(`    ✅ AI insight generated`);
        } catch (error) {
          logger.warn(`    ⚠️ AI insight generation failed:`, error.message);
          aiInsight = AIInsightsService.getFallbackInsight(holding, technicalData);
        }

        analyzedHoldings.push({
          ...holding,
          technical: technicalData,
          news: news,
          aiInsight: aiInsight
        });

        // Rate limiting: 2 seconds between stocks to avoid API limits
        await this.sleep(2000);

      } catch (error) {
        logger.error(`  ❌ Error analyzing ${holding.symbol}:`, error.message);
        
        // Add holding with basic info even if analysis fails
        analyzedHoldings.push({
          ...holding,
          technical: { 
            signal: 'HOLD', 
            reason: 'Technical analysis unavailable',
            strength: 'NEUTRAL'
          },
          news: [],
          aiInsight: `${holding.symbol}: Currently ${holding.pnl >= 0 ? 'in profit' : 'in loss'} at ${holding.pnl_percentage.toFixed(2)}%. Monitor closely.`
        });
      }
    }

    // 4. Generate overall portfolio summary
    logger.info('  📋 Generating portfolio summary...');
    let overallSummary;
    try {
      overallSummary = await AIInsightsService.generatePortfolioSummary(
        analyzedHoldings,
        marketSentiment
      );
    } catch (error) {
      logger.warn('Portfolio summary generation failed:', error.message);
      overallSummary = AIInsightsService.getFallbackPortfolioSummary(analyzedHoldings);
    }

    // 5. Prepare insights object
    const insights = {
      userEmail,
      date: new Date().toISOString(),
      holdings: analyzedHoldings,
      analysis: {
        totalHoldings: analyzedHoldings.length,
        totalPnL: analyzedHoldings.reduce((sum, h) => sum + (Number(h.pnl) || 0), 0),
        avgPnLPercent: analyzedHoldings.reduce((sum, h) => sum + (Number(h.pnl_percentage) || 0), 0) / analyzedHoldings.length,
        gainers: analyzedHoldings.filter(h => Number(h.pnl) > 0).length,
        losers: analyzedHoldings.filter(h => Number(h.pnl) < 0).length
      },
      overallSummary,
      marketSentiment: marketSentiment?.summary || 'Market data unavailable'
    };

    // 6. Send email
    logger.info('  📧 Sending email...');
    try {
      await EmailService.sendInsightsEmail(userEmail, insights);
      logger.info(`  ✅ Email sent to ${userEmail}`);
    } catch (error) {
      logger.error(`  ❌ Failed to send email to ${userEmail}:`, error.message);
    }

    logger.info(`✅ Insights completed for ${userEmail}`);
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
          holding_type,
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