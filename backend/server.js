// ==================== UNIFIED TRADING BACKEND (Node.js/Express) ====================
// Multi-broker trading platform with AI agents (Fyers, Kite, Upstox)
// FIXED VERSION - Proper Kite authentication and chat
import EventSource from 'eventsource';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { AzureOpenAI } from 'openai';
import axios from 'axios';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const upstoxAgents = new Map(); // Add this line with other global storage
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

// CORS configuration - MUST come before session
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

// Enhanced session configuration
app.use(session({
  secret: process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: false, // Set to false for local development
    sameSite: 'lax',
    path: '/'
  },
  name: 'unified_trading_session',
  rolling: true
}));

// ==================== CONFIGURATION ====================

// Fyers Azure OpenAI
const AZURE_CONFIG_FYERS = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://your-resource.openai.azure.com/",
  apiKey: process.env.AZURE_OPENAI_API_KEY || "your-api-key",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "o3-mini",
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview"
};

// Kite/Upstox Azure OpenAI
const AZURE_CONFIG_KITE = {
  endpoint: "https://codestore-ai.openai.azure.com/",
  apiKey: "EvkhikwvmvJYbqnV175XrD7C1ym5yXEsYAb5nEz4mbf2BJPXNWeHJQQJ99BJACHYHv6XJ3w3AAABACOGQydk",
  deployment: "o3-mini",
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
const kiteAgents = new Map(); // NEW: Store Kite AI agents
const upstoxClients = new Map();
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
// ==================== UPSTOX AI AGENT ====================

class UpstoxAIAgent {
  constructor(sessionId, azureConfig, upstoxClient) {
    this.sessionId = sessionId;
    this.client = new AzureOpenAI({
      apiKey: azureConfig.apiKey,
      endpoint: azureConfig.endpoint,
      apiVersion: azureConfig.apiVersion,
      deployment: azureConfig.deployment
    });
    this.deployment = azureConfig.deployment;
    this.upstoxClient = upstoxClient;
    this.conversationHistory = [];
    this.availableTools = this.defineUpstoxTools();
    logger.info(`Created Upstox AI Agent for session: ${sessionId.substring(0, 8)}...`);
  }

  defineUpstoxTools() {
    return [
      {
        type: "function",
        function: {
          name: "get_profile",
          description: "Get user profile information from Upstox",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_holdings",
          description: "Get user's long-term holdings from Upstox",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_positions",
          description: "Get user's current positions from Upstox",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_funds",
          description: "Get user's funds and margin information from Upstox",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_instruments",
          description: "Search for trading instruments on Upstox",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for instrument (e.g., 'RELIANCE', 'INFY')"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_market_quote",
          description: "Get market quotes for specified instruments",
          parameters: {
            type: "object",
            properties: {
              instruments: {
                type: "array",
                items: { type: "string" },
                description: "List of instruments (e.g., ['RELIANCE', 'TCS'])"
              }
            },
            required: ["instruments"]
          }
        }
      }
    ];
  }

  async executeUpstoxTool(toolName, args) {
    try {
      switch (toolName) {
        case 'get_profile':
          return await this.upstoxClient.getProfile();
        case 'get_holdings':
          return await this.upstoxClient.getHoldings();
        case 'get_positions':
          return await this.upstoxClient.getPositions();
        case 'get_funds':
          return await this.upstoxClient.getFunds();
        case 'search_instruments':
          return await this.upstoxClient.searchInstruments(args.query);
        case 'get_market_quote':
          return await this.upstoxClient.getMarketQuote(args.instruments);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      logger.error(`Error executing Upstox tool ${toolName}:`, error);
      return { error: error.message };
    }
  }

  async chat(userMessage, maxIterations = 5) {
    this.conversationHistory.push({
      role: "user",
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
          tool_choice: "auto"
        });

        const assistantMessage = response.choices[0].message;

        const messageDict = {
          role: "assistant",
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
          return assistantMessage.content || "No response generated.";
        }

        // Execute tool calls
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          let functionArgs = {};

          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            logger.error('Error parsing tool arguments:', e);
          }

          logger.info(`Calling Upstox tool: ${functionName}`);
          const toolResult = await this.executeUpstoxTool(functionName, functionArgs);
          
          this.conversationHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
      } catch (error) {
        logger.error('Error in Upstox chat:', error);
        return `Error: ${error.message}`;
      }
    }

    return "Maximum iterations reached.";
  }

  resetConversation() {
    this.conversationHistory = [];
  }
}
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
      const response = await axios.post(this.mcpUrl, initRequest);
      this.mcpSessionId = response.headers['mcp-session-id'];
      logger.info(`Fyers MCP connected. Session ID: ${this.mcpSessionId}`);
      
      if (this.mcpSessionId) {
        this.headers['Mcp-Session-Id'] = this.mcpSessionId;
      }

      const initNotification = {
        jsonrpc: "2.0",
        method: "notifications/initialized"
      };

      await axios.post(this.mcpUrl, initNotification, { headers: this.headers });
      logger.info('Fyers MCP initialized successfully');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Error initializing Fyers MCP:', error);
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
      const response = await axios.post(this.mcpUrl, request, { headers: this.headers });
      const tools = response.data?.result?.tools || [];
      this.toolsCache = tools;
      logger.info(`Found ${tools.length} Fyers tools`);
      return tools;
    } catch (error) {
      logger.error('Error listing Fyers tools:', error);
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
      const response = await axios.post(this.mcpUrl, request, { headers: this.headers });
      
      if (response.data.error) {
        logger.error('Fyers tool error:', response.data.error);
        return null;
      }

      return response.data.result || {};
    } catch (error) {
      logger.error('Exception calling Fyers tool:', error);
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
}

// ==================== FYERS AI AGENT ====================

class AzureOpenAIFyersAgent {
  constructor(sessionId, azureConfig) {
    this.sessionId = sessionId;
    this.client = new AzureOpenAI({
      apiKey: azureConfig.apiKey,
      endpoint: azureConfig.endpoint,
      apiVersion: azureConfig.apiVersion,
      deployment: azureConfig.deployment
    });
    this.deployment = azureConfig.deployment;
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
        type: "object",
        properties: {},
        required: []
      };

      const fixedSchema = this.fixArraySchema(JSON.parse(JSON.stringify(inputSchema)));

      return {
        type: "function",
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
      role: "user",
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
          tool_choice: "auto"
        });

        const assistantMessage = response.choices[0].message;

        const messageDict = {
          role: "assistant",
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
          return assistantMessage.content || "No response generated.";
        }

        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          let functionArgs = {};

          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            logger.error('Error parsing tool arguments:', e);
          }

          const toolResultRaw = await this.mcpClient.callTool(functionName, functionArgs);
          const toolResult = this.mcpClient.extractTextFromResult(toolResultRaw);

          this.conversationHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult || "Tool executed successfully."
          });
        }
      } catch (error) {
        logger.error('Error in Fyers chat:', error);
        return `Error: ${error.message}`;
      }
    }

    return "Maximum iterations reached.";
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
    this.mcpSessionId = null; // NEW: Store MCP session ID
    this.headers = { 'Content-Type': 'application/json' };
    this.requestId = 1;
    this.isInitialized = false;
    this.isAuthenticated = false; // NEW: Track authentication status
    this.serverCapabilities = null;
    this.toolsCache = []; // NEW: Cache tools
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

      logger.info('📤 Sending initialize request to:', this.mcpUrl);

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
      logger.error('Error listing Kite tools:', error);
      return [];
    }
  }

  async callTool(toolName, args = {}) {
    if (!this.connected || !this.isInitialized) {
      logger.info('🔌 Not connected, connecting now...');
      await this.connect();
    }

    try {
      logger.info(`🔧 Calling Kite tool: ${toolName} with args:`, JSON.stringify(args));

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

      logger.info('📤 Tool request:', JSON.stringify(request));

      const result = await this.sendRequest(request);
      logger.info('📥 Tool result received');

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
      logger.error('❌ Kite tool error:', error);
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

// ==================== KITE AI AGENT (NEW) ====================

class KiteAIAgent {
  constructor(sessionId, azureConfig) {
    this.sessionId = sessionId;
    this.client = new AzureOpenAI({
      apiKey: azureConfig.apiKey,
      endpoint: azureConfig.endpoint,
      apiVersion: azureConfig.apiVersion,
      deployment: azureConfig.deployment
    });
    this.deployment = azureConfig.deployment;
    this.mcpClient = null;
    this.conversationHistory = [];
    this.availableTools = [];
    logger.info(`Created Kite AI Agent for session: ${sessionId.substring(0, 8)}...`);
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
        type: "object",
        properties: {},
        required: []
      };

      const fixedSchema = this.fixArraySchema(JSON.parse(JSON.stringify(inputSchema)));

      return {
        type: "function",
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
    logger.info(`Kite agent initialized with ${this.availableTools.length} tools`);
  }

  async chat(userMessage, maxIterations = 5) {
    this.conversationHistory.push({
      role: "user",
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
          tool_choice: "auto"
        });

        const assistantMessage = response.choices[0].message;

        const messageDict = {
          role: "assistant",
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
          return assistantMessage.content || "No response generated.";
        }

        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          let functionArgs = {};

          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            logger.error('Error parsing tool arguments:', e);
          }

          logger.info(`Calling Kite tool: ${functionName}`);
          const toolResultRaw = await this.mcpClient.callTool(functionName, functionArgs);
          const toolResult = this.mcpClient.extractTextFromResult(toolResultRaw);

          this.conversationHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult || "Tool executed successfully."
          });
        }
      } catch (error) {
        logger.error('Error in Kite chat:', error);
        return `Error: ${error.message}`;
      }
    }

    return "Maximum iterations reached.";
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
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
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

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'unified-trading-backend',
    port: PORT,
    brokers: ['fyers', 'kite', 'upstox']
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
    logger.error('Fyers connect error:', error);
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
    logger.error('Fyers login error:', error);
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
    logger.error('Fyers verify auth error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== KITE ROUTES (FIXED) ====================

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
      
      // Strategy 1: Direct Kite URL match
      const kiteMatch = text.match(/https:\/\/kite\.zerodha\.com\/connect\/login\?[^\s\)"\]<>]+/);
      if (kiteMatch) {
        loginUrl = kiteMatch[0];
      }
      
      // Strategy 2: Any HTTPS URL
      if (!loginUrl) {
        const urlMatch = text.match(/https:\/\/[^\s\)"\]<>]+/);
        if (urlMatch) {
          loginUrl = urlMatch[0];
        }
      }
      
      // Strategy 3: Check if text IS the URL
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
    logger.error('❌ Kite login error:', error);
    
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
      
      // Check if it's the demo/John Doe account
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
      
      // Real user data received - mark as authenticated
      logger.info('✅ Kite authentication verified - real user data received');
      client.isAuthenticated = true;
      
      // Create Kite AI agent
      const agent = new KiteAIAgent(sessionId, AZURE_CONFIG_KITE);
      await agent.initialize(client);
      kiteAgents.set(sessionId, agent);
      
      setActiveBroker(req, 'kite');

      return res.json({
        success: true,
        authenticated: true,
        message: 'Successfully authenticated with Kite',
        profile: profileText.substring(0, 200),
        tools_count: agent.availableTools.length
      });
    }

    return res.json({
      success: false,
      authenticated: false,
      error: 'No profile data received'
    });

  } catch (error) {
    logger.error('❌ Kite verify auth error:', error);
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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const accessToken = response.data.access_token;
    req.session.upstoxAccessToken = accessToken;
    
    // Create Upstox client and agent
    const sessionId = getSessionId(req);
    const upstoxClient = new UpstoxClient(accessToken);
    upstoxClients.set(sessionId, upstoxClient);
    
    const agent = new UpstoxAIAgent(sessionId, AZURE_CONFIG_KITE, upstoxClient);
    upstoxAgents.set(sessionId, agent);
    
    setActiveBroker(req, 'upstox');

    res.redirect('http://localhost:5173?login=success&broker=upstox');
  } catch (error) {
    logger.error('Upstox OAuth error:', error);
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

// ==================== UNIFIED CHAT (FIXED FOR KITE) ====================

app.post('/api/chat', async (req, res) => {
  const sessionId = getSessionId(req);
  const activeBroker = getActiveBroker(req);
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'No message' });
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
        broker: 'fyers'
      });
      
    } else if (activeBroker === 'kite') {
      // Use Kite AI Agent with tool calling
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
        broker: 'kite'
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
    broker: 'upstox'
  });
}
  } catch (error) {
    logger.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function getConversationHistory(req) {
  const sessionId = getSessionId(req);
  const broker = getActiveBroker(req);
  const key = `${sessionId}_${broker}`;

  if (!conversationHistories.has(key)) {
    conversationHistories.set(key, []);
  }

  return conversationHistories.get(key);
}

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
    } else {
      const key = `${sessionId}_${activeBroker}`;
      conversationHistories.set(key, []);
    }

    res.json({
      success: true,
      message: 'Conversation reset'
    });
  } catch (error) {
    logger.error('Reset error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== LOGOUT ====================

app.post('/api/logout', async (req, res) => {
  const { broker = 'all' } = req.body;
  const sessionId = getSessionId(req);

  try {
    if (broker === 'all') {
      fyersMcpClients.delete(sessionId);
      fyersAgents.delete(sessionId);
      kiteClients.delete(sessionId);
      kiteAgents.delete(sessionId);
      upstoxClients.delete(sessionId);
      
      req.session.destroy();

      return res.json({
        success: true,
        message: 'Logged out from all brokers'
      });
    } else if (broker === 'fyers') {
      fyersMcpClients.delete(sessionId);
      fyersAgents.delete(sessionId);

      return res.json({
        success: true,
        message: 'Logged out from Fyers'
      });
    } else if (broker === 'kite') {
      kiteClients.delete(sessionId);
      kiteAgents.delete(sessionId);

      return res.json({
        success: true,
        message: 'Logged out from Kite'
      });
    } else if (broker === 'upstox') {
  delete req.session.upstoxAccessToken;
  upstoxClients.delete(sessionId);
  upstoxAgents.delete(sessionId); // Add this line

  return res.json({
    success: true,
    message: 'Logged out from Upstox'
  });
}

    res.status(400).json({
      success: false,
      error: 'Invalid broker'
    });
  } catch (error) {
    logger.error('Logout error:', error);
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
    fyers_initialized: fyersMcpClients.has(sessionId),
    kite_initialized: kiteClients.has(sessionId),
    kite_authenticated: kiteClients.has(sessionId) && kiteClients.get(sessionId).isAuthenticated,
    upstox_authenticated: !!req.session.upstoxAccessToken
  });
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// ==================== START SERVER ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(70));
  console.log('🚀 UNIFIED TRADING BACKEND (Fixed Version)');
  console.log('='.repeat(70));
  console.log();
  console.log(`📡 Port: ${PORT}`);
  console.log('🔗 Brokers: Fyers, Kite (with AI agent!), Upstox');
  console.log();
  console.log('📋 Key Features:');
  console.log('  ✅ Kite authentication verification (checks for real user data)');
  console.log('  ✅ Kite AI Agent with tool calling support');
  console.log('  ✅ Proper session management');
  console.log('  ✅ Enhanced error handling');
  console.log();
  console.log('='.repeat(70));
  console.log();

  if (AZURE_CONFIG_FYERS.endpoint.includes('your-resource')) {
    logger.warn('⚠️  Fyers Azure OpenAI not configured');
  }

  logger.info('✅ Backend ready');
});