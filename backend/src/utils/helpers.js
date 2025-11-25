// ==================== src/utils/helpers.js ====================
import crypto from 'crypto';
import { logger } from './logger.js';

/**
 * Get or create session ID
 */
export function getSessionId(req) {
  if (!req.session.sessionId) {
    req.session.sessionId = crypto.randomBytes(16).toString('hex');
    logger.info(`Created new session: ${req.session.sessionId.substring(0, 8)}...`);
  }
  return req.session.sessionId;
}

/**
 * Get active broker from session
 */
export function getActiveBroker(req) {
  return req.session.activeBroker || 'fyers';
}

/**
 * Set active broker in session
 */
export function setActiveBroker(req, broker) {
  req.session.activeBroker = broker.toLowerCase();
  logger.info(`Active broker set to: ${broker}`);
  return broker.toLowerCase();
}

/**
 * Get authentication status for all brokers
 */
export function getBrokerStatus(req, { fyersMcpClients, kiteClients }) {
  const sessionId = getSessionId(req);
  
  return {
    fyers: {
      authenticated: fyersMcpClients.has(sessionId) && fyersMcpClients.get(sessionId).isAuthenticated,
      active: getActiveBroker(req) === 'fyers'
    },
    kite: {
      authenticated: kiteClients.has(sessionId) && kiteClients.get(sessionId).isAuthenticated,
      active: getActiveBroker(req) === 'kite'
    },
    upstox: {
      authenticated: !!req.session.upstoxAccessToken,
      active: getActiveBroker(req) === 'upstox'
    }
  };
}

/**
 * Extract text content from MCP tool result
 */
export function extractTextFromResult(toolResult) {
  if (!toolResult) return "";
  
  const content = toolResult.content || [];
  const textParts = content
    .filter(item => item.type === 'text')
    .map(item => item.text || '');
  
  return textParts.join('\n');
}

/**
 * Extract login URL from tool result text
 */
export function extractLoginUrl(toolResult) {
  const text = extractTextFromResult(toolResult);
  const match = text.match(/https:\/\/[^\s)]+/);
  return match ? match[0] : null;
}

/**
 * Generate next request ID
 */
export function createRequestIdGenerator() {
  let id = 1;
  return () => id++;
}