    import { KiteMCPClient } from './KiteMCPClient.js';
import { KiteLangChainAgent } from './KiteLangChainAgent.js';
import { kiteClients, kiteAgents } from '../../state/store.js';
import { AZURE_CONFIG_KITE } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

export class KiteService {
  static async login(sessionId) {
    logger.info('🔐 Initiating Kite login...');
    
    let client;
    if (kiteClients.has(sessionId)) {
      client = kiteClients.get(sessionId);
      if (!client.connected) {
        client = new KiteMCPClient();
        client.sessionId = sessionId;
        kiteClients.set(sessionId, client);
      }
    } else {
      client = new KiteMCPClient();
      client.sessionId = sessionId;
      kiteClients.set(sessionId, client);
    }

    logger.info('⏳ Connecting to Kite MCP...');
    const connectPromise = client.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 15000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    logger.info('✅ Kite connected, calling login tool...');
    
    const loginPromise = client.callTool("login", {});
    const loginTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Login tool timeout')), 30000)
    );
    
    const result = await Promise.race([loginPromise, loginTimeout]);

    logger.info('📥 Kite login result received');

    if (result.content && result.content.length > 0) {
      const text = result.content[0].text || '';
      
      let loginUrl = null;
      
      const kiteMatch = text.match(/https:\/\/kite\.zerodha\.com\/connect\/login\?[^\s\)"\]<>]+/);
      if (kiteMatch) {
        loginUrl = kiteMatch[0];
      }
      
      if (!loginUrl) {
        const urlMatch = text.match(/https:\/\/[^\s\)"\]<>]+/);
        if (urlMatch) {
          loginUrl = urlMatch[0];
        }
      }
      
      if (!loginUrl && text.startsWith('https://')) {
        loginUrl = text.split(/[\s\)"\]<>]/)[0];
      }
      
      if (loginUrl) {
        loginUrl = loginUrl.replace(/[,;.!?\])\}]+$/, '').trim();
        
        logger.info('✅ Extracted Kite login URL:', loginUrl);
        
        return {
          success: true,
          login_url: loginUrl,
          message: 'Please complete login in the popup window, then click "I have completed login"'
        };
      }
      
      logger.warn('⚠️ Could not extract URL. Full response:', text);
      throw new Error('Could not extract login URL');
    }

    throw new Error('No content in login response');
  }
static async fetchAndSaveHoldings(sessionId, userEmail) {
  if (!kiteAgents.has(sessionId)) {
    throw new Error('Kite agent not initialized');
  }

  const client = kiteClients.get(sessionId);
  
  // Call holdings tool
  const holdingsResult = await client.callTool("get_holdings", {});
  const holdingsText = client.extractTextFromResult(holdingsResult);
  
  // Parse holdings
  let holdingsData;
  try {
    holdingsData = JSON.parse(holdingsText);
  } catch (error) {
    logger.error('Failed to parse Kite holdings:', error.message);
    throw new Error('Failed to parse holdings data');
  }

  // Save to database
  const db = (await import('../../config/db.js')).db;
  
  await db.query(
    'DELETE FROM User_Holdings WHERE user_email = ? AND broker = ?',
    [userEmail, 'kite']
  );

  const holdings = holdingsData.data || holdingsData.holdings || [];
  for (const holding of holdings) {
    await db.query(
      `INSERT INTO User_Holdings 
       (user_email, broker, symbol, quantity, average_price, current_price, 
        ltp, pnl, pnl_percentage, product, exchange, isin, raw_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userEmail,
        'kite',
        holding.tradingsymbol || holding.symbol,
        holding.quantity || 0,
        holding.average_price || 0,
        holding.last_price || 0,
        holding.last_price || 0,
        holding.pnl || 0,
        ((holding.pnl / (holding.average_price * holding.quantity)) * 100) || 0,
        holding.product || 'CNC',
        holding.exchange || 'NSE',
        holding.isin || '',
        JSON.stringify(holding)
      ]
    );
  }

  logger.info(`Saved ${holdings.length} Kite holdings for ${userEmail}`);
  
  return {
    success: true,
    count: holdings.length,
    holdings
  };
}
  static async verifyAuth(sessionId, userEmail) {  // ADD userEmail parameter
  if (!kiteClients.has(sessionId)) {
    throw new Error('Not connected to Kite');
  }

  const client = kiteClients.get(sessionId);
  
  if (!client.connected) {
    await client.connect();
  }

  logger.info('🔍 Verifying Kite authentication by calling get_profile...');
  
  const profileResult = await client.callTool("get_profile", {});
  
  if (profileResult.content && profileResult.content.length > 0) {
    const profileText = profileResult.content[0].text || '';
    logger.info('👤 Profile response:', profileText.substring(0, 200));
    
    if (profileText.includes('John Doe') || profileText.includes('john.doe')) {
      logger.warn('⚠️ Kite returned demo account - user not authenticated');
      return {
        success: false,
        authenticated: false,
        error: 'Not authenticated',
        message: 'Please complete the Kite login first.',
        is_demo: true
      };
    }
    
    logger.info('✅ Kite authentication verified - real user data received');
    client.isAuthenticated = true;
    
    const agent = new KiteLangChainAgent(sessionId, AZURE_CONFIG_KITE, client);
    await agent.initialize();
    kiteAgents.set(sessionId, agent);

    // 🆕 AUTO-FETCH HOLDINGS
    try {
      await this.fetchAndSaveHoldings(sessionId, userEmail);
    } catch (error) {
      logger.warn('Failed to auto-fetch Kite holdings:', error.message);
    }

    return {
      success: true,
      authenticated: true,
      message: 'Successfully authenticated with Kite',
      profile: profileText.substring(0, 200),
      tools_count: agent.tools.length
    };
  }

  throw new Error('No profile data received');
}

  static async callTool(sessionId, toolName, args = {}) {
    if (!kiteClients.has(sessionId)) {
      throw new Error('Not connected to Kite');
    }

    const client = kiteClients.get(sessionId);
    return await client.callTool(toolName, args);
  }

  static async chat(sessionId, message) {
    if (!kiteAgents.has(sessionId)) {
      throw new Error('Kite agent not initialized. Please authenticate first.');
    }

    const agent = kiteAgents.get(sessionId);
    const response = await agent.chat(message);

    return {
      success: true,
      response,
      broker: 'kite',
      framework: 'LangChain.js'
    };
  }

  static resetConversation(sessionId) {
    if (kiteAgents.has(sessionId)) {
      kiteAgents.get(sessionId).resetConversation();
    }
  }

  static getConversationHistory(sessionId) {
    if (!kiteAgents.has(sessionId)) {
      return [];
    }

    const agent = kiteAgents.get(sessionId);
    return agent.conversationHistory.map(msg => ({
      role: msg._getType() === 'human' ? 'user' : 'assistant',
      content: msg.content
    }));
  }
}