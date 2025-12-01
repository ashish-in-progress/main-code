// ==================== src/controllers/broker.controller.js ====================
import { getSessionId, getActiveBroker, setActiveBroker, getBrokerStatus } from '../utils/helpers.js';
import { fyersMcpClients, kiteClients } from '../state/store.js';
import { cleanupSession, cleanupBroker } from '../state/store.js';
import { logger } from '../utils/logger.js';

export class BrokerController {
  static getStatus(req, res) {
    res.json({
      session_id: getSessionId(req).substring(0, 8) + '...',
      active_broker: getActiveBroker(req),
      brokers: getBrokerStatus(req, { fyersMcpClients, kiteClients })
    });
  }
static async getHoldings(req, res) {
  const userEmail = req.session.user?.email;
  const { broker } = req.query; // Optional: filter by broker

  if (!userEmail) {
    return res.status(401).json({ 
      success: false, 
      error: 'Not logged in' 
    });
  }

  try {
    const { db } = await import('../config/db.js');
    
    let query = 'SELECT * FROM User_Holdings WHERE user_email = ?';
    const params = [userEmail];

    if (broker && ['fyers', 'kite', 'upstox'].includes(broker)) {
      query += ' AND broker = ?';
      params.push(broker);
    }

    query += ' ORDER BY last_updated DESC';

    const [holdings] = await db.query(query, params);

    res.json({
      success: true,
      count: holdings.length,
      holdings
    });
  } catch (error) {
    logger.error('Get holdings error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}
  static selectBroker(req, res) {
    const { broker } = req.body;

    if (!['fyers', 'kite', 'upstox'].includes(broker?.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Invalid broker' });
    }

    const brokerStatus = getBrokerStatus(req, { fyersMcpClients, kiteClients });

    if (!brokerStatus[broker.toLowerCase()].authenticated) {
      return res.json({
        success: false,
        status: 'need_auth',
        message: `Please login to ${broker.toUpperCase()} first`,
        broker: broker.toLowerCase()
      });
    }

    setActiveBroker(req, broker);

    res.json({
      success: true,
      active_broker: broker.toLowerCase(),
      message: `Switched to ${broker.toUpperCase()}`,
      brokers: getBrokerStatus(req, { fyersMcpClients, kiteClients })
    });
  }

// broker.controller.js - FIXED LOGOUT (FULL METHOD)
static async logout(req, res) {
  const { broker } = req.body;  // 'fyers', 'kite', 'upstox', 'all'
  const sessionId = getSessionId(req);
  
  try {
    if (broker === 'all') {
      // Broker logout only - DON'T destroy session
      cleanupSession(sessionId);
      res.json({ 
        success: true, 
        message: 'Logged out from all brokers' 
      });
    } else if (['fyers', 'kite', 'upstox'].includes(broker)) {
      cleanupBroker(sessionId, broker);
      res.json({ 
        success: true, 
        message: `Logged out from ${broker}` 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid broker specified' 
      });
    }
  } catch (error) {
    logger.error('Logout error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}


  static getSessionInfo(req, res) {
    const sessionId = getSessionId(req);

    res.json({
      session_id: sessionId.substring(0, 8) + '...',
      active_broker: getActiveBroker(req),
      brokers: getBrokerStatus(req, { fyersMcpClients, kiteClients }),
      fyers_connected: fyersMcpClients.has(sessionId) && fyersMcpClients.get(sessionId).isInitialized,
      kite_connected: kiteClients.has(sessionId) && kiteClients.get(sessionId).connected,
      upstox_connected: !!req.session.upstoxAccessToken,
      fyers_agent_ready: require('../state/store.js').fyersAgents.has(sessionId),
      kite_agent_ready: require('../state/store.js').kiteAgents.has(sessionId),
      upstox_agent_ready: require('../state/store.js').upstoxAgents.has(sessionId)
    });
  }
}