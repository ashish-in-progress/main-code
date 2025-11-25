// ==================== src/controllers/chat.controller.js ====================
import { getSessionId, getActiveBroker } from '../utils/helpers.js';
import { FyersService } from '../services/fyers/fyers.service.js';
import { KiteService } from '../services/kite/kite.service.js';
import { UpstoxService } from '../services/upstox/upstox.service.js';
import { logger } from '../utils/logger.js';

export class ChatController {
  static async chat(req, res) {
    const sessionId = getSessionId(req);
    const activeBroker = getActiveBroker(req);
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'No message provided' });
    }

    try {
      let result;

      switch (activeBroker) {
        case 'fyers':
          result = await FyersService.chat(sessionId, message);
          break;
          
        case 'kite':
          result = await KiteService.chat(sessionId, message);
          break;
          
        case 'upstox':
          result = await UpstoxService.chat(sessionId, message);
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid or no active broker selected'
          });
      }

      res.json(result);
    } catch (error) {
      logger.error('Chat error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static resetConversation(req, res) {
    const sessionId = getSessionId(req);
    const activeBroker = getActiveBroker(req);

    try {
      switch (activeBroker) {
        case 'fyers':
          FyersService.resetConversation(sessionId);
          break;
        case 'kite':
          KiteService.resetConversation(sessionId);
          break;
        case 'upstox':
          UpstoxService.resetConversation(sessionId);
          break;
      }

      res.json({
        success: true,
        message: `Conversation reset for ${activeBroker}`
      });
    } catch (error) {
      logger.error('Reset error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static getHistory(req, res) {
    const sessionId = getSessionId(req);
    const activeBroker = getActiveBroker(req);

    try {
      let history = [];

      switch (activeBroker) {
        case 'fyers':
          history = FyersService.getConversationHistory(sessionId);
          break;
        case 'kite':
          history = KiteService.getConversationHistory(sessionId);
          break;
        case 'upstox':
          history = UpstoxService.getConversationHistory(sessionId);
          break;
      }

      res.json({
        success: true,
        broker: activeBroker,
        history,
        message_count: history.length,
        max_messages: 10
      });
    } catch (error) {
      logger.error('History fetch error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}