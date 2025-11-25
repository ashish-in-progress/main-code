import axios from 'axios';
import { UpstoxClient } from './UpstoxClient.js';
import { UpstoxLangChainAgent } from './UpstoxLangChainAgent.js';
import { upstoxClients, upstoxAgents } from '../../state/store.js';
import { UPSTOX_CONFIG, AZURE_CONFIG_KITE } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

export class UpstoxService {
  static getLoginUrl() {
    const params = new URLSearchParams({
      client_id: UPSTOX_CONFIG.apiKey,
      redirect_uri: UPSTOX_CONFIG.redirectUri,
      response_type: 'code'
    });

    const authUrl = `${UPSTOX_CONFIG.authUrl}?${params.toString()}`;
    
    return {
      success: true,
      auth_url: authUrl
    };
  }

 static async fetchAndSaveHoldings(sessionId, userEmail, req) {
  if (!upstoxClients.has(sessionId)) {
    const client = new UpstoxClient(req.session.upstoxAccessToken);
    upstoxClients.set(sessionId, client);
  }

  const client = upstoxClients.get(sessionId);
  const holdingsResult = await client.getHoldings();
  
  // Save to database
  const db = (await import('../../config/db.js')).db;
  
  await db.query(
    'DELETE FROM User_Holdings WHERE user_email = ? AND broker = ?',
    [userEmail, 'upstox']
  );

  const holdings = holdingsResult.data || [];
  for (const holding of holdings) {
    await db.query(
      `INSERT INTO User_Holdings 
       (user_email, broker, symbol, quantity, average_price, current_price, 
        ltp, pnl, pnl_percentage, product, exchange, isin, raw_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userEmail,
        'upstox',
        holding.trading_symbol || holding.symbol,
        holding.quantity || 0,
        holding.average_price || 0,
        holding.last_price || 0,
        holding.last_price || 0,
        holding.pnl || 0,
        holding.pnl_percentage || 0,
        holding.product || 'D',
        holding.exchange || 'NSE',
        holding.isin || '',
        JSON.stringify(holding)
      ]
    );
  }

  logger.info(`Saved ${holdings.length} Upstox holdings for ${userEmail}`);
  
  return {
    success: true,
    count: holdings.length,
    holdings
  };
}

  static async getProfile(sessionId, req) {
    if (!req.session.upstoxAccessToken) {
      throw new Error('Not authenticated with Upstox');
    }

    if (!upstoxClients.has(sessionId)) {
      const client = new UpstoxClient(req.session.upstoxAccessToken);
      upstoxClients.set(sessionId, client);
    }

    const client = upstoxClients.get(sessionId);
    const result = await client.getProfile();
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  static async getHoldings(sessionId, req) {
    if (!req.session.upstoxAccessToken) {
      throw new Error('Not authenticated with Upstox');
    }

    if (!upstoxClients.has(sessionId)) {
      const client = new UpstoxClient(req.session.upstoxAccessToken);
      upstoxClients.set(sessionId, client);
    }

    const client = upstoxClients.get(sessionId);
    const result = await client.getHoldings();
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
static async handleCallback(code, sessionId, req, userEmail) {  // ADD userEmail parameter
  if (!code) {
    throw new Error('Authorization code missing');
  }

  const tokenData = new URLSearchParams({
    code,
    client_id: UPSTOX_CONFIG.apiKey,
    client_secret: UPSTOX_CONFIG.apiSecret,
    redirect_uri: UPSTOX_CONFIG.redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await axios.post(
    UPSTOX_CONFIG.tokenUrl,
    tokenData.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    }
  );

  const accessToken = response.data.access_token;
  req.session.upstoxAccessToken = accessToken;
  
  const upstoxClient = new UpstoxClient(accessToken);
  upstoxClients.set(sessionId, upstoxClient);
  
  const agent = new UpstoxLangChainAgent(sessionId, AZURE_CONFIG_KITE, upstoxClient);
  await agent.initialize();
  upstoxAgents.set(sessionId, agent);

  // 🆕 AUTO-FETCH HOLDINGS
  try {
    await this.fetchAndSaveHoldings(sessionId, userEmail, req);
  } catch (error) {
    logger.warn('Failed to auto-fetch Upstox holdings:', error.message);
  }

  return {
    success: true,
    message: 'Upstox authentication successful'
  };
}
  static async getPositions(sessionId, req) {
    if (!req.session.upstoxAccessToken) {
      throw new Error('Not authenticated with Upstox');
    }

    if (!upstoxClients.has(sessionId)) {
      const client = new UpstoxClient(req.session.upstoxAccessToken);
      upstoxClients.set(sessionId, client);
    }

    const client = upstoxClients.get(sessionId);
    const result = await client.getPositions();
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  static async chat(sessionId, message) {
    if (!upstoxAgents.has(sessionId)) {
      throw new Error('Upstox agent not initialized. Please authenticate first.');
    }

    const agent = upstoxAgents.get(sessionId);
    const response = await agent.chat(message);

    return {
      success: true,
      response,
      broker: 'upstox',
      framework: 'LangChain.js'
    };
  }

  static resetConversation(sessionId) {
    if (upstoxAgents.has(sessionId)) {
      upstoxAgents.get(sessionId).resetConversation();
    }
  }

  static getConversationHistory(sessionId) {
    if (!upstoxAgents.has(sessionId)) {
      return [];
    }

    const agent = upstoxAgents.get(sessionId);
    return agent.conversationHistory.map(msg => ({
      role: msg._getType() === 'human' ? 'user' : 'assistant',
      content: msg.content
    }));
  }
}