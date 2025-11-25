// ==================== src/services/kite/KiteLangChainAgent.js ====================
import { AzureChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { AgentExecutor, createToolCallingAgent } from '@langchain/classic/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

export class KiteLangChainAgent {
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
      ["system", "You are a Kite/Zerodha trading assistant. Use tools for any account, order, portfolio, position, GTT, or market-data request. Ask for missing details instead of guessing. Only place/modify/cancel orders when the user gives explicit trade instructions. Use market-data tools for prices, tokens, OHLC, quotes, searches. Give analysis when asked, without financial advice. Respond with a tool call only when required; otherwise reply normally."],
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