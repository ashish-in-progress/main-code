// ==================== src/state/store.js ====================
import { logger } from '../utils/logger.js';

/**
 * Global state management for all broker clients and agents
 */

// Fyers
export const fyersMcpClients = new Map();
export const fyersAgents = new Map();

// Kite
export const kiteClients = new Map();
export const kiteAgents = new Map();

// Upstox
export const upstoxClients = new Map();
export const upstoxAgents = new Map();

// Conversation histories (if needed separately)
export const conversationHistories = new Map();

/**
 * Cleanup function for a specific session
 */
export function cleanupSession(sessionId) {
  logger.info(`Cleaning up session: ${sessionId.substring(0, 8)}...`);
  
  // Cleanup Fyers
  if (fyersMcpClients.has(sessionId)) {
    fyersMcpClients.get(sessionId).cleanup();
  }
  fyersMcpClients.delete(sessionId);
  fyersAgents.delete(sessionId);
  
  // Cleanup Kite
  if (kiteClients.has(sessionId)) {
    kiteClients.get(sessionId).cleanup();
  }
  kiteClients.delete(sessionId);
  kiteAgents.delete(sessionId);
  
  // Cleanup Upstox
  upstoxClients.delete(sessionId);
  upstoxAgents.delete(sessionId);
  
  // Cleanup conversation history
  conversationHistories.delete(sessionId);
  
  logger.info(`Session cleaned up: ${sessionId.substring(0, 8)}...`);
}

/**
 * Cleanup specific broker for a session
 */
export function cleanupBroker(sessionId, broker) {
  logger.info(`Cleaning up ${broker} for session: ${sessionId.substring(0, 8)}...`);
  
  switch (broker.toLowerCase()) {
    case 'fyers':
      if (fyersMcpClients.has(sessionId)) {
        fyersMcpClients.get(sessionId).cleanup();
      }
      fyersMcpClients.delete(sessionId);
      fyersAgents.delete(sessionId);
      break;
      
    case 'kite':
      if (kiteClients.has(sessionId)) {
        kiteClients.get(sessionId).cleanup();
      }
      kiteClients.delete(sessionId);
      kiteAgents.delete(sessionId);
      break;
      
    case 'upstox':
      upstoxClients.delete(sessionId);
      upstoxAgents.delete(sessionId);
      break;
      
    default:
      logger.warn(`Unknown broker: ${broker}`);
  }
}

/**
 * Cleanup all sessions (on server shutdown)
 */
export function cleanupAll() {
  logger.info('Cleaning up all sessions...');
  
  // Cleanup all Fyers clients
  fyersMcpClients.forEach(client => client.cleanup());
  fyersMcpClients.clear();
  fyersAgents.clear();
  
  // Cleanup all Kite clients
  kiteClients.forEach(client => client.cleanup());
  kiteClients.clear();
  kiteAgents.clear();
  
  // Cleanup all Upstox
  upstoxClients.clear();
  upstoxAgents.clear();
  
  // Clear conversation histories
  conversationHistories.clear();
  
  logger.info('All sessions cleaned up');
}

/**
 * Get statistics about active sessions
 */
export function getStoreStats() {
  return {
    fyers: {
      clients: fyersMcpClients.size,
      agents: fyersAgents.size
    },
    kite: {
      clients: kiteClients.size,
      agents: kiteAgents.size
    },
    upstox: {
      clients: upstoxClients.size,
      agents: upstoxAgents.size
    },
    total_sessions: new Set([
      ...fyersMcpClients.keys(),
      ...kiteClients.keys(),
      ...upstoxClients.keys()
    ]).size
  };
}