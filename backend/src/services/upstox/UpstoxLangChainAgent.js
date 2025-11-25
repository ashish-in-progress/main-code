import { AzureChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { AgentExecutor, createToolCallingAgent } from '@langchain/classic/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

export class UpstoxLangChainAgent {
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