#!/usr/bin/env node

/**
 * Unified Trading Backend - Node.js/Express
 * 
 * Endpoints:
 * - /api/fyers/* - Fyers MCP endpoints
 * - /api/kite/* - Kite MCP endpoints  
 * - /api/upstox/* - Upstox direct API endpoints
 * - /api/chat - Unified AI chat (works with active broker)
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { Client: MCPClient } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const { AzureOpenAI } = require('openai');

// ==================== LOGGING ====================
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - ${level.toUpperCase()} - ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// ==================== EXPRESS APP ====================
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionMiddleware = session({
  store: new FileStore({
    path: './sessions',
    ttl: 604800 // 7 days
  }),
  secret: process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  name: 'unified_trading_session',
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax'
  }
});

app.use(sessionMiddleware);

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://33trpk9t-5173.inc1.devtunnels.ms'
  ],
  credentials: true
}));

// ==================== CONFIGURATION ====================

// Fyers Azure OpenAI
const AZURE_CONFIG_FYERS = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT ,
  apiKey: process.env.AZURE_OPENAI_API_KEY ,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'o3-mini',
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview'
};

// Kite/Upstox Azure OpenAI
const AZURE_CONFIG_KITE = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY ,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION
};

// Upstox OAuth
const UPSTOX_CONFIG = {
  apiKey: process.env.UPSTOX_API_KEY,
  apiSecret: process.env.UPSTOX_API_SECRET,
  redirectUri: 'http://localhost:5000/api/auth/callback'
};

const UPSTOX_AUTH_URL = 'https://api.upstox.com/v2/login/authorization/dialog';
const UPSTOX_TOKEN_URL = 'https://api.upstox.com/v2/login/authorization/token';

// Global storage
const fyersMcpClients = new Map();
const fyersAgents = new Map();
const kiteClients = new Map();
const upstoxClients = new Map();
const conversationHistories = new Map();

let kiteLLM = null;
const kiteAgentExecutors = new Map();

// ==================== SESSION MANAGEMENT ====================

function getSessionId(req) {
  if (!req.session.sessionId) {
    req.session.sessionId = crypto.randomBytes(16).toString('hex');
    logger.info(`Created new session: ${req.session.sessionId.substring(0, 8)}...`);
  }
  return req.session.sessionId;
}

function getActiveBroker(req) {
  return req.session.activeBroker || 'fyers';
}

function setActiveBroker(req, broker) {
  req.session.activeBroker = broker.toLowerCase();
  logger.info(`Active broker set to: ${broker}`);
  return broker.toLowerCase();
}

function getBrokerStatus(req) {
  const sessionId = getSessionId(req);
  const activeBroker = getActiveBroker(req);
  
  return {
    fyers: {
      authenticated: fyersMcpClients.has(sessionId) && fyersMcpClients.get(sessionId).isAuthenticated,
      active: activeBroker === 'fyers'
    },
    kite: {
      authenticated: kiteClients.has(sessionId) && kiteClients.get(sessionId).connected,
      active: activeBroker === 'kite'
    },
    upstox: {
      authenticated: !!req.session.upstoxAccessToken,
      active: activeBroker === 'upstox'
    }
  };
}

// ==================== FYERS MCP CLIENT ====================

class FyersMCPClient {
  constructor(sessionId, mcpUrl = 'https://mcp.fyers.in/mcp') {
    this.sessionId = sessionId;
    this.mcpUrl = mcpUrl;
    this.mcpSessionId = null;
    this.headers = { 'Content-Type': 'application/json' };
    this.requestId = 1;
    this.toolsCache = [];
    this.isAuthenticated = false;
    this.isInitialized = false;
    logger.info(`Created FyersMCPClient for session: ${sessionId.substring(0, 8)}...`);
  }

  async initialize() {
    if (this.isInitialized) return;
    
    logger.info('Initializing Fyers MCP connection...');
    
    const initializeRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'unified-trading-client',
          version: '1.0.0'
        }
      }
    };
    
    try {
      const response = await axios.post(this.mcpUrl, initializeRequest, {
        headers: this.headers
      });
      
      this.mcpSessionId = response.headers['mcp-session-id'];
      logger.info(`Fyers MCP connected. Session ID: ${this.mcpSessionId}`);
      
      if (this.mcpSessionId) {
        this.headers['Mcp-Session-Id'] = this.mcpSessionId;
      }
      
      const initializedNotification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      };
      
      await axios.post(this.mcpUrl, initializedNotification, {
        headers: this.headers
      });
      
      logger.info('Fyers MCP initialized successfully');
      this.isInitialized = true;
      
    } catch (error) {
      logger.error(`Error initializing Fyers MCP: ${error.message}`);
      throw error;
    }
  }

  getNextRequestId() {
    return this.requestId++;
  }

  async listTools() {
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/list',
      params: {}
    };
    
    try {
      const response = await axios.post(this.mcpUrl, listToolsRequest, {
        headers: this.headers
      });
      
      const tools = response.data?.result?.tools || [];
      this.toolsCache = tools;
      logger.info(`Found ${tools.length} Fyers tools`);
      return tools;
      
    } catch (error) {
      logger.error(`Error listing Fyers tools: ${error.message}`);
      return [];
    }
  }

  async callTool(toolName, args = {}) {
    logger.info(`Calling Fyers tool: ${toolName}`);
    
    const callToolRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    try {
      const response = await axios.post(this.mcpUrl, callToolRequest, {
        headers: this.headers
      });
      
      if (response.data.error) {
        logger.error(`Fyers tool error: ${JSON.stringify(response.data.error)}`);
        return null;
      }
      
      return response.data.result || {};
      
    } catch (error) {
      logger.error(`Exception calling Fyers tool: ${error.message}`);
      return null;
    }
  }

  extractTextFromResult(toolResult) {
    if (!toolResult) return '';
    
    const content = toolResult.content || [];
    const textParts = content
      .filter(item => item.type === 'text')
      .map(item => item.text || '');
    
    return textParts.join('\n');
  }

  extractLoginUrl(toolResult) {
    const text = this.extractTextFromResult(toolResult);
    const match = text.match(/https:\/\/[^\s)]+/);
    return match ? match[0] : null;
  }
}

// ==================== FYERS AI AGENT ====================

class AzureOpenAIFyersAgent {
  constructor(sessionId, config) {
    this.sessionId = sessionId;
    this.client = new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      apiVersion: config.apiVersion,
      deployment: config.deployment
    });
    this.deployment = config.deployment;
    this.mcpClient = null;
    this.conversationHistory = [];
    this.availableTools = [];
    logger.info(`Created Fyers AI Agent for session: ${sessionId.substring(0, 8)}...`);
  }

  fixArraySchema(schema) {
    if (typeof schema !== 'object' || schema === null) return schema;
    
    if (schema.type === 'array' && !schema.items) {
      schema.items = { type: 'string' };
    }
    
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        schema.properties[key] = this.fixArraySchema(value);
      }
    }
    
    if (schema.items) {
      schema.items = this.fixArraySchema(schema.items);
    }
    
    return schema;
  }

  convertMcpToolsToOpenAIFormat(mcpTools) {
    return mcpTools.map(tool => {
      const inputSchema = tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      };
      
      const fixedSchema = this.fixArraySchema(JSON.parse(JSON.stringify(inputSchema)));
      
      return {
        type: 'function',
        function: {
          name: tool.name || '',
          description: tool.description || '',
          parameters: fixedSchema
        }
      };
    });
  }

  async initialize(mcpClient) {
    this.mcpClient = mcpClient;
    const mcpTools = await this.mcpClient.listTools();
    this.availableTools = this.convertMcpToolsToOpenAIFormat(mcpTools);
    logger.info(`Fyers agent initialized with ${this.availableTools.length} tools`);
  }

  async chat(userMessage, maxIterations = 5) {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });
    
    let iteration = 0;
    
    while (iteration < maxIterations) {
      iteration++;
      
      try {
        const response = await this.client.chat.completions.create({
          model: this.deployment,
          messages: this.conversationHistory,
          tools: this.availableTools,
          tool_choice: 'auto'
        });
        
        const assistantMessage = response.choices[0].message;
        
        const messageDict = {
          role: 'assistant',
          content: assistantMessage.content
        };
        
        if (assistantMessage.tool_calls) {
          messageDict.tool_calls = assistantMessage.tool_calls.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments
            }
          }));
        }
        
        this.conversationHistory.push(messageDict);
        
        if (!assistantMessage.tool_calls) {
          return assistantMessage.content || 'No response generated.';
        }
        
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          
          let functionArgs = {};
          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            // Keep empty object
          }
          
          const toolResultRaw = await this.mcpClient.callTool(functionName, functionArgs);
          const toolResult = this.mcpClient.extractTextFromResult(toolResultRaw);
          
          this.conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult || 'Tool executed successfully.'
          });
        }
        
      } catch (error) {
        logger.error(`Error in Fyers chat: ${error.message}`);
        return `Error: ${error.message}`;
      }
    }
    
    return 'Maximum iterations reached.';
  }

  resetConversation() {
    this.conversationHistory = [];
  }
}

// ==================== KITE MCP CLIENT ====================

class KiteMCPClient {
  constructor(sseUrl = 'https://mcp.kite.trade/sse') {
    this.sseUrl = sseUrl;
    this.session = null;
    this.connected = false;
    this.sessionId = null;
  }

  async connect() {
    if (this.connected) return true;
    
    try {
      const transport = new SSEClientTransport(new URL(this.sseUrl));
      this.session = new MCPClient({
        name: 'kite-trading-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });
      
      await this.session.connect(transport);
      this.connected = true;
      logger.info(`Kite MCP connected for session: ${this.sessionId?.substring(0, 8)}...`);
      return true;
    } catch (error) {
      logger.error(`Kite connection error: ${error.message}`);
      return false;
    }
  }

  async callTool(toolName, args = {}) {
    if (!this.connected) {
      await this.connect();
    }
    
    try {
      logger.info(`Calling Kite tool: ${toolName}`);
      
      const result = await this.session.callTool({
        name: toolName,
        arguments: args
      });
      
      const response = { content: [] };
      
      if (result.content && result.content.length > 0) {
        for (const contentItem of result.content) {
          let textValue = contentItem.text || contentItem.data || contentItem.value || 
                         contentItem.result || JSON.stringify(contentItem);
          
          response.content.push({
            type: 'text',
            text: typeof textValue === 'string' ? textValue : JSON.stringify(textValue)
          });
        }
      } else {
        response.content.push({
          type: 'text',
          text: JSON.stringify(result)
        });
      }
      
      return response;
      
    } catch (error) {
      const errorMsg = error.message;
      logger.error(`Kite tool error: ${errorMsg}`);
      return {
        error: errorMsg,
        content: [{ type: 'text', text: `Error: ${errorMsg}` }]
      };
    }
  }
}

// ==================== UPSTOX CLIENT ====================

class UpstoxClient {
  static BASE_URL = 'https://api.upstox.com/v2';
  
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.connected = true;
  }

  async request(method, endpoint, data = null) {
    const config = {
      method,
      url: `${UpstoxClient.BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      },
      timeout: 30000
    };
    
    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }
    
    const response = await axios(config);
    return response.data;
  }

  async getProfile() {
    return await this.request('GET', '/user/profile');
  }

  async getHoldings() {
    return await this.request('GET', '/portfolio/long-term-holdings');
  }

  async getPositions() {
    return await this.request('GET', '/portfolio/short-term-positions');
  }

  async getFunds() {
    return await this.request('GET', '/user/get-funds-and-margin');
  }

  async searchInstruments(query) {
    return await this.request('GET', '/search/instruments', { query });
  }

  async getMarketQuote(instruments) {
    const upstoxInstruments = instruments.map(inst => {
      if (inst.includes(':')) {
        const [exchange, symbol] = inst.split(':');
        return `${exchange}_EQ|${symbol}`;
      }
      return `NSE_EQ|${inst}`;
    });
    
    return await this.request('GET', '/market-quote/quotes', {
      instrument_key: upstoxInstruments.join(',')
    });
  }
}

// ==================== HELPER FUNCTIONS ====================

function callBrokerToolSync(req, toolName, args = {}) {
  const sessionId = getSessionId(req);
  const brokerType = getActiveBroker(req);
  
  if (brokerType === 'kite') {
    return callKiteToolSync(sessionId, toolName, args);
  } else if (brokerType === 'upstox') {
    return callUpstoxToolSync(req, sessionId, toolName, args);
  } else {
    return {
      error: 'Unsupported broker for this operation',
      content: [{ type: 'text', text: 'This operation is only available for Kite/Upstox' }]
    };
  }
}

async function callKiteToolSync(sessionId, toolName, args = {}) {
  if (!kiteClients.has(sessionId)) {
    const client = new KiteMCPClient();
    client.sessionId = sessionId;
    kiteClients.set(sessionId, client);
    await client.connect();
  }
  
  const client = kiteClients.get(sessionId);
  
  const kiteToolMappings = {
    'get_quotes': 'get_quotes',
    'get_ltp': 'get_ltp',
    'get_holdings': 'get_holdings',
    'get_positions': 'get_positions',
    'get_orders': 'get_orders',
    'get_margins': 'get_margins',
    'get_profile': 'get_profile',
    'search_instruments': 'search_instruments',
    'place_order': 'place_order'
  };
  
  const actualToolName = kiteToolMappings[toolName] || toolName;
  
  if (args.instruments && Array.isArray(args.instruments)) {
    const formatted = args.instruments.map(inst => 
      inst.includes(':') ? inst : `NSE:${inst}`
    );
    args = { i: formatted };
  } else if (args.query) {
    args = { q: args.query };
  }
  
  try {
    return await client.callTool(actualToolName, args);
  } catch (error) {
    logger.error(`Kite tool error: ${error.message}`);
    return {
      error: error.message,
      content: [{ type: 'text', text: `Error: ${error.message}` }]
    };
  }
}

async function callUpstoxToolSync(req, sessionId, toolName, args = {}) {
  if (!upstoxClients.has(sessionId)) {
    const accessToken = req.session.upstoxAccessToken;
    if (!accessToken) {
      return {
        error: 'Not authenticated with Upstox',
        content: [{ type: 'text', text: 'Please login to Upstox first' }]
      };
    }
    
    const client = new UpstoxClient(accessToken);
    upstoxClients.set(sessionId, client);
  }
  
  const client = upstoxClients.get(sessionId);
  
  try {
    let result;
    
    switch (toolName) {
      case 'get_profile':
        result = await client.getProfile();
        break;
      case 'get_holdings':
        result = await client.getHoldings();
        break;
      case 'get_positions':
        result = await client.getPositions();
        break;
      case 'get_funds':
      case 'get_margins':
        result = await client.getFunds();
        break;
      case 'search_instruments':
        result = await client.searchInstruments(args.query || '');
        break;
      case 'get_quotes':
        result = await client.getMarketQuote(args.instruments || []);
        break;
      default:
        result = { error: `Unknown tool: ${toolName}` };
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    return {
      error: error.message,
      content: [{ type: 'text', text: `Error: ${error.message}` }]
    };
  }
}

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'unified-trading-backend',
    port: 5000,
    brokers: ['fyers', 'kite', 'upstox']
  });
});

// Broker status
app.get('/api/broker/status', (req, res) => {
  const sessionId = getSessionId(req);
  res.json({
    session_id: sessionId.substring(0, 8) + '...',
    active_broker: getActiveBroker(req),
    brokers: getBrokerStatus(req)
  });
});

// Select broker
app.post('/api/broker/select', (req, res) => {
  const { broker } = req.body;
  
  if (!['fyers', 'kite', 'upstox'].includes(broker?.toLowerCase())) {
    return res.status(400).json({ success: false, error: 'Invalid broker' });
  }
  
  const brokerStatus = getBrokerStatus(req);
  
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
    brokers: getBrokerStatus(req)
  });
});

// ==================== FYERS ROUTES ====================

app.post('/api/fyers/connect', async (req, res) => {
  const sessionId = getSessionId(req);
  
  try {
    if (fyersMcpClients.has(sessionId) && fyersMcpClients.get(sessionId).isInitialized) {
      return res.json({
        success: true,
        message: 'Already connected to Fyers',
        session_id: sessionId.substring(0, 8) + '...'
      });
    }
    
    const mcpClient = new FyersMCPClient(sessionId);
    fyersMcpClients.set(sessionId, mcpClient);
    
    await mcpClient.initialize();
    
    res.json({
      success: true,
      message: 'Connected to Fyers MCP',
      session_id: sessionId.substring(0, 8) + '...'
    });
    
  } catch (error) {
    logger.error(`Fyers connect error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/fyers/login', async (req, res) => {
  const sessionId = getSessionId(req);
  
  if (!fyersMcpClients.has(sessionId)) {
    return res.status(400).json({
      success: false,
      error: 'Not connected. Please connect first.'
    });
  }
  
  try {
    const mcpClient = fyersMcpClients.get(sessionId);
    const loginResult = await mcpClient.callTool('login');
    const loginUrl = mcpClient.extractLoginUrl(loginResult);
    
    if (loginUrl) {
      res.json({
        success: true,
        login_url: loginUrl
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Could not extract login URL'
      });
    }
    
  } catch (error) {
    logger.error(`Fyers login error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/fyers/verify-auth', async (req, res) => {
  const sessionId = getSessionId(req);
  
  if (!fyersMcpClients.has(sessionId)) {
    return res.status(400).json({ success: false, error: 'Not connected' });
  }
  
  try {
    const mcpClient = fyersMcpClients.get(sessionId);
    mcpClient.isAuthenticated = true;
    
    const agent = new AzureOpenAIFyersAgent(sessionId, AZURE_CONFIG_FYERS);
    await agent.initialize(mcpClient);
    
    fyersAgents.set(sessionId, agent);
    setActiveBroker(req, 'fyers');
    
    res.json({
      success: true,
      authenticated: true,
      tools_count: agent.availableTools.length
    });
    
  } catch (error) {
    logger.error(`Fyers verify auth error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/fyers/chat', async (req, res) => {
  const sessionId = getSessionId(req);
  
  if (!fyersAgents.has(sessionId)) {
    return res.status(400).json({
      success: false,
      error: 'Fyers agent not initialized'
    });
  }
  
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'No message' });
    }
    
    const agent = fyersAgents.get(sessionId);
    const response = await agent.chat(message);
    
    res.json({
      success: true,
      response,
      broker: 'fyers'
    });
    
  } catch (error) {
    logger.error(`Fyers chat error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== KITE ROUTES ====================

app.post('/api/kite/login', async (req, res) => {
  const sessionId = getSessionId(req);
  
  try {
    const client = new KiteMCPClient();
    client.sessionId = sessionId;
    kiteClients.set(sessionId, client);
    
    await client.connect();
    
    const result = await client.callTool('login', {});
    
    if (result.content && result.content.length > 0) {
      const text = result.content[0].text || '';
      const urlMatch = text.match(/https:\/\/[^\s)]+/);
      if (urlMatch) {
        const url = urlMatch[0];
        return res.json({
          success: true,
          login_url: url,
          message: `Please visit: ${url}`
        });
      }
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error(`Kite login error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/kite/profile', async (req, res) => {
  const sessionId = getSessionId(req);
  const result = await callKiteToolSync(sessionId, 'get_profile', {});
  res.json(result);
});

app.post('/api/kite/holdings', async (req, res) => {
  const sessionId = getSessionId(req);
  const result = await callKiteToolSync(sessionId, 'get_holdings', {});
  res.json(result);
});

app.post('/api/kite/positions', async (req, res) => {
  const sessionId = getSessionId(req);
  const result = await callKiteToolSync(sessionId, 'get_positions', {});
  res.json(result);
});

app.post('/api/kite/orders', async (req, res) => {
  const sessionId = getSessionId(req);
  const result = await callKiteToolSync(sessionId, 'get_orders', {});
  res.json(result);
});

app.post('/api/kite/quotes', async (req, res) => {
  const sessionId = getSessionId(req);
  const result = await callKiteToolSync(sessionId, 'get_quotes', req.body);
  res.json(result);
});

// ==================== UPSTOX ROUTES ====================

app.get('/api/upstox/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: UPSTOX_CONFIG.apiKey,
    redirect_uri: UPSTOX_CONFIG.redirectUri,
    response_type: 'code'
  });
  
  const authUrl = `${UPSTOX_AUTH_URL}?${params.toString()}`;
  res.json({
    success: true,
    auth_url: authUrl
  });
});

app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect('http://localhost:5173?error=authorization_failed');
  }
  
  try {
    const tokenData = {
      code,
      client_id: UPSTOX_CONFIG.apiKey,
      client_secret: UPSTOX_CONFIG.apiSecret,
      redirect_uri: UPSTOX_CONFIG.redirectUri,
      grant_type: 'authorization_code'
    };
    
    const response = await axios.post(
      UPSTOX_TOKEN_URL,
      new URLSearchParams(tokenData).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    
    const accessToken = response.data.access_token;
    req.session.upstoxAccessToken = accessToken;
    setActiveBroker(req, 'upstox');
    
    res.redirect('http://localhost:5173?login=success&broker=upstox');
    
  } catch (error) {
    logger.error(`Upstox OAuth error: ${error.message}`);
    res.redirect('http://localhost:5173?error=token_failed');
  }
});

app.post('/api/upstox/profile', async (req, res) => {
  const sessionId = getSessionId(req);
  const result = await callUpstoxToolSync(req, sessionId, 'get_profile', {});
  res.json(result);
});

app.post('/api/upstox/holdings', async (req, res) => {
  const sessionId = getSessionId(req);
  const result = await callUpstoxToolSync(req, sessionId, 'get_holdings', {});
  res.json(result);
});

app.post('/api/upstox/positions', async (req, res) => {
  const sessionId = getSessionId(req);
  const result = await callUpstoxToolSync(req, sessionId, 'get_positions', {});
  res.json(result);
});

// ==================== FYERS DATA ROUTES ====================

app.get('/api/fyers/watchlists', async (req, res) => {
  const sessionId = getSessionId(req);
  
  if (!fyersMcpClients.has(sessionId)) {
    return res.status(400).json({ success: false, error: 'Not connected' });
  }
  
  try {
    const mcpClient = fyersMcpClients.get(sessionId);
    const result = await mcpClient.callTool('get_watchlists');
    
    res.json({
      success: true,
      data: mcpClient.extractTextFromResult(result)
    });
  } catch (error) {
    logger.error(`Get watchlists error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/fyers/positions', async (req, res) => {
  const sessionId = getSessionId(req);
  
  if (!fyersMcpClients.has(sessionId)) {
    return res.status(400).json({ success: false, error: 'Not connected' });
  }
  
  try {
    const mcpClient = fyersMcpClients.get(sessionId);
    const result = await mcpClient.callTool('get_positions');
    
    res.json({
      success: true,
      data: mcpClient.extractTextFromResult(result)
    });
  } catch (error) {
    logger.error(`Get positions error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/fyers/holdings', async (req, res) => {
  const sessionId = getSessionId(req);
  
  if (!fyersMcpClients.has(sessionId)) {
    return res.status(400).json({ success: false, error: 'Not connected' });
  }
  
  try {
    const mcpClient = fyersMcpClients.get(sessionId);
    const result = await mcpClient.callTool('get_holdings');
    
    res.json({
      success: true,
      data: mcpClient.extractTextFromResult(result)
    });
  } catch (error) {
    logger.error(`Get holdings error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== UNIFIED CHAT ====================

app.post('/api/chat', async (req, res) => {
  const sessionId = getSessionId(req);
  const activeBroker = getActiveBroker(req);
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ success: false, error: 'No message' });
  }
  
  try {
    if (activeBroker === 'fyers') {
      // Use Fyers agent
      if (!fyersAgents.has(sessionId)) {
        return res.status(400).json({
          success: false,
          error: 'Fyers agent not initialized. Please authenticate first.'
        });
      }
      
      const agent = fyersAgents.get(sessionId);
      const response = await agent.chat(message);
      
      res.json({
        success: true,
        response,
        broker: 'fyers'
      });
      
    } else {
      // Use Kite/Upstox agent with simple tool calling
      const historyKey = `${sessionId}_${activeBroker}`;
      
      if (!conversationHistories.has(historyKey)) {
        conversationHistories.set(historyKey, []);
      }
      
      const history = conversationHistories.get(historyKey);
      
      // Initialize Azure OpenAI for Kite/Upstox
      if (!kiteLLM) {
        kiteLLM = new AzureOpenAI({
          endpoint: AZURE_CONFIG_KITE.endpoint,
          apiKey: AZURE_CONFIG_KITE.apiKey,
          apiVersion: AZURE_CONFIG_KITE.apiVersion,
          deployment: AZURE_CONFIG_KITE.deployment
        });
      }
      
      // Build conversation with last 10 messages
      const messages = [
        {
          role: 'system',
          content: `You are a Portfolio Assistant for ${activeBroker.toUpperCase()}.

Available tools:
- get_holdings: Get user's holdings
- get_positions: Get current positions
- get_orders: Get all orders
- get_profile: Get user profile
- get_margins: Get available margins/funds
- get_quotes: Get stock quotes (args: {"instruments": ["NSE:INFY", "NSE:SBIN"]})

When user asks about stock prices:
1. Use get_quotes with proper format
2. Present data clearly

Be concise and helpful.`
        },
        ...history.slice(-10)
      ];
      
      messages.push({ role: 'user', content: message });
      
      // Define tools for OpenAI
      const tools = [
        {
          type: 'function',
          function: {
            name: 'get_holdings',
            description: 'Get user\'s holdings',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_positions',
            description: 'Get current positions',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_orders',
            description: 'Get all orders',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_profile',
            description: 'Get user profile',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_margins',
            description: 'Get available margins/funds',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_quotes',
            description: 'Get stock quotes',
            parameters: {
              type: 'object',
              properties: {
                instruments: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of instrument identifiers (e.g., ["NSE:INFY", "NSE:SBIN"])'
                }
              },
              required: ['instruments']
            }
          }
        }
      ];
      
      // Call OpenAI with tool support
      let completion = await kiteLLM.chat.completions.create({
        model: AZURE_CONFIG_KITE.deployment,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 1000
      });
      
      let assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);
      
      // Handle tool calls
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            // Keep empty
          }
          
          const toolResult = await callBrokerToolSync(req, toolName, toolArgs);
          const toolText = toolResult.content?.[0]?.text || JSON.stringify(toolResult);
          
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolText
          });
        }
        
        // Get next response
        completion = await kiteLLM.chat.completions.create({
          model: AZURE_CONFIG_KITE.deployment,
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens: 1000
        });
        
        assistantMessage = completion.choices[0].message;
        messages.push(assistantMessage);
      }
      
      const finalResponse = assistantMessage.content || 'No response generated.';
      
      // Save to history
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: finalResponse });
      
      res.json({
        success: true,
        response: finalResponse,
        broker: activeBroker
      });
    }
    
  } catch (error) {
    logger.error(`Chat error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/chat/reset', (req, res) => {
  const sessionId = getSessionId(req);
  const activeBroker = getActiveBroker(req);
  
  try {
    if (activeBroker === 'fyers') {
      if (fyersAgents.has(sessionId)) {
        fyersAgents.get(sessionId).resetConversation();
      }
    } else {
      const historyKey = `${sessionId}_${activeBroker}`;
      conversationHistories.delete(historyKey);
    }
    
    res.json({
      success: true,
      message: 'Conversation reset'
    });
    
  } catch (error) {
    logger.error(`Reset error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== LOGOUT ====================

app.post('/api/logout', async (req, res) => {
  const { broker = 'all' } = req.body;
  const sessionId = getSessionId(req);
  
  try {
    if (broker === 'all') {
      // Cleanup all
      fyersMcpClients.delete(sessionId);
      fyersAgents.delete(sessionId);
      kiteClients.delete(sessionId);
      upstoxClients.delete(sessionId);
      
      req.session.destroy();
      
      res.json({
        success: true,
        message: 'Logged out from all brokers'
      });
      
    } else if (broker === 'fyers') {
      fyersMcpClients.delete(sessionId);
      fyersAgents.delete(sessionId);
      
      res.json({
        success: true,
        message: 'Logged out from Fyers'
      });
      
    } else if (broker === 'kite') {
      kiteClients.delete(sessionId);
      
      res.json({
        success: true,
        message: 'Logged out from Kite'
      });
      
    } else if (broker === 'upstox') {
      delete req.session.upstoxAccessToken;
      upstoxClients.delete(sessionId);
      
      res.json({
        success: true,
        message: 'Logged out from Upstox'
      });
      
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid broker'
      });
    }
    
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SESSION INFO ====================

app.get('/api/session/info', (req, res) => {
  const sessionId = getSessionId(req);
  
  res.json({
    session_id: sessionId.substring(0, 8) + '...',
    active_broker: getActiveBroker(req),
    brokers: getBrokerStatus(req),
    session_keys: Object.keys(req.session),
    fyers_initialized: fyersMcpClients.has(sessionId),
    kite_initialized: kiteClients.has(sessionId),
    upstox_authenticated: !!req.session.upstoxAccessToken
  });
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(70));
  console.log('🚀 UNIFIED TRADING BACKEND - NODE.JS');
  console.log('='.repeat(70));
  console.log();
  console.log(`📡 Port: ${PORT}`);
  console.log('🔗 Brokers: Fyers, Kite, Upstox');
  console.log();
  console.log('📋 Endpoints:');
  console.log('  ├── /api/health - Health check');
  console.log('  ├── /api/broker/status - Get broker status');
  console.log('  ├── /api/broker/select - Switch broker');
  console.log('  ├── /api/chat - Unified AI chat');
  console.log('  ├── /api/fyers/* - Fyers endpoints');
  console.log('  ├── /api/kite/* - Kite endpoints');
  console.log('  └── /api/upstox/* - Upstox endpoints');
  console.log();
  console.log('💡 All brokers share the same session!');
  console.log('='.repeat(70));
  console.log();
  
  if (AZURE_CONFIG_FYERS.endpoint.includes('your-resource')) {
    logger.warn('⚠️  Fyers Azure OpenAI not configured');
  }
  
  logger.info('✅ Backend ready');
});