// This service integrates with the MCP Client backend API

// API base URL
const API_BASE_URL = `${window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin}/api`;

// Utility function to normalize server IDs
const normalizeServerId = (id: string): string => {
  return id.replace(/^(mcp-)?server-/, '').toLowerCase();
};

// Message interface for the chat
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

// Tool interface
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

class McpService {
  // Get list of available servers
  async getServers(): Promise<McpServer[]> {
    try {
      console.log('Fetching server list from backend');
      const response = await fetch(`${API_BASE_URL}/servers`);
      
      const responseText = await response.text();
      console.log(`Get servers response status: ${response.status}, response text: ${responseText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}, Response: ${responseText}`);
      }
      
      // Parse the response text back to JSON
      const data = responseText ? JSON.parse(responseText) : [];
      console.log('Parsed servers data:', data);
      
      // Update cached servers with more detailed logging
      const oldServers = [...cachedServers];
      
      // Process server data with normalized IDs
      cachedServers = data.map((server: any) => {
        const normalizedId = normalizeServerId(server.id);
        console.log(`Processing server ${server.id} (normalized: ${normalizedId}), connected: ${server.connected}`);
        
        // Handle tools whether they're complete objects or just names
        const tools = server.tools ? server.tools.map((tool: any) => {
          if (typeof tool === 'string') {
            // If it's just a tool name (old format)
            return {
              name: tool,
              serverId: server.id,
              description: `Provided by ${server.name}`
            };
          } else {
            // If it's a complete tool object (new format)
            return {
              ...tool,
              serverId: server.id
            };
          }
        }) : [];
        
        return {
          ...server,
          normalizedId, // Keep the normalized ID for reference
          timestamp: new Date(server.timestamp || Date.now()),
          tools
        };
      });
      
      // Log any changes in connected status
      oldServers.forEach(oldServer => {
        // Find matching server using normalized ID to handle prefix differences
        const oldNormalizedId = normalizeServerId(oldServer.id);
        const newServer = cachedServers.find(s => normalizeServerId(s.id) === oldNormalizedId);
        
        if (newServer && oldServer.connected !== newServer.connected) {
          console.log(`Server ${oldServer.id} (normalized: ${oldNormalizedId}) status changed from ${oldServer.connected ? 'connected' : 'disconnected'} to ${newServer.connected ? 'connected' : 'disconnected'}`);
        }
      });
      
      // Log any new servers
      cachedServers.forEach(newServer => {
        const newNormalizedId = normalizeServerId(newServer.id);
        const oldServerExists = oldServers.some(s => normalizeServerId(s.id) === newNormalizedId);
        
        if (!oldServerExists) {
          console.log(`New server discovered: ${newServer.id} (normalized: ${newNormalizedId}), connected: ${newServer.connected}`);
        }
      });
      
      console.log('Updated cached servers list:', cachedServers);
      return cachedServers;
    } catch (error) {
      console.error('Error fetching servers:', error);
      if (cachedServers.length) {
        console.log('Using cached servers:', cachedServers);
        return cachedServers;
      } else {
        console.log('No cached servers available');
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
    cachedServers.forEach(server => {
      if (server.connected && server.tools && server.tools.length > 0) {
        // Add each tool to the cache with the server ID
        server.tools.forEach(tool => {
          cachedTools.push({
            ...tool,
            serverId: server.id
          });
        });
      }
    });
    
    return cachedTools;
  }
  
  // Get tools for a specific server
  getToolsForServer(serverId: string): McpTool[] {
    const normalizedId = normalizeServerId(serverId);
    
    // First try exact match
    let server = cachedServers.find(s => s.id === serverId);
    
    // If not found, try with normalized ID
    if (!server) {
      server = cachedServers.find(s => normalizeServerId(s.id) === normalizedId);
    }
    
    if (server && server.connected && server.tools) {
      return server.tools;
    }
    
    return [];
  }

  // Connect to a server
  async connectToServer(serverPathOrId: string): Promise<boolean> {
    try {
      console.log(`Connecting to server with path or ID: ${serverPathOrId}`);
      
      // Determine if this is a path or an ID based on presence of slashes or file extensions
      const isPath = serverPathOrId.includes('/') || 
                     serverPathOrId.includes('\\') || 
                     serverPathOrId.endsWith('.js') || 
                     serverPathOrId.endsWith('.py');
      
      const requestBody = isPath 
        ? { serverPath: serverPathOrId }  // It's a path
        : { serverId: serverPathOrId };   // It's an ID
      
      console.log('Request body for connect:', requestBody);
      
      const response = await fetch(`${API_BASE_URL}/servers/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log(`Connect response status: ${response.status}, response text: ${responseText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}, Response: ${responseText}`);
      }

      // Parse the response text back to JSON
      const data = responseText ? JSON.parse(responseText) : {};
      console.log('Parsed connect response data:', data);
      
      // Update local cache
      const serverId = data.server?.id || data.serverId || serverPathOrId;
      const normalizedId = normalizeServerId(serverId);
      console.log(`Server ID for cache update: ${serverId}, normalized: ${normalizedId}`);
      
      // First try exact match
      let serverIndex = cachedServers.findIndex(s => s.id === serverId);
      
      // If not found, try with normalized ID
      if (serverIndex < 0) {
        serverIndex = cachedServers.findIndex(s => normalizeServerId(s.id) === normalizedId);
        console.log(`Using normalized ID to find server, index: ${serverIndex}`);
      }
      
      if (serverIndex >= 0) {
        cachedServers[serverIndex].connected = true;
        
        // Update tools if they were provided in the response
        if (data.server?.tools) {
          console.log(`Updating tools for server "${serverId}": ${JSON.stringify(data.server.tools)}`);
          cachedServers[serverIndex].tools = data.server.tools.map((tool: any) => {
            if (typeof tool === 'string') {
              // If it's just a tool name (old format)
              return {
                name: tool,
                serverId,
                description: `Provided by ${cachedServers[serverIndex].name}`
              };
            } else {
              // If it's a complete tool object (new format)
              return {
                ...tool,
                serverId
              };
            }
          });
        }
        
        console.log(`Updated server "${cachedServers[serverIndex].id}" status in cache to connected`);
        
        // Update the global tools cache
        this.getAllTools();
      } else {
        console.log(`Server "${serverId}" not found in cache, fetching updated list`);
        // If we can't find the server in the cache, refresh the full list
        await this.getServers();
        
        // Update the global tools cache
        this.getAllTools();
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
      console.log(`Disconnecting from server: ${serverId}, normalized: ${normalizedId}`);
      
      const response = await fetch(`${API_BASE_URL}/servers/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serverId }),
      });

      const responseText = await response.text();
      console.log(`Disconnect response status: ${response.status}, response text: ${responseText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}, Response: ${responseText}`);
      }

      // Parse the response text back to JSON
      const data = responseText ? JSON.parse(responseText) : {};
      console.log('Parsed disconnect response data:', data);
      
      // Update local cache
      const serverIdFromResponse = data.server?.id || data.serverId || serverId;
      const normalizedResponseId = normalizeServerId(serverIdFromResponse);
      console.log(`Server ID for cache update on disconnect: ${serverIdFromResponse}, normalized: ${normalizedResponseId}`);
      
      // First try exact match
      let serverIndex = cachedServers.findIndex(s => s.id === serverIdFromResponse);
      
      // If not found, try with normalized ID
      if (serverIndex < 0) {
        serverIndex = cachedServers.findIndex(s => normalizeServerId(s.id) === normalizedResponseId);
        console.log(`Using normalized ID to find server, index: ${serverIndex}`);
      }
      
      if (serverIndex >= 0) {
        cachedServers[serverIndex].connected = false;
        console.log(`Updated server "${cachedServers[serverIndex].id}" status in cache to disconnected`);
        
        // Update the global tools cache after disconnection
        this.getAllTools();
      } else {
        console.log(`Server "${serverIdFromResponse}" not found in cache on disconnect, fetching updated list`);
        // If we can't find the server in the cache, refresh the full list
        await this.getServers();
        
        // Update the global tools cache
        this.getAllTools();
      }
      
      return true;
    } catch (error) {
      console.error('Error disconnecting from server:', error);
      return false;
    }
  }

  // Send a message to Claude
  async sendMessage(message: string): Promise<ChatMessage> {
    try {
      console.log('Sending message to Claude:', message);
      
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
      
      const responseText = await response.text();
      console.log(`Chat response status: ${response.status}, response text: ${responseText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}, Response: ${responseText}`);
      }
      
      // Parse the response text back to JSON
      const data = responseText ? JSON.parse(responseText) : {};
      console.log('Parsed chat response data:', data);
      
      // Check if response contains any tool calls
      const toolCalls = this.extractToolCalls(data.content);
      
      // Create a chat message with optional tool calls
      const chatMessage: ChatMessage = {
        id: data.id || Date.now().toString(),
        role: 'assistant',
        content: this.sanitizeContentForToolCalls(data.content),
        timestamp: new Date(data.timestamp || Date.now()),
        ...(toolCalls.length > 0 && { toolCalls })
      };
      
      return chatMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Helper method to extract tool calls from message content
  private extractToolCalls(content: string): Array<{name: string; args: any; status: string; result?: any}> {
    const toolCalls: Array<{name: string; args: any; status: string; result?: any}> = [];
    
    // Pattern 1: Standard "Tool call: X" format - improved to handle multi-line JSON
    const standardToolCallRegex = /Tool call: (\w+)\s*Arguments: ({[\s\S]*?})\s*Result: ({[\s\S]*?})(?=\n\nTool call:|$)/gs;
    
    // Pattern 2: Bracket format [Calling tool X with args Y]
    const bracketToolCallRegex = /\[Calling tool (\w+) with args ({[^}]+}|\{\})\]/g;
    
    // Pattern 3: Narrative format "I'll use the X tool"
    const narrativeToolCallRegex = /I'll use the (\w+) tool/g;
    
    // Pattern 4: Standalone code blocks
    const standaloneCodeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;

    // Helper function to safely parse JSON with error handling
    const safeJsonParse = (jsonString: string, fallback: any = {}, context: string = ''): any => {
      try {
        // Clean up the JSON string before parsing
        let cleanJson = jsonString.trim();
        
        // Try direct parsing first
        return JSON.parse(cleanJson);
      } catch (firstError) {
        console.warn(`Initial JSON parse failed for ${context}:`, firstError);
        
        try {
          // Try to fix common JSON issues
          let cleanJson = jsonString.trim();
          
          // 1. Handle trailing commas
          cleanJson = cleanJson.replace(/,\s*([\]}])/g, '$1');
          
          // 2. Fix unquoted property names
          cleanJson = cleanJson.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
          
          // 3. Fix single quotes being used instead of double quotes
          cleanJson = cleanJson.replace(/'([^']+)'/g, '"$1"');
          
          // 4. Remove any non-JSON text that might appear before or after
          const jsonStartIndex = cleanJson.indexOf('{');
          const jsonEndIndex = cleanJson.lastIndexOf('}');
          
          if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            cleanJson = cleanJson.substring(jsonStartIndex, jsonEndIndex + 1);
          }
          
          // Try parsing again with cleaned JSON
          return JSON.parse(cleanJson);
        } catch (secondError) {
          console.error(`Failed to parse JSON for ${context} even after cleanup:`, secondError, 'Text:', jsonString);
          return fallback;
        }
      }
    };
    
    // Process standard tool call format
    let match: RegExpExecArray | null;
    while ((match = standardToolCallRegex.exec(content)) !== null) {
      try {
        const name = match[1];
        const argsText = match[2];
        const resultText = match[3];
        
        // Parse args with improved error handling
        const args = safeJsonParse(argsText, {}, `${name} arguments`);
        
        // Parse result with improved error handling
        const result = safeJsonParse(resultText, { 
          success: true, 
          data: "Parsing failed, showing raw result", 
          raw: resultText 
        }, `${name} result`);
        
        // Determine status based on the result
        let status = 'success';
        if (result && result.success === false) {
          status = 'error';
        }
        
        toolCalls.push({
          name,
          args,
          status,
          result
        });
      } catch (err) {
        console.error('Error parsing tool call:', err, 'in match:', match);
      }
    }
    
    // Process bracket format [Calling tool X with args Y]
    while ((match = bracketToolCallRegex.exec(content)) !== null) {
      try {
        const name = match[1];
        let argsText = match[2];
        
        // Parse args with improved error handling
        const args = safeJsonParse(argsText, {}, `bracket ${name} arguments`);
        
        toolCalls.push({
          name,
          args,
          status: 'success',
          result: { success: true, data: "Tool execution successful" }
        });
      } catch (err) {
        console.error('Error parsing bracket tool call:', err, 'in match:', match);
      }
    }
    
    // Process narrative format "I'll use the X tool" 
    while ((match = narrativeToolCallRegex.exec(content)) !== null) {
      try {
        const name = match[1];
        
        toolCalls.push({
          name,
          args: {},
          status: 'success',
          result: { success: true, data: "Tool execution successful" }
        });
      } catch (err) {
        console.error('Error parsing narrative tool call:', err, 'in match:', match);
      }
    }
    
    // Process standalone code blocks not already part of a tool call
    // We need to check that the code block isn't already part of a processed tool call
    const existingToolCallRanges: {start: number; end: number}[] = [];
    
    // Collect ranges of already processed tool calls
    standardToolCallRegex.lastIndex = 0; // Reset the regex
    let toolCallMatch: RegExpExecArray | null;
    while ((toolCallMatch = standardToolCallRegex.exec(content)) !== null) {
      existingToolCallRanges.push({
        start: toolCallMatch.index,
        end: toolCallMatch.index + toolCallMatch[0].length
      });
    }
    
    // Now process standalone code blocks
    standaloneCodeBlockRegex.lastIndex = 0; // Reset the regex
    let codeBlockMatch: RegExpExecArray | null;
    while ((codeBlockMatch = standaloneCodeBlockRegex.exec(content)) !== null) {
      // Skip if this code block is part of an already processed tool call
      const isPartOfToolCall = existingToolCallRanges.some(
        range => codeBlockMatch!.index >= range.start && codeBlockMatch!.index < range.end
      );
      
      if (!isPartOfToolCall) {
        try {
          const language = codeBlockMatch[1] || 'text';
          const codeContent = codeBlockMatch[2].trim();
          
          toolCalls.push({
            name: 'code_block',
            args: { language },
            status: 'success',
            result: { 
              success: true, 
              data: "Code block rendered",
              codeBlock: {
                language,
                content: codeContent
              }
            }
          });
        } catch (err) {
          console.error('Error parsing standalone code block:', err, 'in match:', codeBlockMatch);
        }
      }
    }
    
    return toolCalls;
  }

  // Helper method to clean content of tool call text
  private sanitizeContentForToolCalls(content: string): string {
    // Remove all tool call blocks from the content
    let sanitized = content
      // Standard tool call format - improved to handle multi-line JSON
      .replace(/Tool call: \w+\s*Arguments: ({[\s\S]*?})\s*Result: ({[\s\S]*?})(?=\n\nTool call:|$)/gs, '')
      // Bracket format
      .replace(/\[Calling tool \w+ with args (?:{[^}]+}|\{\})\]\s*\n*/g, '')
      // Narrative format
      .replace(/I'll use the \w+ tool\.\s*\n+/g, '')
      // Tool call placeholders
      .replace(/\[Code block \d+\]\s*\n*/g, '')
      // For standalone code blocks, replace with a placeholder text that our UI will recognize
      .replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, '[Code block rendered]');
    
    // Clean up extraneous newlines
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
    
    // Finally, trim any excess whitespace from the content
    return sanitized.trim();
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