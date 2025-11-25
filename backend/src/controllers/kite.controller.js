import { getSessionId, setActiveBroker } from '../utils/helpers.js';
import { KiteService } from '../services/kite/kite.service.js';
import { logger } from '../utils/logger.js';

export class KiteController {
  static async login(req, res) {
    const sessionId = getSessionId(req);

    try {
      const result = await KiteService.login(sessionId);
      res.json(result);
    } catch (error) {
      logger.error('Kite login error:', error.message);
      
      const { kiteClients } = await import('../state/store.js');
      if (kiteClients.has(sessionId)) {
        const client = kiteClients.get(sessionId);
        client.cleanup();
      }
      
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Connection or login tool call failed'
      });
    }
  }

  static async verifyAuth(req, res) {
  const sessionId = getSessionId(req);
  const userEmail = req.session.user?.email;  // 🆕 GET USER EMAIL

  if (!userEmail) {
    return res.status(401).json({ 
      success: false, 
      error: 'User not logged in' 
    });
  }

  try {
    const result = await KiteService.verifyAuth(sessionId, userEmail);  // 🆕 PASS EMAIL
    
    if (result.success && result.authenticated) {
      setActiveBroker(req, 'kite');
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Kite verify auth error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

  static async getProfile(req, res) {
    const sessionId = getSessionId(req);
    
    try {
      const result = await KiteService.callTool(sessionId, "get_profile", {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message,
        content: [{ type: "text", text: `Error: ${error.message}` }]
      });
    }
  }

  static async getHoldings(req, res) {
    const sessionId = getSessionId(req);
    
    try {
      const result = await KiteService.callTool(sessionId, "get_holdings", {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message,
        content: [{ type: "text", text: `Error: ${error.message}` }]
      });
    }
  }

  static async getPositions(req, res) {
    const sessionId = getSessionId(req);
    
    try {
      const result = await KiteService.callTool(sessionId, "get_positions", {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message,
        content: [{ type: "text", text: `Error: ${error.message}` }]
      });
    }
  }

  static async getOrders(req, res) {
    const sessionId = getSessionId(req);
    
    try {
      const result = await KiteService.callTool(sessionId, "get_orders", {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message,
        content: [{ type: "text", text: `Error: ${error.message}` }]
      });
    }
  }

  static async getQuotes(req, res) {
    const sessionId = getSessionId(req);
    
    try {
      const result = await KiteService.callTool(sessionId, "get_quotes", req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message,
        content: [{ type: "text", text: `Error: ${error.message}` }]
      });
    }
  }

  static async getMargins(req, res) {
    const sessionId = getSessionId(req);
    
    try {
      const result = await KiteService.callTool(sessionId, "get_margins", {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message,
        content: [{ type: "text", text: `Error: ${error.message}` }]
      });
    }
  }
}