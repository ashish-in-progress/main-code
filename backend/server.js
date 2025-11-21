// ==================== UNIFIED TRADING BACKEND WITH LANGCHAIN.JS ====================
// Multi-broker trading platform with LangChain AI agents (Fyers, Kite, Upstox)
import EventSource from 'eventsource';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import axios from 'axios';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// LangChain imports
import { AzureChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { AgentExecutor, createToolCallingAgent } from '@langchain/classic/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

// ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// ==================== LOGGING ====================
class Logger {
  info(msg) {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`);
  }
  
  error(msg, error = null) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, error || '');
  }
  
  warn(msg) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`);
  }
}

const logger = new Logger();

// ==================== EXPRESS APP ====================
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://33trpk9t-5173.inc1.devtunnels.ms'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));

// Session configuration
app.use(session({
  secret: process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/'
  },
  name: 'unified_trading_session',
  rolling: true
}));

// ==================== CONFIGURATION ====================

// Azure OpenAI Configuration for Fyers
const AZURE_CONFIG_FYERS = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://your-resource.openai.azure.com/",
  apiKey: process.env.AZURE_OPENAI_API_KEY || "your-api-key",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview"
};

// Azure OpenAI Configuration for Kite/Upstox
const AZURE_CONFIG_KITE = {
  endpoint: "https://codestore-ai.openai.azure.com/",
  apiKey: "EvkhikwvmvJYbqnV175XrD7C1ym5yXEsYAb5nEz4mbf2BJPXNWeHJQQJ99BJACHYHv6XJ3w3AAABACOGQydk",
  deployment: "gpt-4o",
  apiVersion: "2024-12-01-preview"
};

// Upstox OAuth
const UPSTOX_CONFIG = {
  apiKey: 'a5d645f8-c31e-4afd-82c7-296ac6b332fd',
  apiSecret: 'mprx3irvh2',
  redirectUri: 'http://localhost:5000/api/auth/callback',
  authUrl: 'https://api.upstox.com/v2/login/authorization/dialog',
  tokenUrl: 'https://api.upstox.com/v2/login/authorization/token',
  baseUrl: 'https://api.upstox.com/v2'
};

// Global storage
const fyersMcpClients = new Map();
const fyersAgents = new Map();
const kiteClients = new Map();
const kiteAgents = new Map();
const upstoxClients = new Map();
const upstoxAgents = new Map();
const conversationHistories = new Map();

// ==================== SESSION HELPERS ====================

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
  
  return {
    fyers: {
      authenticated: fyersMcpClients.has(sessionId) && fyersMcpClients.get(sessionId).isAuthenticated,
      active: getActiveBroker(req) === 'fyers'
    },
    kite: {
      authenticated: kiteClients.has(sessionId) && kiteClients.get(sessionId).isAuthenticated,
      active: getActiveBroker(req) === 'kite'
    },
    upstox: {
      authenticated: !!req.session.upstoxAccessToken,
      active: getActiveBroker(req) === 'upstox'
    }
  };
}
app.post('/api/kite/holdings', async (req, res) => {
  const sessionId = getSessionId(req);
  
  try {
    if (!kiteClients.has(sessionId)) {
      return res.status(400).json({ error: 'Not connected to Kite' });
    }

    const client = kiteClients.get(sessionId);
    const result = await client.callTool("get_holdings", {});
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    });
  }
});

app.post('/api/kite/positions', async (req, res) => {
  const sessionId = getSessionId(req);
  
  try {
    if (!kiteClients.has(sessionId)) {
      return res.status(400).json({ error: 'Not connected to Kite' });
    }

    const client = kiteClients.get(sessionId);
    const result = await client.callTool("get_positions", {});
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    });
  }
});

app.post('/api/kite/orders', async (req, res) => {
  const sessionId = getSessionId(req);
  
  try {
    if (!kiteClients.has(sessionId)) {
      return res.status(400).json({ error: 'Not connected to Kite' });
    }

    const client = kiteClients.get(sessionId);
    const result = await client.callTool("get_orders", {});
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    });
  }
});

app.post('/api/kite/quotes', async (req, res) => {
  const sessionId = getSessionId(req);
  
  try {
    if (!kiteClients.has(sessionId)) {
      return res.status(400).json({ error: 'Not connected to Kite' });
    }

    const client = kiteClients.get(sessionId);
    const result = await client.callTool("get_quotes", req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    });
  }
});

app.post('/api/kite/margins', async (req, res) => {
  const sessionId = getSessionId(req);
  
  try {
    if (!kiteClients.has(sessionId)) {
      return res.status(400).json({ error: 'Not connected to Kite' });
    }

    const client = kiteClients.get(sessionId);
    const result = await client.callTool("get_margins", {});
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    });
  }
});

// ==================== UPSTOX ROUTES ====================

app.get('/api/upstox/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: UPSTOX_CONFIG.apiKey,
    redirect_uri: UPSTOX_CONFIG.redirectUri,
    response_type: 'code'
  });

  const authUrl = `${UPSTOX_CONFIG.authUrl}?${params.toString()}`;
  
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
    
    // Create Upstox client and LangChain agent
    const sessionId = getSessionId(req);
    const upstoxClient = new UpstoxClient(accessToken);
    upstoxClients.set(sessionId, upstoxClient);
    
    const agent = new UpstoxLangChainAgent(sessionId, AZURE_CONFIG_KITE, upstoxClient);
    await agent.initialize();
    upstoxAgents.set(sessionId, agent);
    
    setActiveBroker(req, 'upstox');

    res.redirect('http://localhost:5173?login=success&broker=upstox');
  } catch (error) {
    logger.error('Upstox OAuth error:', error.message);
    res.redirect('http://localhost:5173?error=token_failed');
  }
});

app.post('/api/upstox/profile', async (req, res) => {
  const sessionId = getSessionId(req);

  if (!req.session.upstoxAccessToken) {
    return res.status(401).json({ error: 'Not authenticated with Upstox' });
  }

  try {
    if (!upstoxClients.has(sessionId)) {
      const client = new UpstoxClient(req.session.upstoxAccessToken);
      upstoxClients.set(sessionId, client);
    }

    const client = upstoxClients.get(sessionId);
    const result = await client.getProfile();
    
    res.json({
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    });
  }
});

app.post('/api/upstox/holdings', async (req, res) => {
  const sessionId = getSessionId(req);

  if (!req.session.upstoxAccessToken) {
    return res.status(401).json({ error: 'Not authenticated with Upstox' });
  }

  try {
    if (!upstoxClients.has(sessionId)) {
      const client = new UpstoxClient(req.session.upstoxAccessToken);
      upstoxClients.set(sessionId, client);
    }

    const client = upstoxClients.get(sessionId);
    const result = await client.getHoldings();
    
    res.json({
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    });
  }
});

app.post('/api/upstox/positions', async (req, res) => {
  const sessionId = getSessionId(req);

  if (!req.session.upstoxAccessToken) {
    return res.status(401).json({ error: 'Not authenticated with Upstox' });
  }

  try {
    if (!upstoxClients.has(sessionId)) {
      const client = new UpstoxClient(req.session.upstoxAccessToken);
      upstoxClients.set(sessionId, client);
    }

    const client = upstoxClients.get(sessionId);
    const result = await client.getPositions();
    
    res.json({
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    });
  }
});
// ==================== FYERS MCP CLIENT ====================

class FyersMCPClient {
  constructor(sessionId, mcpUrl = "https://mcp.fyers.in/mcp") {
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
    
    const initRequest = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "unified-trading-client",
          version: "1.0.0"
        }
      }
    };

    try {
      const response = await axios.post(this.mcpUrl, initRequest, {
        timeout: 30000
      });
      
      this.mcpSessionId = response.headers['mcp-session-id'];
      logger.info(`Fyers MCP connected. Session ID: ${this.mcpSessionId}`);
      
      if (this.mcpSessionId) {
        this.headers['Mcp-Session-Id'] = this.mcpSessionId;
      }

      const initNotification = {
        jsonrpc: "2.0",
        method: "notifications/initialized"
      };

      await axios.post(this.mcpUrl, initNotification, { 
        headers: this.headers,
        timeout: 10000 
      });
      
      logger.info('Fyers MCP initialized successfully');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Error initializing Fyers MCP:', error.message);
      throw error;
    }
  }

  getNextRequestId() {
    return this.requestId++;
  }

  async listTools() {
    const request = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method: "tools/list",
      params: {}
    };

    try {
      const response = await axios.post(this.mcpUrl, request, { 
        headers: this.headers,
        timeout: 30000 
      });
      
      const tools = response.data?.result?.tools || [];
      this.toolsCache = tools;
      logger.info(`Found ${tools.length} Fyers tools`);
      return tools;
    } catch (error) {
      logger.error('Error listing Fyers tools:', error.message);
      return [];
    }
  }

  async callTool(toolName, args = {}) {
    logger.info(`Calling Fyers tool: ${toolName}`);
    
    const request = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };

    try {
      const response = await axios.post(this.mcpUrl, request, { 
        headers: this.headers,
        timeout: 60000 
      });
      
      if (response.data.error) {
        logger.error('Fyers tool error:', response.data.error);
        return null;
      }

      return response.data.result || {};
    } catch (error) {
      logger.error('Exception calling Fyers tool:', error.message);
      return null;
    }
  }

  extractTextFromResult(toolResult) {
    if (!toolResult) return "";
    
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

  cleanup() {
    this.isAuthenticated = false;
    this.isInitialized = false;
  }
}

// ==================== FYERS LANGCHAIN AGENT ====================

class FyersLangChainAgent {
  constructor(sessionId, azureConfig, mcpClient) {
    this.sessionId = sessionId;
    this.mcpClient = mcpClient;
    this.conversationHistory = [];
    
    // Initialize Azure Chat OpenAI model
    this.model = new AzureChatOpenAI({
      azureOpenAIApiKey: azureConfig.apiKey,
      azureOpenAIApiInstanceName: this.extractInstanceName(azureConfig.endpoint),
      azureOpenAIApiDeploymentName: azureConfig.deployment,
      azureOpenAIApiVersion: azureConfig.apiVersion,
    });
    
    logger.info(`Created Fyers LangChain Agent for session: ${sessionId.substring(0, 8)}...`);
  }

  extractInstanceName(endpoint) {
    const match = endpoint.match(/https:\/\/([^.]+)\.openai\.azure\.com/);
    return match ? match[1] : 'your-resource';
  }

  async initialize() {
    const mcpTools = await this.mcpClient.listTools();
    
    // Convert MCP tools to LangChain DynamicStructuredTools
    this.tools = mcpTools.map(tool => {
      const inputSchema = tool.inputSchema || {
        type: "object",
        properties: {},
        required: []
      };

      const zodSchema = this.createZodSchemaFromMCP(inputSchema);

      return new DynamicStructuredTool({
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        schema: zodSchema,
        func: async (input) => {
          try {
            const result = await this.mcpClient.callTool(tool.name, input);
            return this.mcpClient.extractTextFromResult(result) || JSON.stringify(result);
          } catch (error) {
            logger.error(`Error executing tool ${tool.name}:`, error.message);
            return `Error: ${error.message}`;
          }
        }
      });
    });

    // Create prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "ou are a trading assistant for the Fyers broker.Use tools for any request involving orders, positions, holdings, funds, charts, option chain, alerts, or watchlists (watchlist id is lut).Ask for missing details instead of assuming.Only place, modify, or cancel orders when the user gives explicit instructions.For watchlist symbols, always use format like NSE:TCS-EQ with no .NS.If a tool is required, respond ONLY with the tool call.If no tool is needed, reply normally."],
      ["placeholder", "{chat_history}"],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"]
    ]);

    // Create agent
    const agent = await createToolCallingAgent({
      llm: this.model,
      tools: this.tools,
      prompt
    });

    // Create agent executor
    this.agentExecutor = new AgentExecutor({
      agent,
      tools: this.tools,
      verbose: true,
      maxIterations: 20
    });

    logger.info(`Fyers agent initialized with ${this.tools.length} tools`);
  }

  createZodSchemaFromMCP(mcpSchema) {
    const properties = mcpSchema.properties || {};
    const required = mcpSchema.required || [];

    const zodObject = {};

    for (const [key, value] of Object.entries(properties)) {
      let zodField;

      switch (value.type) {
        case 'string':
          zodField = z.string();
          break;
        case 'number':
          zodField = z.number();
          break;
        case 'boolean':
          zodField = z.boolean();
          break;
        case 'array':
          zodField = z.array(z.string());
          break;
        case 'object':
          zodField = z.object({});
          break;
        default:
          zodField = z.string();
      }

      if (value.description) {
        zodField = zodField.describe(value.description);
      }

      if (!required.includes(key)) {
        zodField = zodField.optional();
      }

      zodObject[key] = zodField;
    }

    return z.object(zodObject);
  }

 async chat(userMessage) {
  try {
    const result = await this.agentExecutor.invoke({
      input: userMessage,
      chat_history: this.conversationHistory
    });

    // ONLY store the user message and final AI response
    // NOT the intermediate tool calls and agent scratchpad
    this.conversationHistory.push(new HumanMessage(userMessage));
    this.conversationHistory.push(new AIMessage(result.output));

    // Keep only last 10 messages (5 exchanges)
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }

    return result.output;
  } catch (error) {
    logger.error('Error in chat:', error.message);
    return `Error: ${error.message}`;
  }
}

  resetConversation() {
    this.conversationHistory = [];
  }
}

// ==================== KITE MCP CLIENT ====================

class KiteMCPClient {
  constructor(mcpUrl = "https://mcp.kite.trade/mcp") {
    this.mcpUrl = mcpUrl;
    this.connected = false;
    this.sessionId = null;
    this.mcpSessionId = null;
    this.headers = { 'Content-Type': 'application/json' };
    this.requestId = 1;
    this.isInitialized = false;
    this.isAuthenticated = false;
    this.serverCapabilities = null;
    this.toolsCache = [];
  }

  getNextRequestId() {
    return this.requestId++;
  }

  async connect() {
    if (this.connected && this.isInitialized) {
      return true;
    }

    try {
      logger.info('🔌 Connecting to Kite MCP via HTTP...');
      
      const initRequest = {
        jsonrpc: "2.0",
        id: this.getNextRequestId(),
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "unified-trading-client",
            version: "1.0.0"
          }
        }
      };

      const response = await axios.post(this.mcpUrl, initRequest, {
        headers: this.headers,
        timeout: 30000
      });

      this.mcpSessionId = response.headers['mcp-session-id'];
      if (this.mcpSessionId) {
        this.headers['Mcp-Session-Id'] = this.mcpSessionId;
        logger.info(`✅ Got MCP Session ID: ${this.mcpSessionId.substring(0, 8)}...`);
      }

      const result = response.data;

      if (result.result) {
        this.serverCapabilities = result.result.capabilities || {};
        logger.info('✅ Kite MCP initialization successful');

        const initNotification = {
          jsonrpc: "2.0",
          method: "notifications/initialized"
        };

        await axios.post(this.mcpUrl, initNotification, {
          headers: this.headers,
          timeout: 10000
        });

        logger.info('✅ Sent initialized notification');
        
        this.connected = true;
        this.isInitialized = true;
        return true;
      } else if (result.error) {
        throw new Error(`Initialization failed: ${result.error.message}`);
      }

      throw new Error('Unexpected initialization response');

    } catch (error) {
      logger.error('❌ Kite connection error:', error.message);
      throw error;
    }
  }

  async sendRequest(request) {
    if (!this.connected) {
      throw new Error('Not connected to Kite MCP');
    }

    try {
      const response = await axios.post(this.mcpUrl, request, {
        headers: this.headers,
        timeout: 60000
      });

      if (response.data.error) {
        throw new Error(response.data.error.message || 'Unknown error');
      }

      return response.data.result;
    } catch (error) {
      if (error.response) {
        logger.error('❌ Request failed:', error.response.status, error.response.data);
      }
      throw error;
    }
  }

  async listTools() {
    const request = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method: "tools/list",
      params: {}
    };

    try {
      const result = await this.sendRequest(request);
      const tools = result?.tools || [];
      this.toolsCache = tools;
      logger.info(`Found ${tools.length} Kite tools`);
      return tools;
    } catch (error) {
      logger.error('Error listing Kite tools:', error.message);
      return [];
    }
  }

  async callTool(toolName, args = {}) {
    if (!this.connected || !this.isInitialized) {
      logger.info('🔌 Not connected, connecting now...');
      await this.connect();
    }

    try {
      logger.info(`🔧 Calling Kite tool: ${toolName}`);

      const kiteToolMappings = {
        'login': 'login',
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

      let formattedArgs = args;
      if (args.instruments && Array.isArray(args.instruments)) {
        const formatted = args.instruments.map(inst => 
          inst.includes(':') ? inst : `NSE:${inst}`
        );
        formattedArgs = { i: formatted };
      } else if (args.query) {
        formattedArgs = { q: args.query };
      }

      const request = {
        jsonrpc: "2.0",
        id: this.getNextRequestId(),
        method: "tools/call",
        params: {
          name: actualToolName,
          arguments: formattedArgs
        }
      };

      const result = await this.sendRequest(request);

      const response = {
        content: []
      };

      if (result && result.content) {
        if (Array.isArray(result.content)) {
          response.content = result.content.map(item => {
            let text = null;
            
            if (item.text !== undefined) {
              text = item.text;
            } else if (item.data !== undefined) {
              text = item.data;
            } else if (item.value !== undefined) {
              text = item.value;
            } else if (item.result !== undefined) {
              text = item.result;
            }
            
            if (text === null) {
              try {
                text = JSON.stringify(item);
              } catch {
                text = String(item);
              }
            }
            
            return {
              type: item.type || 'text',
              text: typeof text === 'string' ? text : JSON.stringify(text)
            };
          });
        } else {
          response.content = [{
            type: "text",
            text: typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
          }];
        }
      } else {
        response.content = [{
          type: "text",
          text: JSON.stringify(result || {})
        }];
      }

      return response;
    } catch (error) {
      logger.error('❌ Kite tool error:', error.message);
      return {
        error: error.message,
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
  }

  extractTextFromResult(toolResult) {
    if (!toolResult) return "";
    
    const content = toolResult.content || [];
    const textParts = content
      .filter(item => item.type === 'text')
      .map(item => item.text || '');
    
    return textParts.join('\n');
  }

  cleanup() {
    this.connected = false;
    this.isInitialized = false;
    this.isAuthenticated = false;
  }

  async disconnect() {
    this.cleanup();
  }
}

// ==================== KITE LANGCHAIN AGENT ====================

class KiteLangChainAgent {
  constructor(sessionId, azureConfig, mcpClient) {
    this.sessionId = sessionId;
    this.mcpClient = mcpClient;
    this.conversationHistory = [];
    
    // Initialize Azure Chat OpenAI model
    this.model = new AzureChatOpenAI({
      azureOpenAIApiKey: azureConfig.apiKey,
      azureOpenAIApiInstanceName: this.extractInstanceName(azureConfig.endpoint),
      azureOpenAIApiDeploymentName: azureConfig.deployment,
      azureOpenAIApiVersion: azureConfig.apiVersion,
    });
    
    logger.info(`Created Kite LangChain Agent for session: ${sessionId.substring(0, 8)}...`);
  }

  extractInstanceName(endpoint) {
    const match = endpoint.match(/https:\/\/([^.]+)\.openai\.azure\.com/);
    return match ? match[1] : 'codestore-ai';
  }

  async initialize() {
    const mcpTools = await this.mcpClient.listTools();
    
    // Convert MCP tools to LangChain DynamicStructuredTools
    this.tools = mcpTools.map(tool => {
      const inputSchema = tool.inputSchema || {
        type: "object",
        properties: {},
        required: []
      };

      const zodSchema = this.createZodSchemaFromMCP(inputSchema);

      return new DynamicStructuredTool({
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        schema: zodSchema,
        func: async (input) => {
          try {
            const result = await this.mcpClient.callTool(tool.name, input);
            return this.mcpClient.extractTextFromResult(result) || JSON.stringify(result);
          } catch (error) {
            logger.error(`Error executing tool ${tool.name}:`, error.message);
            return `Error: ${error.message}`;
          }
        }
      });
    });

    // Create prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a Kite/Zerodha trading assistant.Use tools for any account, order, portfolio, position, GTT, or market-data request.zAsk for missing details instead of guessing.Only place/modify/cancel orders when the user gives explicit trade instructions.Use market-data tools for prices, tokens, OHLC, quotes, searches.Give analysis when asked, without financial advice.Respond with a tool call only when required; otherwise reply normally."],
      ["placeholder", "{chat_history}"],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"]
    ]);

    // Create agent
    const agent = await createToolCallingAgent({
      llm: this.model,
      tools: this.tools,
      prompt
    });

    // Create agent executor
    this.agentExecutor = new AgentExecutor({
      agent,
      tools: this.tools,
      verbose: true,
      maxIterations: 20
    });

    logger.info(`Kite agent initialized with ${this.tools.length} tools`);
  }

  createZodSchemaFromMCP(mcpSchema) {
    const properties = mcpSchema.properties || {};
    const required = mcpSchema.required || [];

    const zodObject = {};

    for (const [key, value] of Object.entries(properties)) {
      let zodField;

      switch (value.type) {
        case 'string':
          zodField = z.string();
          break;
        case 'number':
          zodField = z.number();
          break;
        case 'boolean':
          zodField = z.boolean();
          break;
        case 'array':
          zodField = z.array(z.string());
          break;
        case 'object':
          zodField = z.object({});
          break;
        default:
          zodField = z.string();
      }

      if (value.description) {
        zodField = zodField.describe(value.description);
      }

      if (!required.includes(key)) {
        zodField = zodField.optional();
      }

      zodObject[key] = zodField;
    }

    return z.object(zodObject);
  }

 async chat(userMessage) {
  try {
    const result = await this.agentExecutor.invoke({
      input: userMessage,
      chat_history: this.conversationHistory
    });

    // ONLY store the user message and final AI response
    // NOT the intermediate tool calls and agent scratchpad
    this.conversationHistory.push(new HumanMessage(userMessage));
    this.conversationHistory.push(new AIMessage(result.output));

    // Keep only last 10 messages (5 exchanges)
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }

    return result.output;
  } catch (error) {
    logger.error('Error in chat:', error.message);
    return `Error: ${error.message}`;
  }
}

  resetConversation() {
    this.conversationHistory = [];
  }
}

// ==================== UPSTOX CLIENT ====================

class UpstoxClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = UPSTOX_CONFIG.baseUrl;
    this.connected = true;
    this.isAuthenticated = true;
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      },
      timeout: 30000
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error(`Upstox API error (${endpoint}):`, error.message);
      throw error;
    }
  }

  async getProfile() {
    return this.makeRequest('/user/profile');
  }

  async getHoldings() {
    return this.makeRequest('/portfolio/long-term-holdings');
  }

  async getPositions() {
    return this.makeRequest('/portfolio/short-term-positions');
  }

  async getFunds() {
    return this.makeRequest('/user/get-funds-and-margin');
  }

  async searchInstruments(query) {
    return this.makeRequest(`/search/instruments?query=${encodeURIComponent(query)}`);
  }

  async getMarketQuote(instruments) {
    const upstoxInstruments = instruments.map(inst => {
      if (inst.includes(':')) {
        const [exchange, symbol] = inst.split(':');
        return `${exchange}_EQ|${symbol}`;
      }
      return `NSE_EQ|${inst}`;
    });

    return this.makeRequest(`/market-quote/quotes?instrument_key=${upstoxInstruments.join(',')}`);
  }
}

// ==================== UPSTOX LANGCHAIN AGENT ====================

class UpstoxLangChainAgent {
  constructor(sessionId, azureConfig, upstoxClient) {
    this.sessionId = sessionId;
    this.upstoxClient = upstoxClient;
    this.conversationHistory = [];
    
    // Initialize Azure Chat OpenAI model
    this.model = new AzureChatOpenAI({
      azureOpenAIApiKey: azureConfig.apiKey,
      azureOpenAIApiInstanceName: this.extractInstanceName(azureConfig.endpoint),
      azureOpenAIApiDeploymentName: azureConfig.deployment,
      azureOpenAIApiVersion: azureConfig.apiVersion,
    });
    
    logger.info(`Created Upstox LangChain Agent for session: ${sessionId.substring(0, 8)}...`);
  }

  extractInstanceName(endpoint) {
    const match = endpoint.match(/https:\/\/([^.]+)\.openai\.azure\.com/);
    return match ? match[1] : 'codestore-ai';
  }

  async initialize() {
    // Define Upstox tools
    this.tools = [
      new DynamicStructuredTool({
        name: "get_profile",
        description: "Get user profile information from Upstox",
        schema: z.object({}),
        func: async () => {
          try {
            const result = await this.upstoxClient.getProfile();
            return JSON.stringify(result, null, 2);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),
      new DynamicStructuredTool({
        name: "get_holdings",
        description: "Get user's long-term holdings from Upstox",
        schema: z.object({}),
        func: async () => {
          try {
            const result = await this.upstoxClient.getHoldings();
            return JSON.stringify(result, null, 2);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),
      new DynamicStructuredTool({
        name: "get_positions",
        description: "Get user's current positions from Upstox",
        schema: z.object({}),
        func: async () => {
          try {
            const result = await this.upstoxClient.getPositions();
            return JSON.stringify(result, null, 2);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),
      new DynamicStructuredTool({
        name: "get_funds",
        description: "Get user's funds and margin information from Upstox",
        schema: z.object({}),
        func: async () => {
          try {
            const result = await this.upstoxClient.getFunds();
            return JSON.stringify(result, null, 2);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),
      new DynamicStructuredTool({
        name: "search_instruments",
        description: "Search for trading instruments on Upstox",
        schema: z.object({
          query: z.string().describe("Search query for instrument (e.g., 'RELIANCE', 'INFY')")
        }),
        func: async ({ query }) => {
          try {
            const result = await this.upstoxClient.searchInstruments(query);
            return JSON.stringify(result, null, 2);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),
      new DynamicStructuredTool({
        name: "get_market_quote",
        description: "Get market quotes for specified instruments",
        schema: z.object({
          instruments: z.array(z.string()).describe("List of instruments (e.g., ['RELIANCE', 'TCS'])")
        }),
        func: async ({ instruments }) => {
          try {
            const result = await this.upstoxClient.getMarketQuote(instruments);
            return JSON.stringify(result, null, 2);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      })
    ];

    // Create prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful trading assistant for Upstox broker. You can help users with their trading account, portfolio, orders, and market data. Use the available tools to answer user questions."],
      ["placeholder", "{chat_history}"],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"]
    ]);

    // Create agent
    const agent = await createToolCallingAgent({
      llm: this.model,
      tools: this.tools,
      prompt
    });

    // Create agent executor
    this.agentExecutor = new AgentExecutor({
      agent,
      tools: this.tools,
      verbose: true,
      maxIterations: 20
    });

    logger.info(`Upstox agent initialized with ${this.tools.length} tools`);
  }

  async chat(userMessage) {
  try {
    const result = await this.agentExecutor.invoke({
      input: userMessage,
      chat_history: this.conversationHistory
    });

    // ONLY store the user message and final AI response
    // NOT the intermediate tool calls and agent scratchpad
    this.conversationHistory.push(new HumanMessage(userMessage));
    this.conversationHistory.push(new AIMessage(result.output));

    // Keep only last 10 messages (5 exchanges)
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }

    return result.output;
  } catch (error) {
    logger.error('Error in chat:', error.message);
    return `Error: ${error.message}`;
  }
}

  resetConversation() {
    this.conversationHistory = [];
  }
}

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'unified-trading-backend-langchain',
    port: PORT,
    brokers: ['fyers', 'kite', 'upstox'],
    framework: 'LangChain.js'
  });
});

// Broker status
app.get('/api/broker/status', (req, res) => {
  res.json({
    session_id: getSessionId(req).substring(0, 8) + '...',
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
    logger.error('Fyers connect error:', error.message);
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
    const loginResult = await mcpClient.callTool("login");
    const loginUrl = mcpClient.extractLoginUrl(loginResult);

    if (loginUrl) {
      res.json({ success: true, login_url: loginUrl });
    } else {
      res.status(500).json({ success: false, error: 'Could not extract login URL' });
    }
  } catch (error) {
    logger.error('Fyers login error:', error.message);
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

    const agent = new FyersLangChainAgent(sessionId, AZURE_CONFIG_FYERS, mcpClient);
    await agent.initialize();

    fyersAgents.set(sessionId, agent);
    setActiveBroker(req, 'fyers');

    res.json({
      success: true,
      authenticated: true,
      tools_count: agent.tools.length
    });
  } catch (error) {
    logger.error('Fyers verify auth error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== KITE ROUTES ====================

app.post('/api/kite/login', async (req, res) => {
  const sessionId = getSessionId(req);

  try {
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
        
        return res.json({
          success: true,
          login_url: loginUrl,
          message: 'Please complete login in the popup window, then click "I have completed login"'
        });
      }
      
      logger.warn('⚠️ Could not extract URL. Full response:', text);
      return res.json({
        success: false,
        error: 'Could not extract login URL',
        debug_response: text,
        message: 'Login URL extraction failed. Check console for details.'
      });
    }

    return res.json({
      success: false,
      error: 'No content in login response',
      result: result
    });
    
  } catch (error) {
    logger.error('❌ Kite login error:', error.message);
    
    if (kiteClients.has(sessionId)) {
      const client = kiteClients.get(sessionId);
      client.cleanup();
    }
    
    return res.status(500).json({
      success: false,
      error: error.message,
      details: 'Connection or login tool call failed'
    });
  }
});

app.post('/api/kite/verify-auth', async (req, res) => {
  const sessionId = getSessionId(req);

  try {
    if (!kiteClients.has(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Not connected to Kite'
      });
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
        return res.json({
          success: false,
          authenticated: false,
          error: 'Not authenticated',
          message: 'Please complete the Kite login first. After logging in at Zerodha, wait a few seconds and try again.',
          is_demo: true
        });
      }
      
      logger.info('✅ Kite authentication verified - real user data received');
      client.isAuthenticated = true;
      
      // Create Kite LangChain agent
      const agent = new KiteLangChainAgent(sessionId, AZURE_CONFIG_KITE, client);
      await agent.initialize();
      kiteAgents.set(sessionId, agent);
      
      setActiveBroker(req, 'kite');

      return res.json({
        success: true,
        authenticated: true,
        message: 'Successfully authenticated with Kite',
        profile: profileText.substring(0, 200),
        tools_count: agent.tools.length
      });
    }

    return res.json({
      success: false,
      authenticated: false,
      error: 'No profile data received'
    });

  } catch (error) {
    logger.error('❌ Kite verify auth error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/kite/profile', async (req, res) => {
  const sessionId = getSessionId(req);
  
  try {
    if (!kiteClients.has(sessionId)) {
      return res.status(400).json({ error: 'Not connected to Kite' });
    }

    const client = kiteClients.get(sessionId);
    const result = await client.callTool("get_profile", {});
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    });
  }
});

// ==================== UNIFIED CHAT WITH LANGCHAIN ====================

app.post('/api/chat', async (req, res) => {
  const sessionId = getSessionId(req);
  const activeBroker = getActiveBroker(req);
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'No message provided' });
  }

  try {
    if (activeBroker === 'fyers') {
      if (!fyersAgents.has(sessionId)) {
        return res.status(400).json({
          success: false,
          error: 'Fyers agent not initialized. Please authenticate first.'
        });
      }

      const agent = fyersAgents.get(sessionId);
      const response = await agent.chat(message);

      return res.json({
        success: true,
        response,
        broker: 'fyers',
        framework: 'LangChain.js'
      });
      
    } else if (activeBroker === 'kite') {
      if (!kiteAgents.has(sessionId)) {
        return res.status(400).json({
          success: false,
          error: 'Kite agent not initialized. Please authenticate first.'
        });
      }

      const agent = kiteAgents.get(sessionId);
      const response = await agent.chat(message);

      return res.json({
        success: true,
        response,
        broker: 'kite',
        framework: 'LangChain.js'
      });
      
    } else if (activeBroker === 'upstox') {
      if (!upstoxAgents.has(sessionId)) {
        return res.status(400).json({
          success: false,
          error: 'Upstox agent not initialized. Please authenticate first.'
        });
      }

      const agent = upstoxAgents.get(sessionId);
      const response = await agent.chat(message);

      return res.json({
        success: true,
        response,
        broker: 'upstox',
        framework: 'LangChain.js'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid or no active broker selected'
      });
    }
  } catch (error) {
    logger.error('Chat error:', error.message);
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
    } else if (activeBroker === 'kite') {
      if (kiteAgents.has(sessionId)) {
        kiteAgents.get(sessionId).resetConversation(); 
      }
    } else if (activeBroker === 'upstox') { 
      if (upstoxAgents.has(sessionId)) { 
        upstoxAgents.get(sessionId).resetConversation();
      } 
    }
 
    res.json({
      success: true, 
      message: `Conversation reset for ${activeBroker}` 
    }); 
  } catch (error) {
    logger.error('Reset error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/chat/history', (req, res) => {
  const sessionId = getSessionId(req);
  const activeBroker = getActiveBroker(req);

  try {
    let history = [];
    
    if (activeBroker === 'fyers' && fyersAgents.has(sessionId)) {
      const agent = fyersAgents.get(sessionId);
      history = agent.conversationHistory.map(msg => ({
        role: msg._getType() === 'human' ? 'user' : 'assistant',
        content: msg.content
      }));
    } else if (activeBroker === 'kite' && kiteAgents.has(sessionId)) {
      const agent = kiteAgents.get(sessionId);
      history = agent.conversationHistory.map(msg => ({
        role: msg._getType() === 'human' ? 'user' : 'assistant',
        content: msg.content
      }));
    } else if (activeBroker === 'upstox' && upstoxAgents.has(sessionId)) {
      const agent = upstoxAgents.get(sessionId);
      history = agent.conversationHistory.map(msg => ({
        role: msg._getType() === 'human' ? 'user' : 'assistant',
        content: msg.content
      }));
    }

    res.json({
      success: true,
      broker: activeBroker,
      history,
      message_count: history.length,
      max_messages: 5
    });
  } catch (error) {
    logger.error('History fetch error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
// ==================== LOGOUT ====================

app.post('/api/logout', async (req, res) => {
  const { broker = 'all' } = req.body;
  const sessionId = getSessionId(req);

  try {
    if (broker === 'all') {
      // Clean up Fyers
      if (fyersMcpClients.has(sessionId)) {
        fyersMcpClients.get(sessionId).cleanup();
      }
      fyersMcpClients.delete(sessionId);
      fyersAgents.delete(sessionId);
      
      // Clean up Kite
      if (kiteClients.has(sessionId)) {
        kiteClients.get(sessionId).cleanup();
      }
      kiteClients.delete(sessionId);
      kiteAgents.delete(sessionId);
      
      // Clean up Upstox
      upstoxClients.delete(sessionId);
      upstoxAgents.delete(sessionId);
      
      req.session.destroy((err) => {
        if (err) {
          logger.error('Session destroy error:', err);
        }
      });

      return res.json({
        success: true,
        message: 'Logged out from all brokers'
      });
      
    } else if (broker === 'fyers') {
      if (fyersMcpClients.has(sessionId)) {
        fyersMcpClients.get(sessionId).cleanup();
      }
      fyersMcpClients.delete(sessionId);
      fyersAgents.delete(sessionId);

      return res.json({
        success: true,
        message: 'Logged out from Fyers'
      });
      
    } else if (broker === 'kite') {
      if (kiteClients.has(sessionId)) {
        kiteClients.get(sessionId).cleanup();
      }
      kiteClients.delete(sessionId);
      kiteAgents.delete(sessionId);

      return res.json({
        success: true,
        message: 'Logged out from Kite'
      });
      
    } else if (broker === 'upstox') {
      delete req.session.upstoxAccessToken;
      upstoxClients.delete(sessionId);
      upstoxAgents.delete(sessionId);

      return res.json({
        success: true,
        message: 'Logged out from Upstox'
      });
    }

    res.status(400).json({
      success: false,
      error: 'Invalid broker specified'
    });
  } catch (error) {
    logger.error('Logout error:', error.message);
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
    fyers_connected: fyersMcpClients.has(sessionId) && fyersMcpClients.get(sessionId).isInitialized,
    kite_connected: kiteClients.has(sessionId) && kiteClients.get(sessionId).connected,
    upstox_connected: !!req.session.upstoxAccessToken,
    fyers_agent_ready: fyersAgents.has(sessionId),
    kite_agent_ready: kiteAgents.has(sessionId),
    upstox_agent_ready: upstoxAgents.has(sessionId)
  });
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ==================== CLEANUP ON EXIT ====================

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, cleaning up...');
  
  // Cleanup all clients
  fyersMcpClients.forEach(client => client.cleanup());
  kiteClients.forEach(client => client.cleanup());
  
  // Clear all maps
  fyersMcpClients.clear();
  fyersAgents.clear();
  kiteClients.clear();
  kiteAgents.clear();
  upstoxClients.clear();
  upstoxAgents.clear();
  conversationHistories.clear();
  
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, cleaning up...');
  
  // Cleanup all clients
  fyersMcpClients.forEach(client => client.cleanup());
  kiteClients.forEach(client => client.cleanup());
  
  // Clear all maps
  fyersMcpClients.clear();
  fyersAgents.clear();
  kiteClients.clear();
  kiteAgents.clear();
  upstoxClients.clear();
  upstoxAgents.clear();
  conversationHistories.clear();
  
  process.exit(0);
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  logger.info(`🚀 Unified Trading Backend with LangChain.js started on port ${PORT}`);
  logger.info(`📊 Supported brokers: Fyers, Kite, Upstox`);
  logger.info(`🤖 AI Framework: LangChain.js with Azure OpenAI`);
  logger.info(`🌐 CORS enabled for local development`);
  logger.info(`✅ Server is ready to accept connections`);
});

