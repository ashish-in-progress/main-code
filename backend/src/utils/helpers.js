// ==================== src/utils/helpers.js ====================
import crypto from 'crypto';
import { logger } from './logger.js';

/**
 * Get or create session ID
 */


/**
 * Get active broker from session
 */
export function getActiveBroker(req) {
  return req.session.activeBroker || 'fyers';
}

/**
 * Set active broker in session
 */

// helpers.js - ADD THIS EXPORT
export function getSessionId(req) {
  // 1. Try session header (preferred)
  let sessionId = req.headers['x-session-id'];
  
  // 2. Fallback to session storage
  if (!sessionId && req.session?.sessionId) {
    sessionId = req.session.sessionId;
  }
  
  // 3. Fallback to JWT user payload
  if (!sessionId && req.user) {
    // Query DB for user's sessionId
    return req.user.email; // Temporary - will be fixed
  }
  
  if (!sessionId) {
    throw new Error('No session ID found in request');
  }
  
  return sessionId;
}

export function setActiveBroker(req, broker) {
  if (req.session) {
    req.session.activeBroker = broker;
  }
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