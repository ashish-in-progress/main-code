import express from 'express';
import { JobScheduler } from '../jobs/scheduler.js';
import { StockInsightsJob } from '../jobs/stockInsights.job.js';
import { logger } from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/jobs/list
 * List all scheduled jobs
 */
router.get('/list', (req, res) => {
  try {
    const jobs = JobScheduler.listJobs();
    res.json({
      success: true,
      jobs
    });
  } catch (error) {
    logger.error('Error listing jobs:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/jobs/run-now
 * Manually trigger a job (for testing)
 */
router.post('/run-now', async (req, res) => {
  const { jobName } = req.body;

  if (!jobName) {
    return res.status(400).json({ 
      success: false, 
      error: 'Job name required' 
    });
  }

  try {
    logger.info(`Manual trigger: ${jobName}`);
    
    // Run job asynchronously
    JobScheduler.runNow(jobName).catch(error => {
      logger.error(`Job ${jobName} failed:`, error.message);
    });

    res.json({
      success: true,
      message: `Job ${jobName} triggered. Check logs for progress.`
    });
  } catch (error) {
    logger.error('Error running job:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/jobs/test-user
 * Test insights generation for specific user
 */
router.post('/test-user', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ 
      success: false, 
      error: 'User email required' 
    });
  }

  try {
    logger.info(`Testing insights for user: ${email}`);
    
    // Run test asynchronously
    StockInsightsJob.test(email).catch(error => {
      logger.error(`Test failed for ${email}:`, error.message);
    });

    res.json({
      success: true,
      message: `Insights generation started for ${email}. Check email and logs.`
    });
  } catch (error) {
    logger.error('Error testing user insights:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/jobs/schedule
 * Update cron schedule (requires restart)
 */
router.post('/schedule', (req, res) => {
  const { schedule } = req.body;

  if (!schedule) {
    return res.status(400).json({ 
      success: false, 
      error: 'Cron schedule required (e.g., "0 8 * * *")' 
    });
  }

  // Validate cron expression
  try {
    const cron = require('node-cron');
    if (!cron.validate(schedule)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid cron expression' 
      });
    }
  } catch (error) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid cron expression' 
    });
  }

  res.json({
    success: true,
    message: `To update schedule to "${schedule}", set INSIGHTS_CRON_SCHEDULE in .env and restart server.`,
    current_schedule: process.env.INSIGHTS_CRON_SCHEDULE || '0 8 * * *'
  });
});

export default router;