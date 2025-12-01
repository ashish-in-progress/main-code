// ==================== src/services/fyers/fyers.service.js ====================
import { FyersMCPClient } from './FyersMCPClient.js';
import { FyersLangChainAgent } from './FyersLangChainAgent.js';
import { fyersMcpClients, fyersAgents } from '../../state/store.js';
import { AZURE_CONFIG_FYERS } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

export class FyersService {
  static async connect(sessionId) {
    if (fyersMcpClients.has(sessionId) && fyersMcpClients.get(sessionId).isInitialized) {
      return {
        success: true,
        message: 'Already connected to Fyers',
        session_id: sessionId.substring(0, 8) + '...'
      };
    }

    const mcpClient = new FyersMCPClient(sessionId);
    fyersMcpClients.set(sessionId, mcpClient);

    await mcpClient.initialize();

    return {
      success: true,
      message: 'Connected to Fyers MCP',
      session_id: sessionId.substring(0, 8) + '...'
    };
  }

  static async login(sessionId) {
    if (!fyersMcpClients.has(sessionId)) {
      throw new Error('Not connected. Please connect first.');
    }

    const mcpClient = fyersMcpClients.get(sessionId);
    const loginResult = await mcpClient.callTool("login");
    const loginUrl = mcpClient.extractLoginUrl(loginResult);

    if (!loginUrl) {
      throw new Error('Could not extract login URL');
    }

    return { success: true, login_url: loginUrl };
  }
static async fetchAndSaveHoldings(sessionId, userEmail) {
  if (!fyersAgents.has(sessionId)) {
    throw new Error('Fyers agent not initialized');
  }

  const mcpClient = fyersMcpClients.get(sessionId);
  
  // Call holdings tool
  const holdingsResult = await mcpClient.callTool("get_holdings", {});
  
  // Extract JSON text from the structured content array (actual MCP response format)
  const holdingsText = holdingsResult.content?.[0]?.text || '';
  if (!holdingsText) {
    throw new Error('No holdings data received from Fyers');
  }
  
  console.log('Raw holdings response:', holdingsResult);
  
  // Parse holdings (Fyers returns JSON string)
  let holdingsData;
  try {
    holdingsData = JSON.parse(holdingsText);
  } catch (error) {
    logger.error('Failed to parse Fyers holdings:', error.message, holdingsText);
    throw new Error('Failed to parse holdings data');
  }

  // Save to database
  const db = (await import('../../config/db.js')).db;
  
  // Clear old holdings for this user/broker
  await db.query(
    'DELETE FROM User_Holdings WHERE user_email = ? AND broker = ?',
    [userEmail, 'fyers']
  );
  // Insert new holdings - Matches actual Fyers get_holdings response structure
  const holdings = holdingsData.holdings || [];
  for (const holding of holdings) {
    let raw =0 ;
       raw = (holdingsData.overall?.total_current_value -   holdingsData.overall?.total_pl)/holding.quantity;
       
    const invested_value = Math.round(raw * 100) / 100;
    console.log(holdingsData.overall?.total_current_value)
    console.log(holdingsData.overall?.total_current_value/holding.quantity)
    console.log(holdingsData.overall?.total_pl)
    await db.query(
      `INSERT INTO User_Holdings 
       (user_email, broker, symbol, quantity, average_price, current_price, 
        ltp, pnl, pnl_percentage, product, exchange, isin, raw_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userEmail,
        'fyers',
        holding.symbol || '',
        holding.quantity || 0,
        invested_value || 0,                    // ✅ Matches: "avgCost":0
        holding.ltp || 0,               // ✅ Matches: "currentValue":0  
        holding.ltp || 0,                        // ✅ Matches: "ltp":10.04
        holding.total_pl || 0,                        // ✅ Matches: "pnl":0
        holdingsData.overall?.pnl_perc || 0,     // ✅ Matches: "pnl_perc":0 (portfolio level)
        'CNC',                                   // Default (not in individual holding)
        holding.symbol?.split(':')[0] || 'NSE',  // ✅ Extracts "NSE" from "NSE:IDEA-EQ"
        '',                                      // isin not provided
        JSON.stringify(holding)
      ]
    );
  }

  logger.info(`Saved ${holdings.length} Fyers holdings for ${userEmail}`);
  
  return {
    success: true,
    count: holdings.length,
    holdings: holdingsData.holdings || [],
    overall: holdingsData.overall
  };
}


static async fetchAndSavePositions(sessionId, userEmail) {
  if (!fyersAgents.has(sessionId)) {
    throw new Error('Fyers agent not initialized');
  }

  const mcpClient = fyersMcpClients.get(sessionId);
  
  // Call positions tool
  const positionsResult = await mcpClient.callTool("get_positions", {});
  const positionsText = mcpClient.extractTextFromResult(positionsResult);
  
  console.log('Raw positions response:', positionsText);
  
  // Parse positions
  let positionsData;
  try {
    positionsData = JSON.parse(positionsText);
  } catch (error) {
    logger.error('Failed to parse Fyers positions:', error.message);
    throw new Error('Failed to parse positions data');
  }

  // Check if response is successful
  if (positionsData.s !== 'ok' || positionsData.code !== 200) {
    throw new Error(`Fyers API error: ${positionsData.message || 'Unknown error'}`);
  }

  // Save to database
  const db = (await import('../../config/db.js')).db;
  
  await db.query(
    'DELETE FROM User_Holdings WHERE user_email = ? AND broker = ? AND holding_type = ?',
    [userEmail, 'fyers', 'POSITION']
  );

  // Get positions from netPositions array
  const positions = positionsData.netPositions || [];
  
  console.log(`Processing ${positions.length} positions for ${userEmail}`);
  
  for (const position of positions) {
    // Skip positions with zero quantity
    if (!position.netQty || position.netQty === 0) {
      continue;
    }

    // Calculate P&L percentage
    const pnlPercentage = position.netAvg !== 0 
      ? ((position.ltp - position.netAvg) / position.netAvg) * 100 
      : 0;

    await db.query(
      `INSERT INTO User_Holdings 
       (user_email, broker, holding_type, symbol, quantity, average_price, current_price, 
        ltp, pnl, pnl_percentage, product, exchange, isin, raw_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userEmail,
        'fyers',
        'POSITION',
        position.symbol,                    // NSE:IDEA-EQ
        position.netQty,                    // 2
        position.netAvg,                    // 10.04
        position.ltp,                       // 10.03
        position.ltp,                       // 10.03
        position.pl,                        // -0.02
        pnlPercentage,                      // Calculated
        position.productType,               // CNC
        position.exchange === 10 ? 'NSE' : 'BSE', // Convert exchange code
        '',                                 // ISIN not provided
        JSON.stringify(position)
      ]
    );
  }

  logger.info(`Saved ${positions.length} Fyers positions for ${userEmail}`);
  
  return {
    success: true,
    count: positions.length,
    positions,
    overall: positionsData.overall
  };
}
  static async verifyAuth(sessionId, userEmail) {  // ADD userEmail parameter
  if (!fyersMcpClients.has(sessionId)) {
    throw new Error('Not connected');
  }

  const mcpClient = fyersMcpClients.get(sessionId);
  mcpClient.isAuthenticated = true;

  const agent = new FyersLangChainAgent(sessionId, AZURE_CONFIG_FYERS, mcpClient);
  await agent.initialize();

  fyersAgents.set(sessionId, agent);

  // 🆕 AUTO-FETCH HOLDINGS
  try {
    await this.fetchAndSaveHoldings(sessionId, userEmail);
  } catch (error) {
    logger.warn('Failed to auto-fetch Fyers holdings:', error.message);
    // Don't fail auth if holdings fetch fails
  }
try {
    await this.fetchAndSavePositions(sessionId, userEmail);
  } catch (error) {
    logger.warn('Failed to auto-fetch Fyers positions:', error.message);
  }
  return {
    success: true,
    authenticated: true,
    tools_count: agent.tools.length
  };
  }

  static async chat(sessionId, message) {
    if (!fyersAgents.has(sessionId)) {
      throw new Error('Fyers agent not initialized. Please authenticate first.');
    }

    const agent = fyersAgents.get(sessionId);
    const response = await agent.chat(message);

    return {
      success: true,
      response,
      broker: 'fyers',
      framework: 'LangChain.js'
    };
  }

  static resetConversation(sessionId) {
    if (fyersAgents.has(sessionId)) {
      fyersAgents.get(sessionId).resetConversation();
    }
  }

  static getConversationHistory(sessionId) {
    if (!fyersAgents.has(sessionId)) {
      return [];
    }

    const agent = fyersAgents.get(sessionId);
    return agent.conversationHistory.map(msg => ({
      role: msg._getType() === 'human' ? 'user' : 'assistant',
      content: msg.content
    }));
  }
}