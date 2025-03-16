import { Anthropic } from "@anthropic-ai/sdk";
import {
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import readline from "readline/promises";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

dotenv.config();

// Check if ANTHROPIC_API_KEY is set
const apiKey = process.env.ANTHROPIC_API_KEY;
// Allow development mode without a valid API key
const isDevelopment = process.env.NODE_ENV === 'development';

if (!apiKey && !isDevelopment) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

export class MCPClient {
  private mcp: Client;
  private anthropic: Anthropic;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private tools: Tool[] = [];
  private connectedServers: Map<string, boolean> = new Map();
  private serverTools: Map<string, Tool[]> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000; // Base delay in ms
  private approvalCallback: ((toolName: string, args: any) => Promise<boolean>) | null = null;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
    
    // Initialize the MCP Client with proper metadata
    this.mcp = new Client(
      { name: "mcp-client-typescript", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
  }

  async connectToServer(serverScriptPath: string) {
    try {
      // Normalize server ID extraction to handle different path formats
      let serverId: string;
      let originalServerId: string;

      // Check if it's an npm package (doesn't have path separators or file extensions)
      if (!serverScriptPath.includes('/') && !serverScriptPath.includes('\\') && 
          !serverScriptPath.endsWith('.js') && !serverScriptPath.endsWith('.py')) {
        // For npm packages, keep the original ID for logging
        originalServerId = serverScriptPath;
        
        // Extract the package name without scope as the ID
        serverId = serverScriptPath.split('/').pop() || serverScriptPath;
      } else {
        // For file paths, keep the original path for logging
        originalServerId = serverScriptPath;
        
        // Extract the basename without extension
        serverId = path.basename(serverScriptPath).replace(/\.(js|py|ts)$/, '');
      }
      
      // Normalize the ID consistently
      const normalizedId = serverId.replace(/^(mcp-)?server-/, '');
      
      console.log(`Connecting to server: original=${originalServerId}, extracted=${serverId}, normalized=${normalizedId}`);
      
      // Check if already connected using both original and normalized IDs
      if (this.connectedServers.get(normalizedId) || this.connectedServers.get(serverId)) {
        console.log(`Already connected to server: ${normalizedId}`);
        return;
      }
      
      // Reset reconnect attempts if this is a fresh connection
      this.reconnectAttempts.set(normalizedId, 0);
      
      const isJs = serverScriptPath.endsWith(".js") || serverScriptPath.endsWith(".ts");
      const isPy = serverScriptPath.endsWith(".py");
      const isNpmPackage = !serverScriptPath.includes('.') && (
        serverScriptPath.startsWith('@') || 
        !serverScriptPath.includes('/')
      );
      
      if (isNpmPackage) {
        // Handle NPM package as a server
        this.transport = new StdioClientTransport({
          command: "npx",
          args: ["-y", serverScriptPath],
        });
      } else if (isJs) {
        // Handle JS file as a server
        this.transport = new StdioClientTransport({
          command: process.execPath,
          args: [serverScriptPath],
        });
      } else if (isPy) {
        // Handle Python file as a server
        const pythonCommand = process.platform === "win32" ? "python" : "python3";
        this.transport = new StdioClientTransport({
          command: pythonCommand,
          args: [serverScriptPath],
        });
      } else {
        throw new Error("Server script must be a .js or .py file, or an npm package name");
      }

      // Connect to the server
      this.mcp.connect(this.transport);
      
      // Discover available tools
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });
      
      console.log(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name)
      );
      
      // Mark server as connected with NORMALIZED ID
      this.connectedServers.set(normalizedId, true);
      
      // Also store with the original extracted ID for backward compatibility
      if (serverId !== normalizedId) {
        this.connectedServers.set(serverId, true);
      }
      
      // Store the tools for this server
      this.serverTools.set(normalizedId, [...this.tools]);
      // Also store with original ID for backward compatibility
      if (serverId !== normalizedId) {
        this.serverTools.set(serverId, [...this.tools]);
      }
      
      console.log(`Successfully connected to server: ${normalizedId}`);
      console.log(`Current connected servers: ${Array.from(this.connectedServers.entries())}`);
    } catch (e) {
      console.error("Failed to connect to MCP server: ", e);
      
      // Handle reconnection logic
      const serverId = path.basename(serverScriptPath).replace(/\.(js|py)$/, '');
      const attempts = this.reconnectAttempts.get(serverId) || 0;
      
      if (attempts < this.maxReconnectAttempts) {
        this.reconnectAttempts.set(serverId, attempts + 1);
        const delay = this.reconnectDelay * Math.pow(2, attempts); // Exponential backoff
        
        console.log(`Attempting to reconnect to ${serverId} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
          this.connectToServer(serverScriptPath);
        }, delay);
      } else {
        console.error(`Max reconnection attempts reached for server: ${serverId}`);
      }
      
      throw e;
    }
  }

  async connectToServerWithArgs(serverScriptPath: string, additionalArgs: string[] = []) {
    try {
      // Normalize server ID extraction to handle different path formats
      let serverId: string;
      let originalServerId: string;

      // Check if it's an npm package (doesn't have path separators or file extensions)
      if (!serverScriptPath.includes('/') && !serverScriptPath.includes('\\') && 
          !serverScriptPath.endsWith('.js') && !serverScriptPath.endsWith('.py')) {
        // For npm packages, keep the original ID for logging
        originalServerId = serverScriptPath;
        
        // Extract the package name without scope as the ID
        serverId = serverScriptPath.split('/').pop() || serverScriptPath;
      } else {
        // For file paths, keep the original path for logging
        originalServerId = serverScriptPath;
        
        // Extract the basename without extension
        serverId = path.basename(serverScriptPath).replace(/\.(js|py|ts)$/, '');
      }
      
      // Normalize the ID consistently
      const normalizedId = serverId.replace(/^(mcp-)?server-/, '');
      
      console.log(`Connecting to server with ID: ${serverId}, path: ${serverScriptPath}, with additional args: ${additionalArgs.join(' ')}`);
      
      // Check if already connected using both original and normalized IDs
      if (this.connectedServers.get(normalizedId) || this.connectedServers.get(serverId)) {
        console.log(`Already connected to server: ${normalizedId}`);
        return;
      }
      
      // Reset reconnect attempts if this is a fresh connection
      this.reconnectAttempts.set(normalizedId, 0);
      
      const isJs = serverScriptPath.endsWith(".js") || serverScriptPath.endsWith(".ts");
      const isPy = serverScriptPath.endsWith(".py");
      const isNpmPackage = !serverScriptPath.includes('.') && (
        serverScriptPath.startsWith('@') || 
        !serverScriptPath.includes('/')
      );
      
      if (isNpmPackage) {
        // Handle NPM package as a server with additional arguments
        this.transport = new StdioClientTransport({
          command: "npx",
          args: ["-y", serverScriptPath, ...additionalArgs],
        });
      } else if (isJs) {
        // Handle JS file as a server with additional arguments
        this.transport = new StdioClientTransport({
          command: process.execPath,
          args: [serverScriptPath, ...additionalArgs],
        });
      } else if (isPy) {
        // Handle Python file as a server with additional arguments
        const pythonCommand = process.platform === "win32" ? "python" : "python3";
        this.transport = new StdioClientTransport({
          command: pythonCommand,
          args: [serverScriptPath, ...additionalArgs],
        });
      } else {
        throw new Error("Server script must be a .js or .py file, or an npm package name");
      }

      // Connect to the server
      this.mcp.connect(this.transport);
      
      // Discover available tools
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });
      
      console.log(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name)
      );
      
      // Mark server as connected with NORMALIZED ID
      this.connectedServers.set(normalizedId, true);
      
      // Also store with the original extracted ID for backward compatibility
      if (serverId !== normalizedId) {
        this.connectedServers.set(serverId, true);
      }
      
      // Store the tools for this server
      this.serverTools.set(normalizedId, [...this.tools]);
      // Also store with original ID for backward compatibility
      if (serverId !== normalizedId) {
        this.serverTools.set(serverId, [...this.tools]);
      }
      
      console.log(`Successfully connected to server: ${normalizedId}`);
      console.log(`Current connected servers: ${Array.from(this.connectedServers.entries())}`);
    } catch (e) {
      console.error("Failed to connect to MCP server: ", e);
      
      // Handle reconnection logic
      const serverId = path.basename(serverScriptPath).replace(/\.(js|py)$/, '');
      const attempts = this.reconnectAttempts.get(serverId) || 0;
      
      if (attempts < this.maxReconnectAttempts) {
        this.reconnectAttempts.set(serverId, attempts + 1);
        const delay = this.reconnectDelay * Math.pow(2, attempts); // Exponential backoff
        
        console.log(`Attempting to reconnect to ${serverId} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
          this.connectToServerWithArgs(serverScriptPath, additionalArgs);
        }, delay);
      } else {
        console.error(`Max reconnection attempts reached for server: ${serverId}`);
      }
      
      throw e;
    }
  }

  async processQuery(query: string, temperature = 0.7, tools_enabled = true) {
    const messages: MessageParam[] = [
      {
        role: "user",
        content: query,
      },
    ];
  
    const response = await this.anthropic.messages.create({
      model: "claude-3-7-sonnet-latest",
      max_tokens: 1000,
      temperature: temperature,
      messages,
      tools: tools_enabled ? this.tools : undefined,
    });
  
    const finalText = [];
    const toolResults = [];
  
    for (const content of response.content) {
      if (content.type === "text") {
        finalText.push(content.text);
      } else if (content.type === "tool_use") {
        const toolName = content.name;
        const toolArgs = content.input as { [x: string]: unknown } | undefined;
  
        // Implement human-in-the-loop approval for sensitive tools
        // This is a placeholder - you would implement your own approval UI
        const shouldExecute = await this.getUserApproval(toolName, toolArgs);
        
        if (shouldExecute) {
          try {
            const result = await this.mcp.callTool({
              name: toolName,
              arguments: toolArgs,
            });
            
            toolResults.push(result);
            finalText.push(
              `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
            );
            
            messages.push({
              role: "user",
              content: result.content as string,
            });
            
            const response = await this.anthropic.messages.create({
              model: "claude-3-7-sonnet-latest",
              max_tokens: 1000,
              temperature: temperature,
              messages,
            });
            
            finalText.push(
              response.content[0].type === "text" ? response.content[0].text : ""
            );
          } catch (error) {
            console.error(`Error executing tool ${toolName}:`, error);
            
            finalText.push(
              `[Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}]`
            );
            
            messages.push({
              role: "user",
              content: `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
            });
            
            const response = await this.anthropic.messages.create({
              model: "claude-3-7-sonnet-latest",
              max_tokens: 1000,
              temperature: temperature,
              messages,
            });
            
            finalText.push(
              response.content[0].type === "text" ? response.content[0].text : ""
            );
          }
        } else {
          finalText.push(
            `[Tool execution of ${toolName} was not approved by the user]`
          );
          
          messages.push({
            role: "user",
            content: `The user did not approve the execution of tool ${toolName}.`,
          });
          
          const response = await this.anthropic.messages.create({
            model: "claude-3-7-sonnet-latest",
            max_tokens: 1000,
            temperature: temperature,
            messages,
          });
          
          finalText.push(
            response.content[0].type === "text" ? response.content[0].text : ""
          );
        }
      }
    }
  
    return finalText.join("\n");
  }

  async processQueryStructured(query: string, temperature = 0.7, tools_enabled = true) {
    const messages: MessageParam[] = [
      {
        role: "user",
        content: query,
      },
    ];
    
    const response = await this.anthropic.messages.create({
      model: "claude-3-7-sonnet-latest",
      max_tokens: 1000,
      temperature: temperature,
      messages,
      tools: tools_enabled ? this.tools : undefined,
    });
  
    // Create result object with proper typing
    const result: {
      id: string;
      role: 'assistant' | 'user';
      content: string;
      timestamp: Date;
      toolCalls: Array<{
        name: string;
        args: any;
        status: string;
        result: any;
      }>;
    } = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      toolCalls: []
    };
    
    // Process the response content
    for (const content of response.content) {
      if (content.type === "text") {
        result.content += content.text;
      } else if (content.type === "tool_use") {
        const toolName = content.name;
        const toolArgs = content.input as { [x: string]: unknown } | undefined;
  
        // Create a new tool call object with proper typing
        const toolCall: {
          name: string;
          args: any;
          status: string;
          result: any;
        } = {
          name: toolName,
          args: toolArgs || {},
          status: 'pending',
          result: {}
        };
        
        // Add to result
        result.toolCalls.push(toolCall);
        
        // Implement human-in-the-loop approval for sensitive tools
        const shouldExecute = await this.getUserApproval(toolName, toolArgs);
        
        if (shouldExecute) {
          try {
            const executionResult = await this.mcp.callTool({
              name: toolName,
              arguments: toolArgs,
            });
            
            // Update tool call with results
            toolCall.status = 'success';
            toolCall.result = executionResult;
            
            // Feed the result back to the model
            messages.push({
              role: "user",
              content: executionResult.content as string,
            });
            
            const followUpResponse = await this.anthropic.messages.create({
              model: "claude-3-7-sonnet-latest",
              max_tokens: 1000,
              temperature: temperature,
              messages,
            });
            
            // Append to content
            if (followUpResponse.content[0]?.type === "text") {
              result.content += "\n\n" + followUpResponse.content[0].text;
            }
          } catch (error) {
            // Update tool call with error
            toolCall.status = 'error';
            toolCall.result = {
              error: error instanceof Error ? error.message : String(error)
            };
            
            // Feed the error back to the model
            messages.push({
              role: "user",
              content: `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
            });
            
            const errorResponse = await this.anthropic.messages.create({
              model: "claude-3-7-sonnet-latest",
              max_tokens: 1000,
              temperature: temperature,
              messages,
            });
            
            // Append to content
            if (errorResponse.content[0]?.type === "text") {
              result.content += "\n\n" + errorResponse.content[0].text;
            }
          }
        } else {
          // Update tool call with not approved status
          toolCall.status = 'not_approved';
          toolCall.result = {
            error: 'Tool execution was not approved by the user'
          };
          
          // Feed the non-approval back to the model
          messages.push({
            role: "user",
            content: `The user did not approve the execution of tool ${toolName}.`,
          });
          
          const nonApprovalResponse = await this.anthropic.messages.create({
            model: "claude-3-7-sonnet-latest",
            max_tokens: 1000,
            temperature: temperature,
            messages,
          });
          
          // Append to content
          if (nonApprovalResponse.content[0]?.type === "text") {
            result.content += "\n\n" + nonApprovalResponse.content[0].text;
          }
        }
      }
    }
    
    return result;
  }

  // Simple user approval implementation - can be overridden with setApprovalCallback
  private async getUserApproval(toolName: string, args: any): Promise<boolean> {
    // If a custom approval callback is set, use that
    if (this.approvalCallback) {
      return this.approvalCallback(toolName, args);
    }
    
    // Default implementation: auto-approve all tools
    console.log(`Auto-approving tool execution: ${toolName} with args:`, args);
    return true;
  }
  
  // Set a custom approval callback for UI integration
  setApprovalCallback(callback: (toolName: string, args: any) => Promise<boolean>): void {
    this.approvalCallback = callback;
    console.log('Custom approval callback set for tool execution');
  }

  async chatLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  
    try {
      console.log("\nMCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");
  
      while (true) {
        const message = await rl.question("\nQuery: ");
        if (message.toLowerCase() === "quit") {
          break;
        }
        const response = await this.processQuery(message);
        console.log("\n" + response);
      }
    } finally {
      rl.close();
    }
  }
  
  async cleanup() {
    await this.mcp.close();
  }
  
  // Check if connected to a specific server
  isConnected(serverId: string): boolean {
    // Try with the original ID first
    const directCheck = this.connectedServers.get(serverId) || false;
    if (directCheck) return true;
    
    // Try with a normalized ID
    const normalizedId = serverId.replace(/^(mcp-)?server-/, '');
    const normalizedCheck = this.connectedServers.get(normalizedId) || false;
    if (normalizedCheck) return true;
    
    // Try with the server- prefix if it doesn't have one
    if (!serverId.includes('server-')) {
      const withPrefixId = `server-${normalizedId}`;
      const prefixCheck = this.connectedServers.get(withPrefixId) || false;
      if (prefixCheck) return true;
    }
    
    return false;
  }

  async disconnectFromServer(serverId: string): Promise<boolean> {
    try {
      // Normalize the server ID
      const normalizedId = serverId.replace(/^(mcp-)?server-/, '').toLowerCase();
      
      console.log(`Attempting to disconnect from server: ${serverId} (normalized: ${normalizedId})`);
      
      // Check if directly connected with this ID
      let directlyConnected = this.connectedServers.get(serverId) || false;
      
      // If not found with the direct ID, check with normalized ID
      if (!directlyConnected) {
        directlyConnected = this.connectedServers.get(normalizedId) || false;
      }
      
      // If not connected, just return
      if (!directlyConnected) {
        console.log(`Server ${serverId} not connected - nothing to disconnect`);
        return true;
      }
      
      // Reset connection flags
      this.connectedServers.set(serverId, false);
      
      // Also reset for normalized ID if different
      if (serverId !== normalizedId) {
        this.connectedServers.set(normalizedId, false);
      }
      
      // Clear tools for this server
      this.serverTools.delete(serverId);
      this.serverTools.delete(normalizedId);
      
      console.log(`Disconnected from server: ${serverId}`);
      
      // Check if any servers are still connected
      const anyServersConnected = Array.from(this.connectedServers.values()).some(isConnected => isConnected);
      
      // If no more connected servers, reset the tools list
      if (!anyServersConnected) {
        console.log('No more connected servers - clearing all tools');
        this.tools = [];
      } else {
        // Otherwise, rebuild the tools list from all connected servers
        this.tools = [];
        this.connectedServers.forEach((isConnected, sId) => {
          if (isConnected) {
            const serverToolsList = this.serverTools.get(sId) || [];
            this.tools.push(...serverToolsList);
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error disconnecting from server:', error);
      return false;
    }
  }

  // Get all available tools
  getTools(): Tool[] {
    return this.tools;
  }

  // Get tools for a specific server
  getToolsForServer(serverId: string): Tool[] {
    // Normalize the ID
    const normalizedId = serverId.replace(/^(mcp-)?server-/, '').toLowerCase();
    
    // Try with both the original and normalized IDs
    return this.serverTools.get(serverId) || 
           this.serverTools.get(normalizedId) || 
           [];
  }

  // Get all connected servers
  getAllConnectedServers(): string[] {
    const connectedServers: string[] = [];
    const normalizedMap = new Map<string, boolean>();
    
    // First collect all connected servers
    this.connectedServers.forEach((isConnected, serverId) => {
      if (isConnected) {
        // Normalize the ID for deduplication
        const normalizedId = serverId.replace(/^(mcp-)?server-/, '');
        
        // Add both the original and normalized versions to ensure we catch all formats
        connectedServers.push(serverId);
        
        // Keep track of which normalized IDs we've seen to avoid duplicates
        normalizedMap.set(normalizedId, true);
      }
    });
    
    console.log('All connected server IDs (with duplicates):', connectedServers);
    console.log('Normalized connected server map:', Array.from(normalizedMap.entries()));
    
    return connectedServers;
  }
}

async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: node index.ts <path_to_server_script>");
      return;
    }
    const mcpClient = new MCPClient();
    try {
      await mcpClient.connectToServer(process.argv[2]);
      await mcpClient.chatLoop();
    } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}

// Only run the main function if this file is executed directly (ES module approach)
// Get the URL for the current module
const currentModulePath = fileURLToPath(import.meta.url);
// Check if this module is being run directly
if (process.argv[1] === currentModulePath) {
  main();
}
   