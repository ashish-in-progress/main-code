import cron from 'node-cron';
import { StockInsightsJob } from './stockInsights.job.js';
import { logger } from '../utils/logger.js';

export class JobScheduler {
  static jobs = [];

  /**
   * Initialize and start all scheduled jobs
   */
  static start() {
    logger.info('🕐 Initializing job scheduler...');

    // Get schedule from environment or use default (8 AM daily)
    const schedule = process.env.INSIGHTS_CRON_SCHEDULE || '0 8 * * *';

    logger.info(`Stock Insights Job scheduled: ${schedule}`);

    // Schedule Stock Insights Job
    const insightsJob = cron.schedule(schedule, async () => {
      logger.info('⏰ Triggered: Stock Insights Job');
      try {
        await StockInsightsJob.execute();
      } catch (error) {
        logger.error('Stock Insights Job execution failed:', error.message);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata" // Indian timezone
    });

    this.jobs.push({
      name: 'Stock Insights Job',
      schedule,
      job: insightsJob
    });

    logger.info('✅ Job scheduler started successfully');
    this.printSchedule();
  }

  /**
   * Stop all scheduled jobs
   */
  static stop() {
    logger.info('Stopping all scheduled jobs...');
    
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info(`Stopped: ${name}`);
    });

    this.jobs = [];
    logger.info('✅ All jobs stopped');
  }

  /**
   * Print schedule information
   */
  static printSchedule() {
    logger.info('📋 Scheduled Jobs:');
    this.jobs.forEach(({ name, schedule }) => {
      logger.info(`  - ${name}: ${schedule}`);
    });
  }

  /**
   * Add a custom job dynamically
   */
  static addJob(name, schedule, taskFunction, timezone = "Asia/Kolkata") {
    logger.info(`Adding custom job: ${name} (${schedule})`);

    const job = cron.schedule(schedule, async () => {
      logger.info(`⏰ Triggered: ${name}`);
      try {
        await taskFunction();
      } catch (error) {
        logger.error(`${name} execution failed:`, error.message);
      }
    }, {
      scheduled: true,
      timezone
    });

    this.jobs.push({ name, schedule, job });
    logger.info(`✅ ${name} added successfully`);
  }

  /**
   * Run a job immediately (for testing)
   */
  static async runNow(jobName) {
    logger.info(`🧪 Running ${jobName} immediately...`);

    switch (jobName) {
      case 'stock-insights':
        await StockInsightsJob.execute();
        break;
      default:
        logger.error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * List all active jobs
   */
  static listJobs() {
    return this.jobs.map(({ name, schedule }) => ({
      name,
      schedule,
      nextRun: this.getNextRun(schedule)
    }));
  }

  /**
   * Get next run time for a cron expression
   */
  static getNextRun(cronExpression) {
    try {
      const job = cron.schedule(cronExpression, () => {});
      const next = job.nextDates(1);
      job.stop();
      return next ? next.toString() : 'Unknown';
    } catch (error) {
      return 'Invalid cron expression';
    }
  }
}

/**
 * Cron Expression Quick Reference:
 * 
 * Format: * * * * *
 *         │ │ │ │ │
 *         │ │ │ │ └─── Day of week (0-7, 0 and 7 are Sunday)
 *         │ │ │ └──── Month (1-12)
 *         │ │ └───── Day of month (1-31)
 *         │ └────── Hour (0-23)
 *         └─────── Minute (0-59)
 * 
 * Examples:
 * '0 8 * * *'       - Every day at 8:00 AM
 * '0 8,18 * * *'    - Every day at 8:00 AM and 6:00 PM
 * '0 8 * * 1-5'     - Every weekday at 8:00 AM
 * '30 9-17 * * *' - Every 30 minutes between 9 AM - 5 PM
 * '0 0 * * 0'       - Every Sunday at midnight
 * '0 12 1 * *'      - 12:00 PM on the 1st of every month
 **/