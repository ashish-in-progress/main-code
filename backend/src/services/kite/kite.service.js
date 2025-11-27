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
static async parseJsonFromText(text) {
  /**
   * Try multiple heuristics to extract valid JSON from a noisy text string:
   * 1. Try direct JSON.parse(text).
   * 2. Strip common markdown code fences and try again.
   * 3. Find first '{' or '[' and then locate matching closing brace/bracket using a balance counter.
   * 4. If nothing works, throw an informative error.
   */
  if (!text || typeof text !== 'string') {
    throw new Error('No text to parse as JSON');
  }

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch (err) {
      return null;
    }
  };

  // 1) direct
  let parsed = tryParse(text);
  if (parsed !== null) return parsed;

  // 2) Remove triple/backtick fences and leading language labels like ```json
  const stripped = text.replace(/```[\s\S]*?```/g, (m) => {
    // if inside the fence is valid JSON try to return it; otherwise remove the fence
    const inner = m.replace(/^```[\w]*\n?/, '').replace(/```$/, '');
    const p = tryParse(inner);
    if (p !== null) return inner;
    return '';
  }).trim();

  parsed = tryParse(stripped);
  if (parsed !== null) return parsed;

  // 3) Locate first JSON-starting char and find the matching end by counting nest level
  const firstObj = Math.min(
    ...['{', '[']
      .map(ch => {
        const idx = stripped.indexOf(ch);
        return idx === -1 ? Infinity : idx;
      })
  );

  const rawToScan = firstObj === Infinity ? text : stripped;
  const startIdx = Math.min(
    ...['{', '[']
      .map(ch => {
        const idx = rawToScan.indexOf(ch);
        return idx === -1 ? Infinity : idx;
      })
  );

  if (startIdx === Infinity) {
    throw new Error('No JSON object/array start found in text');
  }

  const openChar = rawToScan[startIdx];
  const closeChar = openChar === '{' ? '}' : ']';

  // Find matching close using a stack counter
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < rawToScan.length; i++) {
    const c = rawToScan[i];
    if (c === openChar) depth++;
    else if (c === closeChar) depth--;

    if (depth === 0) {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    // fallback: try finding last closeChar in the full text
    const lastClose = rawToScan.lastIndexOf(closeChar);
    if (lastClose > startIdx) endIdx = lastClose;
  }

  if (endIdx === -1) {
    throw new Error('Unable to locate end of JSON in text');
  }

  const candidate = rawToScan.slice(startIdx, endIdx + 1);
  parsed = tryParse(candidate);
  if (parsed !== null) return parsed;

  // If we still can't parse, as a last resort, try repeatedly extracting {...} substrings and parse any that succeed
  const objMatches = rawToScan.match(/\{[\s\S]*?\}/g) || [];
  for (const m of objMatches) {
    const p = tryParse(m);
    if (p !== null) return p;
  }

  throw new Error('Failed to parse JSON from text (after multiple heuristics)');
}

static normalizeHoldingEntry(raw) {
  const n = raw || {};
  
  // Include t1_quantity in the quantity calculation
  const quantity = Number(n.quantity ?? n.net_quantity ?? n.used_quantity ?? 0) || 0;
  const t1_quantity = Number(n.t1_quantity ?? 0) || 0;
  const total_quantity = quantity + t1_quantity; // ✅ Total holdings including unsettled
  
  const average_price = Number(n.average_price ?? n.avg_price ?? n.avg ?? 0) || 0;
  const last_price = Number(n.last_price ?? n.last_trade_price ?? n.last_price) || 0;
  const pnl = Number(n.pnl ?? n.profit_loss ?? n.m2m ?? 0) || 0;

  const pnl_percentage = (average_price > 0 && total_quantity !== 0)
    ? (pnl / (average_price * Math.abs(total_quantity))) * 100
    : 0;

  return {
    tradingsymbol: n.tradingsymbol || n.symbol || '',
    exchange: n.exchange || 'NSE',
    quantity: total_quantity, // ✅ Use total quantity
    average_price,
    last_price,
    ltp: last_price,
    pnl,
    pnl_percentage,
    product: n.product || 'CNC',
    isin: n.isin || '',
    raw: n
  };
}

static async fetchAndSaveHoldings(sessionId, userEmail) {
  logger.info('🔁 fetchAndSaveHoldings started for', userEmail, 'session:', sessionId);

  if (!kiteAgents.has(sessionId)) {
    throw new Error('Kite agent not initialized');
  }
  if (!kiteClients.has(sessionId)) {
    throw new Error('Kite client not available/connected');
  }

  const client = kiteClients.get(sessionId);

  // 1) call tool
  let holdingsResult;
  try {
    holdingsResult = await client.callTool("get_holdings", {});
    console.log(holdingsResult)
  } catch (err) {
    logger.error('Error calling get_holdings tool:', err.message);
    throw new Error('Failed to call get_holdings tool: ' + err.message);
  }

  // 2) extract textual body safely using client's helper if available, else fallback
  let holdingsText = '';
  try {
    if (typeof client.extractTextFromResult === 'function') {
      holdingsText = client.extractTextFromResult(holdingsResult);
    } else if (holdingsResult && holdingsResult.content && holdingsResult.content.length > 0) {
      holdingsText = holdingsResult.content.map(c => c.text || '').join('\n');
    } else if (typeof holdingsResult === 'string') {
      holdingsText = holdingsResult;
    } else {
      holdingsText = JSON.stringify(holdingsResult);
    }
  } catch (err) {
    logger.warn('Could not use client.extractTextFromResult(), falling back. Error:', err.message);
    holdingsText = JSON.stringify(holdingsResult);
  }

  if (!holdingsText || holdingsText.trim().length === 0) {
    throw new Error('No content returned from get_holdings tool');
  }

  // 3) parse JSON using robust helper
  let parsed;
  try {
    parsed = await this.parseJsonFromText(holdingsText);
  } catch (err) {
    logger.error('Failed to parse holdings text into JSON:', err.message);
    logger.debug('holdingsText (first 1000 chars):', holdingsText.slice(0, 1000));
    throw new Error('Failed to parse holdings JSON: ' + err.message);
  }

  // 4) normalize list extraction: accept array, or object wrappers
  let holdingsArray = [];
  if (Array.isArray(parsed)) {
    holdingsArray = parsed;
  } else if (Array.isArray(parsed.data)) {
    holdingsArray = parsed.data;
  } else if (Array.isArray(parsed.holdings)) {
    holdingsArray = parsed.holdings;
  } else if (parsed.net && Array.isArray(parsed.net)) {
    holdingsArray = parsed.net;
  } else {
    // If parsed is an object but not an array, try best-effort to collect object values that are arrays
    const arrCandidates = Object.values(parsed).filter(v => Array.isArray(v));
    if (arrCandidates.length > 0) {
      holdingsArray = arrCandidates[0];
      logger.warn('Found array inside parsed object and using that as holdings');
    } else {
      // last resort: if parsed looks like a single holding object, wrap into array
      if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        holdingsArray = [parsed];
        logger.warn('Parsed single object and wrapping into array for processing');
      } else {
        logger.warn('Unexpected holdings format after parsing:', parsed);
        holdingsArray = [];
      }
    }
  }

  // 5) Transform / normalize entries
  const normalized = holdingsArray.map(h => this.normalizeHoldingEntry(h));

  // Filter out zero-quantity holdings (optional; you may change this behavior)
  const toSave = normalized.filter(h => h.quantity !== 0);

  // 6) Save to DB: clear old and insert new
  const db = (await import('../../config/db.js')).db;

  try {
    await db.query('DELETE FROM User_Holdings WHERE user_email = ? AND broker = ?', [userEmail, 'kite']);
  } catch (err) {
    logger.error('Failed to delete old holdings for user:', err.message);
    // proceed — but surface the error to logs
  }

  // Insert rows one-by-one (keeps things simple). If your db supports transactions, you can wrap in one.
  let savedCount = 0;
  const savedRows = [];
  for (const h of toSave) {
    try {
      await db.query(
        `INSERT INTO User_Holdings 
         (user_email, broker, symbol, quantity, average_price, current_price, 
          ltp, pnl, pnl_percentage, product, exchange, isin, raw_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userEmail,
          'kite',
          h.tradingsymbol,
          h.quantity,
          h.average_price,
          h.last_price,
          h.ltp,
          h.pnl,
          h.pnl_percentage,
          h.product,
          h.exchange,
          h.isin,
          JSON.stringify(h.raw)
        ]
      );
      savedCount++;
      savedRows.push(h);
    } catch (err) {
      logger.warn(`Failed to insert holding ${h.tradingsymbol} for ${userEmail}: ${err.message}`);
      // continue inserting the rest
    }
  }

  logger.info(`Saved ${savedCount} Kite holdings for ${userEmail} (attempted ${toSave.length})`);

  return {
    success: true,
    count: savedCount,
    attempted: toSave.length,
    holdings: savedRows
  };
}
static async fetchAndSavePositions(sessionId, userEmail) {
  if (!kiteAgents.has(sessionId)) {
    throw new Error('Kite agent not initialized');
  }

  const client = kiteClients.get(sessionId);
  
  // Call positions tool
  const positionsResult = await client.callTool("get_positions", {});
  console.log('Raw positions result:', positionsResult);
  const positionsText = client.extractTextFromResult(positionsResult);
  console.log('Extracted text:', positionsText);
  
  // Parse positions
  let positionsData;
  try {
    positionsData = JSON.parse(positionsText);
    console.log('Parsed positions data:', positionsData);
  } catch (error) {
    logger.error('Failed to parse Kite positions:', error.message);
    throw new Error('Failed to parse positions data');
  }

  // Save to database
  const db = (await import('../../config/db.js')).db;
  
  // Clear old positions for this user/broker
  await db.query(
    'DELETE FROM User_Holdings WHERE user_email = ? AND broker = ? AND holding_type = ?',
    [userEmail, 'kite', 'POSITION']
  );

  // Handle different response formats:
  // 1. Direct array: [{...}, {...}]
  // 2. Object with net: {net: [{...}]}
  // 3. Object with data.net: {data: {net: [{...}]}}
  let positions;
  if (Array.isArray(positionsData)) {
    positions = positionsData;  // Direct array
  } else if (positionsData.net && Array.isArray(positionsData.net)) {
    positions = positionsData.net;
  } else if (positionsData.data?.net && Array.isArray(positionsData.data.net)) {
    positions = positionsData.data.net;
  } else {
    positions = [];
    logger.warn('Unexpected positions data format:', positionsData);
  }

  console.log(`Found ${positions.length} positions before deduplication`);
  
  // Deduplicate positions by creating a map with unique keys
  const uniquePositions = new Map();
  for (const position of positions) {
    const key = `${position.tradingsymbol}-${position.exchange}-${position.product}`;
    
    // Skip if quantity is 0 (closed position)
    if (!position.quantity || position.quantity === 0) {
      continue;
    }
    
    // Keep first occurrence
    if (!uniquePositions.has(key)) {
      uniquePositions.set(key, position);
    }
  }

  const uniquePositionsArray = Array.from(uniquePositions.values());
  console.log(`Saving ${uniquePositionsArray.length} unique positions after deduplication`);
  
  for (const position of uniquePositionsArray) {
    // Determine holding type: CNC with overnight_quantity = 0 means it's a holding
    const holdingType = position.product === 'CNC' && position.overnight_quantity === 0 
      ? 'HOLDING' 
      : 'POSITION';

    // Calculate PnL percentage
    const pnlPercentage = position.average_price > 0 && position.quantity !== 0
      ? ((position.pnl / (position.average_price * Math.abs(position.quantity))) * 100) 
      : 0;

    await db.query(
      `INSERT INTO User_Holdings 
       (user_email, broker, holding_type, symbol, quantity, average_price, current_price, 
        ltp, pnl, pnl_percentage, product, exchange, isin, raw_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userEmail,
        'kite',
        holdingType,
        position.tradingsymbol || position.symbol,
        position.quantity || 0,
        position.average_price || 0,
        position.last_price || 0,
        position.last_price || 0,
        position.pnl || position.m2m || 0,
        pnlPercentage,
        position.product || 'MIS',
        position.exchange || 'NSE',
        '',
        JSON.stringify(position)
      ]
    );
  }

  logger.info(`Saved ${uniquePositionsArray.length} unique Kite positions/holdings for ${userEmail}`);
  
  return {
    success: true,
    count: uniquePositionsArray.length,
    positions: uniquePositionsArray
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
 try {
    await this.fetchAndSavePositions(sessionId, userEmail);
  } catch (error) {
    logger.warn('Failed to auto-fetch Kite positions:', error.message);
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