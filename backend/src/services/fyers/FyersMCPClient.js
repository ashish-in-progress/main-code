// ==================== src/services/fyers/FyersMCPClient.js ====================
import axios from 'axios';
import { logger } from '../../utils/logger.js';

export class FyersMCPClient {
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