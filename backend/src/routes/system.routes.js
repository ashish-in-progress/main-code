// ==================== src/routes/system.routes.js ====================
import express from 'express';
import { getStoreStats } from '../state/store.js';
import { PORT } from '../config/constants.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'unified-trading-backend-langchain',
    port: PORT,
    brokers: ['fyers', 'kite', 'upstox'],
    framework: 'LangChain.js',
    timestamp: new Date().toISOString()
  });
});

// Statistics (optional - for monitoring)
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    stats: getStoreStats(),
    timestamp: new Date().toISOString()
  });
});

export default router;