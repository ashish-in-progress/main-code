import { AzureChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { AgentExecutor, createToolCallingAgent } from '@langchain/classic/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

export class FyersLangChainAgent {
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
      ["system", "You are a trading assistant for the Fyers broker. Use tools for any request involving orders, positions, holdings, funds, charts, option chain, alerts, or watchlists (watchlist id is lut). Ask for missing details instead of assuming. Only place, modify, or cancel orders when the user gives explicit instructions. For watchlist symbols, always use format like NSE:TCS-EQ with no .NS. If a tool is required, respond ONLY with the tool call. If no tool is needed, reply normally."],
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