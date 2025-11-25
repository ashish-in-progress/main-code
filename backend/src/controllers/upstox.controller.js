import { getSessionId, setActiveBroker } from '../utils/helpers.js';
import { UpstoxService } from '../services/upstox/upstox.service.js';
import { logger } from '../utils/logger.js';

export class UpstoxController {
  static getLogin(req, res) {
    try {
      const result = UpstoxService.getLoginUrl();
      res.json(result);
    } catch (error) {
      logger.error('Upstox login URL error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async handleCallback(req, res) {
  const { code } = req.query;
  const sessionId = getSessionId(req);
  const userEmail = req.session.user?.email;  // 🆕 GET USER EMAIL

  if (!code) {
    return res.redirect('http://localhost:5173?error=authorization_failed');
  }

  if (!userEmail) {
    return res.redirect('http://localhost:5173?error=not_logged_in');
  }

  try {
    await UpstoxService.handleCallback(code, sessionId, req, userEmail);  // 🆕 PASS EMAIL
    setActiveBroker(req, 'upstox');
    res.redirect('http://localhost:5173?login=success&broker=upstox');
  } catch (error) {
    logger.error('Upstox OAuth error:', error.message);
    res.redirect('http://localhost:5173?error=token_failed');
  }
}

  static async getProfile(req, res) {
    const sessionId = getSessionId(req);

    try {
      const result = await UpstoxService.getProfile(sessionId, req);
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
      const result = await UpstoxService.getHoldings(sessionId, req);
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
      const result = await UpstoxService.getPositions(sessionId, req);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message,
        content: [{ type: "text", text: `Error: ${error.message}` }]
      });
    }
  }
}