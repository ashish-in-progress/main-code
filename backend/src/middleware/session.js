// ==================== src/middleware/session.js ====================
import session from 'express-session';
import crypto from 'crypto';
import { IN_PROD } from '../config/constants.js';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export const sessionConfig = session({
  secret: SESSION_SECRET,
  name: 'unified_trading_session',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: IN_PROD,   // true when behind HTTPS in production
    sameSite: 'lax',
    path: '/'
  }
});

/**
 * Middleware to expose user on res.locals
 */
export function attachUser(req, res, next) {
  res.locals.user = req.session.user || null;
  next();
}