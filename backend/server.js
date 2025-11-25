// ==================== server.js ====================
import app from './src/app.js';
import { PORT } from './src/config/constants.js';
import { logger } from './src/utils/logger.js';
import { cleanupAll } from './src/state/store.js';
import dotenv from 'dotenv';
dotenv.config();
// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Unified Trading Backend with LangChain.js started on port ${PORT}`);
  logger.info(`📊 Supported brokers: Fyers, Kite, Upstox`);
  logger.info(`🤖 AI Framework: LangChain.js with Azure OpenAI`);
  logger.info(`🌐 CORS enabled for local development`);
  logger.info(`✅ Server is ready to accept connections`);
});
// ==================== GRACEFUL SHUTDOWN ====================

function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Cleanup all broker connections
    cleanupAll();
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});