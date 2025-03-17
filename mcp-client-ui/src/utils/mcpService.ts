// This service integrates with the MCP Client backend API

// API base URL - ensure consistent origin handling
const API_BASE_URL = `${window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin}/api`;

// Utility function to normalize server IDs for consistent comparison
const normalizeServerId = (id: string): string => {
  return id.replace(/^(mcp-)?server-/, '').toLowerCase();
};

// Message interface for the chat - aligned with Anthropic's message format
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: Array<{
    name: string;
    args: any;
    status: string;
    result?: any;
  }>;
}

// Tool interface - aligned with Anthropic's Tool type
export interface McpTool {
  name: string;
  description?: string;
  serverId?: string; // Keep track of which server provides this tool
  inputSchema?: any; // JSON Schema for the tool's parameters
}

// Server interface
export interface McpServer {
  id: string;
  name: string;
  connected: boolean;
  description?: string;
  tools?: McpTool[]; // Tools provided by this server
}

// Tool approval callback type
type ToolApprovalCallback = (toolName: string, args: any) => Promise<boolean>;

// Local cache of servers
let cachedServers: McpServer[] = [];
// Local cache of all available tools from connected servers
let cachedTools: McpTool[] = [];
// Tool approval callback - can be set by UI components
let toolApprovalCallback: ToolApprovalCallback | null = null;
// Auto-polling interval
let pollingInterval: number | null = null;
// Polling callbacks
const serverUpdateCallbacks: Array<() => void> = [];

class McpService {
  constructor() {
    // Start auto-polling when service is instantiated
    this.startAutoPolling();
  }

  // Start auto-polling for server status updates
  startAutoPolling(intervalMs: number = 5000) {
    // Clear any existing interval
    if (pollingInterval) {
      window.clearInterval(pollingInterval);
    }

    // Set up new polling interval
    pollingInterval = window.setInterval(() => {
      this.pollServers();
    }, intervalMs);

    console.log(`Auto-polling started with interval ${intervalMs}ms`);
  }

  // Stop auto-polling
  stopAutoPolling() {
    if (pollingInterval) {
      window.clearInterval(pollingInterval);
      pollingInterval = null;
      console.log('Auto-polling stopped');
    }
  }

  // Register a callback to be notified when servers update
  registerServerUpdateCallback(callback: () => void) {
    serverUpdateCallbacks.push(callback);
    return () => {
      const index = serverUpdateCallbacks.indexOf(callback);
      if (index !== -1) {
        serverUpdateCallbacks.splice(index, 1);
      }
    };
  }

  // Poll servers and notify callbacks if there are changes
  async pollServers() {
    try {
      const prevServerIds = new Set(cachedServers.filter(s => s.connected).map(s => s.id));
      const prevToolCount = cachedTools.length;
      
      await this.getServers();
      
      const currentServerIds = new Set(cachedServers.filter(s => s.connected).map(s => s.id));
      const currentToolCount = cachedTools.length;
      
      // Check if connected servers or tool count changed
      const serversChanged = 
        prevServerIds.size !== currentServerIds.size || 
        ![...prevServerIds].every(id => currentServerIds.has(id));
      
      const toolsChanged = prevToolCount !== currentToolCount;
      
      // If there are changes, notify callbacks
      if (serversChanged || toolsChanged) {
        console.log('Server or tool changes detected in polling, notifying components');
        serverUpdateCallbacks.forEach(callback => callback());
      }
    } catch (error) {
      console.error('Error during auto-polling:', error);
    }
  }

  // Get list of available servers
  async getServers(): Promise<McpServer[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/servers`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('Server data from API:', data);
      
      // Update cached servers with normalized IDs
      cachedServers = data.map((server: any) => {
        const normalizedId = normalizeServerId(server.id);
        
        // Log connection status for debugging
        console.log(`Server ${server.id}: normalized=${normalizedId}, connected=${server.connected}`);
        
        // Handle tools whether they're complete objects or just names
        const tools = server.tools ? server.tools.map((tool: any) => {
          if (typeof tool === 'string') {
            return {
              name: tool,
              serverId: server.id,
              description: `Provided by ${server.name}`
            };
          } else {
            return {
              ...tool,
              serverId: server.id
            };
          }
        }) : [];
        
        return {
          ...server,
          id: server.id, // Keep original ID
          normalizedId, // Add normalized ID for matching
          tools
        };
      });
      
      // Update the global tools cache
      this.getAllTools();
      
      return cachedServers;
    } catch (error) {
      console.error('Error fetching servers:', error);
      if (cachedServers.length) {
        return cachedServers;
      } else {
        return [];
      }
    }
  }

  // Get connected servers only
  getConnectedServers(): McpServer[] {
    return cachedServers.filter(server => server.connected);
  }

  // Get all available tools from all connected servers
  getAllTools(): McpTool[] {
    // Rebuild the tools cache from all connected servers
    cachedTools = [];
    
    // Log server connection status for debugging
    console.log('Getting all tools from connected servers:', 
      cachedServers.map(s => ({id: s.id, connected: s.connected, toolCount: s.tools?.length || 0}))
    );
    
    cachedServers.forEach(server => {
      if (server.connected && server.tools && server.tools.length > 0) {
        console.log(`Adding ${server.tools.length} tools from server ${server.id}`);
        
        // Add each tool to the cache with the server ID
        server.tools.forEach(tool => {
          // Ensure we don't add duplicate tools
          if (!cachedTools.some(t => t.name === tool.name)) {
            cachedTools.push({
              ...tool,
              serverId: server.id
            });
          }
        });
      }
    });
    
    console.log(`Total tools available: ${cachedTools.length}`);
    return cachedTools;
  }
  
  // Get tools for a specific server
  getToolsForServer(serverId: string): McpTool[] {
    const normalizedId = normalizeServerId(serverId);
    
    const server = cachedServers.find(s => 
      normalizeServerId(s.id) === normalizedId
    );
    
    if (server && server.connected && server.tools) {
      return server.tools;
    }
    
    return [];
  }

  // Connect to a server
  async connectToServer(serverPathOrId: string): Promise<boolean> {
    try {
      // Determine if this is a path or an ID based on presence of slashes or file extensions
      const isPath = serverPathOrId.includes('/') || 
                    serverPathOrId.includes('\\') || 
                    serverPathOrId.endsWith('.js') || 
                    serverPathOrId.endsWith('.py');
      
      const isBrowserTools = 
        serverPathOrId.includes('browser-tools-mcp') || 
        normalizeServerId(serverPathOrId).includes('browser-tools');
        
      if (isBrowserTools) {
        console.log('🔧 Attempting to connect to browser-tools-mcp');
      }
      
      const requestBody = isPath 
        ? { serverPath: serverPathOrId }  // It's a path
        : { serverId: serverPathOrId };   // It's an ID
      
      console.log(`Connecting to server with ${isPath ? 'path' : 'ID'}: ${serverPathOrId}`);
      
      const response = await fetch(`${API_BASE_URL}/servers/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Server connection response:', data);
      
      // Update local cache - use normalized IDs for consistency
      const serverId = data.server?.id || data.serverId || serverPathOrId;
      const normalizedId = normalizeServerId(serverId);
      
      console.log(`Connected to server: original=${serverId}, normalized=${normalizedId}`);
      
      // Find server by normalized ID
      const serverIndex = cachedServers.findIndex(s => 
        normalizeServerId(s.id) === normalizedId
      );
      
      if (serverIndex >= 0) {
        // Mark as connected
        cachedServers[serverIndex].connected = true;
        
        // Update tools if they were provided in the response
        if (data.server?.tools) {
          cachedServers[serverIndex].tools = data.server.tools.map((tool: any) => {
            if (typeof tool === 'string') {
              return {
                name: tool,
                serverId,
                description: `Provided by ${cachedServers[serverIndex].name}`
              };
            } else {
              return {
                ...tool,
                serverId
              };
            }
          });
          
          console.log(`Updated tools for ${serverId}:`, cachedServers[serverIndex].tools);
        }
        
        // Update the global tools cache
        this.getAllTools();
        console.log('Updated tools cache after connection:', cachedTools);
        
        // Force an immediate poll to ensure other components are notified
        await this.pollServers();
      } else {
        // If we can't find the server in the cache, refresh the full list
        console.log('Server not found in cache, refreshing server list');
        await this.getServers();
        
        // Force an immediate poll to ensure other components are notified
        await this.pollServers();
      }
      
      return true;
    } catch (error) {
      console.error('Error connecting to server:', error);
      return false;
    }
  }

  // Disconnect from a server
  async disconnectFromServer(serverId: string): Promise<boolean> {
    try {
      const normalizedId = normalizeServerId(serverId);
      
      const response = await fetch(`${API_BASE_URL}/servers/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serverId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      // Update local cache using normalized IDs for consistency
      const serverIdFromResponse = data.server?.id || data.serverId || serverId;
      const normalizedResponseId = normalizeServerId(serverIdFromResponse);
      
      const serverIndex = cachedServers.findIndex(s => 
        normalizeServerId(s.id) === normalizedResponseId
      );
      
      if (serverIndex >= 0) {
        cachedServers[serverIndex].connected = false;
        
        // Update the global tools cache after disconnection
        this.getAllTools();
      } else {
        // If we can't find the server in the cache, refresh the full list
        await this.getServers();
      }
      
      return true;
    } catch (error) {
      console.error('Error disconnecting from server:', error);
      return false;
    }
  }

  // Send a message to Claude and properly process the response with tool calls
  async sendMessage(message: string): Promise<ChatMessage> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if response is already in structured format with tool calls
      if (data.toolCalls && Array.isArray(data.toolCalls)) {
        // Response is already structured by the backend
        return {
          id: data.id || Date.now().toString(),
          role: 'assistant',
          content: data.content || '',
          timestamp: new Date(data.timestamp || Date.now()),
          toolCalls: data.toolCalls
        };
      } else {
        // No structured tool calls, return simple message
        return {
          id: data.id || Date.now().toString(),
          role: 'assistant',
          content: data.content || '',
          timestamp: new Date(data.timestamp || Date.now())
        };
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Set a tool approval callback
  setToolApprovalCallback(callback: ToolApprovalCallback): void {
    toolApprovalCallback = callback;
    
    // Post to the backend API to register the UI has a custom approval flow
    fetch(`${API_BASE_URL}/set-approval-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hasUiCallback: true }),
    }).catch(err => {
      console.error('Failed to notify backend of approval callback:', err);
    });
  }
  
  // Clear the tool approval callback
  clearToolApprovalCallback(): void {
    toolApprovalCallback = null;
    
    // Notify backend
    fetch(`${API_BASE_URL}/set-approval-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hasUiCallback: false }),
    }).catch(err => {
      console.error('Failed to notify backend of approval callback removal:', err);
    });
  }
  
  // Handle tool approval request (called by backend API)
  async approveToolExecution(toolName: string, args: any): Promise<boolean> {
    if (toolApprovalCallback) {
      return toolApprovalCallback(toolName, args);
    }
    // Default behavior if no callback is set: auto-approve
    return true;
  }
}

export default new McpService(); 