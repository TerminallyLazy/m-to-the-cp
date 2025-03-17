import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import path from "path";

export class MCPConnectionManager {
  private connections: Map<string, Client> = new Map();
  private transportMap: Map<string, StdioClientTransport | SSEClientTransport> = new Map();
  
  /**
   * Connect to a server using a specific command and arguments
   * @param id Unique identifier for this server connection
   * @param command Command to execute (e.g., "npx", "node", "python3")
   * @param args Command arguments (e.g., ["some-package-name"] or ["server.js"])
   * @returns Connected client instance
   */
  async connectToServer(id: string, command: string, args: string[]): Promise<Client> {
    // Create a new client
    const client = new Client(
      { name: 'multi-server-client', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
    
    // Connect using stdio transport
    const transport = new StdioClientTransport({ command, args });
    this.transportMap.set(id, transport);
    
    await client.connect(transport);
    // Note: The initialize method is not needed or not available in the current SDK version
    
    // Store the connection
    this.connections.set(id, client);
    
    console.log(`Connected to server: ${id}`);
    return client;
  }
  
  /**
   * Connect to a server using a script path
   * @param id Unique identifier for this server connection
   * @param serverScriptPath Path to the server script or package name
   * @param additionalArgs Additional arguments to pass to the server
   * @returns Connected client instance
   */
  async connectToServerWithPath(id: string, serverScriptPath: string, additionalArgs: string[] = []): Promise<Client> {
    // Determine the type of server based on path
    const isJs = serverScriptPath.endsWith('.js');
    const isPy = serverScriptPath.endsWith('.py');
    const hasVersionSuffix = /.*@\d+(\.\d+)*$/.test(serverScriptPath) && !serverScriptPath.startsWith('@');
    const isNpmPackage = serverScriptPath.startsWith('@') || 
                        (!serverScriptPath.includes('/') && 
                         !serverScriptPath.includes('\\') &&
                         !isJs && !isPy) ||
                        hasVersionSuffix;
    
    let command: string;
    let args: string[];
    
    if (isNpmPackage) {
      // Handle NPM package as a server
      command = "npx";
      args = ["-y", serverScriptPath, ...additionalArgs];
    } else if (isJs) {
      // Handle JS file as a server
      command = process.execPath;
      args = [serverScriptPath, ...additionalArgs];
    } else if (isPy) {
      // Handle Python file as a server
      command = process.platform === "win32" ? "python" : "python3";
      args = [serverScriptPath, ...additionalArgs];
    } else {
      throw new Error("Server script must be a .js or .py file, or an npm package name");
    }
    
    return this.connectToServer(id, command, args);
  }
  
  /**
   * Get a client by its ID
   */
  getClient(id: string): Client | undefined {
    return this.connections.get(id);
  }
  
  /**
   * Get all connected clients
   */
  getAllClients(): Client[] {
    return Array.from(this.connections.values());
  }
  
  /**
   * Get all client IDs
   */
  getAllClientIds(): string[] {
    return Array.from(this.connections.keys());
  }
  
  /**
   * Disconnect from a specific server
   */
  async disconnectFromServer(id: string): Promise<boolean> {
    const client = this.connections.get(id);
    if (!client) {
      console.warn(`No connection found for server ${id}`);
      return false;
    }
    
    try {
      await client.close();
      this.connections.delete(id);
      this.transportMap.delete(id);
      console.log(`Disconnected from server: ${id}`);
      return true;
    } catch (error) {
      console.error(`Error disconnecting from server ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnections = Array.from(this.connections.entries()).map(async ([id, client]) => {
      try {
        await client.close();
        console.log(`Disconnected from server: ${id}`);
      } catch (error) {
        console.error(`Error disconnecting from server ${id}:`, error);
      }
    });
    
    await Promise.all(disconnections);
    this.connections.clear();
    this.transportMap.clear();
  }
  
  /**
   * Check if connected to a specific server
   */
  isConnected(id: string): boolean {
    return this.connections.has(id);
  }
  
  /**
   * Get all available tools across all servers
   */
  async getAllTools(): Promise<{ serverId: string, tools: any[] }[]> {
    const results = await Promise.all(
      Array.from(this.connections.entries()).map(async ([id, client]) => {
        try {
          const tools = await client.listTools();
          return { serverId: id, tools: tools.tools };
        } catch (error) {
          console.error(`Error getting tools from server ${id}:`, error);
          return { serverId: id, tools: [] };
        }
      })
    );
    
    return results;
  }
  
  /**
   * Get all tools for a specific server
   */
  async getToolsForServer(id: string): Promise<any[]> {
    const client = this.connections.get(id);
    if (!client) {
      console.warn(`No connection found for server ${id}`);
      return [];
    }
    
    try {
      const tools = await client.listTools();
      return tools.tools;
    } catch (error) {
      console.error(`Error getting tools from server ${id}:`, error);
      return [];
    }
  }
} 