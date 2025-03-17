import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { validateAndCallTool } from './validateAndCallTool.js';
import dotenv from 'dotenv';

dotenv.config();

// LLM Provider interface to standardize different implementations
export interface LLMProvider {
  name: string;
  sendMessage(messages: any[], options?: any): Promise<any>;
  formatTools(mcpTools: any[]): any[];
  extractToolCalls(response: any): any[];
}

// Main class that combines MCP with LLM capabilities
export class LLMWithTools {
  private mcpClient: Client;
  private llmProvider: LLMProvider;
  private availableTools: any[] = [];
  
  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
    
    // Initialize MCP client
    this.mcpClient = new Client(
      { name: 'LLMWithTools', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
  }
  
  async connect(serverCommand: string, args: string[] = []) {
    // Connect to MCP server
    const transport = new StdioClientTransport({
      command: serverCommand,
      args: args
    });
    
    this.mcpClient.connect(transport);
    
    // Discover available tools
    const toolsResult = await this.mcpClient.listTools();
    this.availableTools = toolsResult.tools;
    
    console.log(`Connected to MCP server, found ${this.availableTools.length} tools`);
    return this.availableTools;
  }
  
  async chat(messages: any[], options: any = {}) {
    // Format tools for the specific LLM provider
    const formattedTools = this.llmProvider.formatTools(this.availableTools);
    
    // Add tools to options
    const llmOptions = { ...options, tools: formattedTools };
    
    // Send to LLM
    console.log(`Sending request to ${this.llmProvider.name}...`);
    const response = await this.llmProvider.sendMessage(messages, llmOptions);
    
    // Process tool calls if any
    const toolCalls = this.llmProvider.extractToolCalls(response);
    
    // Execute tool calls with validation
    if (toolCalls.length > 0) {
      console.log(`Received ${toolCalls.length} tool calls from ${this.llmProvider.name}`);
      
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          try {
            // Use our validateAndCallTool utility for schema validation
            const result = await validateAndCallTool(
              this.mcpClient, 
              toolCall.name, 
              toolCall.arguments
            );
            
            return {
              name: toolCall.name,
              status: 'success',
              result: result
            };
          } catch (error: any) {
            console.error(`Error calling tool ${toolCall.name}:`, error.message);
            return {
              name: toolCall.name,
              status: 'error',
              error: error.message
            };
          }
        })
      );
      
      // Return combined response
      return {
        llmResponse: response,
        toolResults: toolResults
      };
    }
    
    // Return just the LLM response if no tool calls
    return {
      llmResponse: response,
      toolResults: []
    };
  }
  
  getAvailableTools() {
    return this.availableTools;
  }
} 