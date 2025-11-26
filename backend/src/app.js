// ==================== src/app.js ====================
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { sessionConfig, attachUser } from './middleware/session.js';
import { CORS_ORIGINS } from './config/constants.js';
import { logger } from './utils/logger.js';
import jobsRoutes from './routes/jobs.routes.js';
// Import routes
import authRoutes from './routes/auth.routes.js';
import brokerRoutes from './routes/broker.routes.js';
import chatRoutes from './routes/chat.routes.js';
import fyersRoutes from './routes/fyers.routes.js';
import kiteRoutes from './routes/kite.routes.js';
import upstoxRoutes from './routes/upstox.routes.js';
import systemRoutes from './routes/system.routes.js';

// Import Upstox callback handler (special case - not under /api/upstox)
import { UpstoxController } from './controllers/upstox.controller.js';

// Create Express app
const app = express();

// ==================== MIDDLEWARE ====================

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// CORS configuration
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));

// Session middleware
app.use(sessionConfig);
app.use(attachUser);

// ==================== ROUTES ====================

// System routes (health check, stats)
app.use('/api', systemRoutes);
// Jobs routes (testing/management)
// Auth routes (no /api prefix for backward compatibility)
app.use('/', authRoutes);

// Broker management routes
app.use('/api/broker', brokerRoutes);

app.use('/api/jobs', jobsRoutes);
// Chat routes (unified for all brokers)
app.use('/api/chat', chatRoutes);

// Fyers routes
app.use('/api/fyers', fyersRoutes);

// Kite routes
app.use('/api/kite', kiteRoutes);

// Upstox routes
app.use('/api/upstox', upstoxRoutes);

// Special route for Upstox OAuth callback (outside /api/upstox)
app.get('/api/auth/callback', UpstoxController.handleCallback);

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

export default app;