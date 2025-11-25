// ==================== src/services/kite/KiteMCPClient.js ====================
import axios from 'axios';
import { logger } from '../../utils/logger.js';

export class KiteMCPClient {
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