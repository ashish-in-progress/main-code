// ==================== src/controllers/fyers.controller.js ====================
import { getSessionId, setActiveBroker } from '../utils/helpers.js';
import { FyersService } from '../services/fyers/fyers.service.js';
import { logger } from '../utils/logger.js';

export class FyersController {
  static async connect(req, res) {
    const sessionId = getSessionId(req);

    try {
      const result = await FyersService.connect(sessionId);
      res.json(result);
    } catch (error) {
      logger.error('Fyers connect error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async login(req, res) {
    const sessionId = getSessionId(req);

    try {
      const result = await FyersService.login(sessionId);
      res.json(result);
    } catch (error) {
      logger.error('Fyers login error:', error.message);
      res.status(500).json({ success: false, error: error.message });
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
    const result = await FyersService.verifyAuth(sessionId, userEmail);  // 🆕 PASS EMAIL
    setActiveBroker(req, 'fyers');
    res.json(result);
  } catch (error) {
    logger.error('Fyers verify auth error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}
}