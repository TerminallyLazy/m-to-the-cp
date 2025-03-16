import express from 'express';
import cors from 'cors';
import { MCPClient } from './index.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Get current file path using ESM approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize MCP Client
const mcpClient = new MCPClient();

// Load server config
const configPath = path.resolve(__dirname, '..', 'mcp_config.json');
let mcpConfig: { mcpServers: Record<string, any> } = { mcpServers: {} };

try {
  const configFile = fs.readFileSync(configPath, 'utf8');
  mcpConfig = JSON.parse(configFile);
} catch (error) {
  console.error('Failed to load MCP config:', error);
}

// API Routes
app.get('/api/servers', (req: express.Request, res: express.Response) => {
  // Get the list of all connected servers
  const connectedServerIds = mcpClient.getAllConnectedServers();
  console.log('Currently connected servers:', connectedServerIds);
  
  // Get all available tools
  const allTools = mcpClient.getTools();
  console.log('Available tools:', allTools.map(t => t.name));
  
  // Generate server list from mcpConfig
  const serverList = Object.entries(mcpConfig.mcpServers).map(([id, config]) => {
    // Check if server is explicitly disabled
    const isEnabled = config.enabled !== false;
    
    // Generate a more descriptive name by capitalizing and adding spaces
    const formattedName = id
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Generate description based on configuration
    let description = '';
    
    // Try to derive description from package name or server config
    if (config.args && config.args.length > 0) {
      // Look for an NPM package name in the args
      const packageArg = config.args.find((arg: any) => 
        typeof arg === 'string' && (arg.startsWith('@') || !arg.startsWith('-'))
      );
      
      if (packageArg) {
        // Extract descriptive text from package name
        const packageName = packageArg.split('/').pop() || '';
        if (packageName.startsWith('mcp-server-') || packageName.startsWith('server-')) {
          // Format from mcp-server-xxx or server-xxx to "xxx service"
          const serviceName = packageName
            .replace(/^(mcp-)?server-/, '')
            .split('-')
            .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
          description = `${serviceName} service`;
        } else {
          description = `${packageName} service`;
        }
      } else if (config.command === 'node' && typeof config.args[0] === 'string') {
        // For Node.js scripts, use the script path
        const scriptPath = config.args[0];
        const scriptName = path.basename(scriptPath, path.extname(scriptPath));
        description = `${scriptName.charAt(0).toUpperCase() + scriptName.slice(1)} service`;
      }
    }
    
    // If we couldn't derive a meaningful description, use a generic one
    if (!description) {
      description = `${formattedName} service`;
    }
    
    // IMPROVED SERVER CONNECTION CHECK
    // First, normalize both the config ID and all connected server IDs to handle prefixes consistently
    const normalizedConfigId = id.toLowerCase().replace(/^(mcp-)?server-/, '');
    
    // Check direct connection first
    const directlyConnected = mcpClient.isConnected(id);
    
    // Then check using normalized IDs
    const isInConnectedList = connectedServerIds.some(connectedId => {
      // Normalize the connected ID to match our normalization format
      const normalizedConnectedId = connectedId.toLowerCase().replace(/^(mcp-)?server-/, '');
      return normalizedConnectedId === normalizedConfigId || 
             connectedId.toLowerCase() === id.toLowerCase();
    });
    
    const isConnected = directlyConnected || isInConnectedList;
    
    console.log(`Server ${id}: normalizedId=${normalizedConfigId}, directlyConnected=${directlyConnected}, isInConnectedList=${isInConnectedList}, final isConnected=${isConnected}`);
    console.log(`Connected IDs comparison:`, connectedServerIds.map(id => ({ 
      original: id, 
      normalized: id.toLowerCase().replace(/^(mcp-)?server-/, '') 
    })));
    
    // Get tools specific to this server
    const serverSpecificTools = isConnected ? mcpClient.getToolsForServer(id).map(tool => ({
      name: tool.name,
      description: tool.description || `Tool provided by ${formattedName}`,
      inputSchema: tool.input_schema
    })) : [];
    
    return {
      id,
      name: formattedName,
      description,
      enabled: isEnabled,
      connected: isConnected && isEnabled,
      tools: serverSpecificTools
    };
  }).filter(server => server.enabled);

  res.json(serverList);
});

app.post('/api/servers/connect', async (req: express.Request, res: express.Response) => {
  try {
    const { serverId, serverPath } = req.body;
    
    if (!serverId && !serverPath) {
      return res.status(400).json({ error: 'Either Server ID or Server Path is required' });
    }
    
    let actualServerId = serverId;
    let actualServerPath = serverPath;
    
    // If serverId is provided but no serverPath, look up in the config
    if (serverId && !serverPath) {
      // Check if server exists in config
      if (!mcpConfig.mcpServers[serverId]) {
        return res.status(404).json({ error: `Server "${serverId}" not found in configuration` });
      }
      
      // Get server configuration
      const serverConfig = mcpConfig.mcpServers[serverId];
      
      // Check if server is enabled
      if (serverConfig.enabled === false) {
        return res.status(400).json({ error: `Server "${serverId}" is disabled in configuration` });
      }
      
      // Generate server path based on configuration
      if (serverConfig.command === 'npx') {
        // For npx commands, the server path is the package name
        const packageIndex = serverConfig.args.findIndex((arg: any) => arg.startsWith('@') || !arg.startsWith('-'));
        if (packageIndex !== -1) {
          actualServerPath = serverConfig.args[packageIndex];
          
          // Check if there are additional arguments that need to be passed
          if (serverConfig.args.length > packageIndex + 1) {
            // Pass all arguments after the package name
            const additionalArgs = serverConfig.args.slice(packageIndex + 1);
            
            // Connect with all the required arguments
            await mcpClient.connectToServerWithArgs(actualServerPath, additionalArgs);
            
            // Skip the standard connection code below
            const formattedName = actualServerId
              .split('-')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
              
            // Generate a server description based on server ID
            const serverDescription = `${formattedName} service`;
              
            return res.json({ 
              success: true, 
              serverId: actualServerId,
              server: {
                id: actualServerId,
                name: formattedName,
                description: serverDescription,
                connected: true,
                tools: mcpClient.getTools()
              }
            });
          }
        } else {
          return res.status(500).json({ error: 'Could not determine server package from configuration' });
        }
      } else if (serverConfig.command === 'node') {
        // For node commands, the server path is the file path
        if (serverConfig.args.length > 0) {
          actualServerPath = serverConfig.args[0];
          
          // Check if there are additional arguments that need to be passed
          if (serverConfig.args.length > 1) {
            // Pass all arguments after the script path
            const additionalArgs = serverConfig.args.slice(1);
            
            // Connect with all the required arguments
            await mcpClient.connectToServerWithArgs(actualServerPath, additionalArgs);
            
            // Skip the standard connection code below
            const formattedName = actualServerId
              .split('-')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
              
            // Generate a server description based on server ID
            const serverDescription = `${formattedName} service`;
              
            return res.json({ 
              success: true, 
              serverId: actualServerId,
              server: {
                id: actualServerId,
                name: formattedName,
                description: serverDescription,
                connected: true,
                tools: mcpClient.getTools()
              }
            });
          }
        } else {
          return res.status(500).json({ error: 'Could not determine server path from configuration' });
        }
      } else {
        return res.status(400).json({ error: `Unsupported server command: ${serverConfig.command}` });
      }
      
      // Set environment variables if provided
      if (serverConfig.env) {
        Object.entries(serverConfig.env).forEach(([key, value]) => {
          process.env[key] = value as string;
        });
      }
    } else if (serverPath && !serverId) {
      // Extract serverId from serverPath if only serverPath is provided
      actualServerId = path.basename(serverPath).replace(/\.(js|py)$/, '');
    }
    
    // Format server name
    const formattedName = actualServerId
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Generate description based on configuration
    let description = '';
    
    // If we have a serverId, use the config for description
    if (actualServerId && mcpConfig.mcpServers[actualServerId]) {
      const serverConfig = mcpConfig.mcpServers[actualServerId];
      
      // Try to derive description from package name or server config
      if (serverConfig.args && serverConfig.args.length > 0) {
        // Look for an NPM package name in the args
        const packageArg = serverConfig.args.find((arg: any) => 
          typeof arg === 'string' && (arg.startsWith('@') || !arg.startsWith('-'))
        );
        
        if (packageArg) {
          // Extract descriptive text from package name
          const packageName = packageArg.split('/').pop() || '';
          if (packageName.startsWith('mcp-server-') || packageName.startsWith('server-')) {
            // Format from mcp-server-xxx or server-xxx to "xxx service"
            const serviceName = packageName
              .replace(/^(mcp-)?server-/, '')
              .split('-')
              .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' ');
            description = `${serviceName} service`;
          } else {
            description = `${packageName} service`;
          }
        } else if (serverConfig.command === 'node' && typeof serverConfig.args[0] === 'string') {
          // For Node.js scripts, use the script path
          const scriptPath = serverConfig.args[0];
          const scriptName = path.basename(scriptPath, path.extname(scriptPath));
          description = `${scriptName.charAt(0).toUpperCase() + scriptName.slice(1)} service`;
        }
      }
    }
    
    // If we couldn't derive a meaningful description, use a generic one
    if (!description) {
      description = `${formattedName} service`;
    }
    
    // Check if already connected
    if (mcpClient.isConnected(actualServerId)) {
      return res.json({ 
        success: true, 
        serverId: actualServerId,
        server: {
          id: actualServerId,
          name: formattedName,
          description,
          connected: true,
          message: "Already connected",
          tools: mcpClient.getTools()
        }
      });
    }
    
    // Connect to the server with enhanced features from MCPClient
    await mcpClient.connectToServer(actualServerPath);
    
    res.json({ 
      success: true, 
      serverId: actualServerId,
      server: {
        id: actualServerId,
        name: formattedName,
        description,
        connected: true,
        tools: mcpClient.getTools()
      }
    });
  } catch (error) {
    console.error('Failed to connect to server:', error);
    res.status(500).json({ 
      error: 'Failed to connect to server', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

app.post('/api/servers/disconnect', async (req: express.Request, res: express.Response) => {
  try {
    const { serverId } = req.body;
    
    if (!serverId) {
      return res.status(400).json({ error: 'Server ID is required' });
    }
    
    // Check if server exists in config
    if (!mcpConfig.mcpServers[serverId]) {
      return res.status(404).json({ error: `Server "${serverId}" not found in configuration` });
    }
    
    // Check if already disconnected
    if (!mcpClient.isConnected(serverId)) {
      return res.json({ 
        success: true, 
        serverId: serverId,
        server: {
          id: serverId,
          connected: false,
          message: "Already disconnected"
        }
      });
    }
    
    // Disconnect from the server
    await mcpClient.disconnectFromServer(serverId);
    
    res.json({ 
      success: true, 
      serverId: serverId,
      server: {
        id: serverId,
        connected: false
      }
    });
  } catch (error) {
    console.error('Failed to disconnect from server:', error);
    res.status(500).json({ 
      error: 'Failed to disconnect from server', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

app.post('/api/chat', async (req: express.Request, res: express.Response) => {
  try {
    const { message, temperature = 0.7, tools_enabled = true } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('Processing user message:', message);
    
    // Process the message through MCP Client using the structured method
    const response = await mcpClient.processQueryStructured(message, temperature, tools_enabled);
    
    console.log('Structured response from AI:', response);
    
    // Return the structured response
    res.json({
      id: response.id,
      role: response.role,
      content: response.content,
      timestamp: response.timestamp,
      toolCalls: response.toolCalls
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date()
    });
  }
});

// Add a new endpoint for setting the approval callback
app.post('/api/set-approval-callback', (req: express.Request, res: express.Response) => {
  try {
    const { hasUiCallback } = req.body;
    
    if (hasUiCallback === true) {
      // Set up the approval callback that will route approval requests to the UI
      mcpClient.setApprovalCallback(async (toolName, args) => {
        // Create a promise that resolves when the UI responds
        return new Promise<boolean>((resolve) => {
          // Store this approval request
          pendingApprovals.set(`${toolName}_${Date.now()}`, {
            toolName,
            args,
            resolve
          });
          
          // Auto-resolve after a timeout to prevent hanging (optional)
          setTimeout(() => {
            resolve(false); // Default to rejection if no response
          }, 30000); // 30 second timeout
        });
      });
      
      res.json({ success: true, message: 'Approval callback set' });
    } else {
      // Clear the approval callback
      mcpClient.setApprovalCallback(async (toolName, args) => {
        console.log(`Auto-approving tool execution: ${toolName} with args:`, args);
        return true;
      });
      
      res.json({ success: true, message: 'Approval callback cleared' });
    }
  } catch (error) {
    console.error('Error setting approval callback:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date()
    });
  }
});

// Add tracking for pending approvals
const pendingApprovals = new Map<string, {
  toolName: string;
  args: any;
  resolve: (value: boolean) => void;
}>();

// Endpoint to poll for pending approvals
app.get('/api/pending-approvals', (req: express.Request, res: express.Response) => {
  const approvals = Array.from(pendingApprovals.entries()).map(([id, data]) => ({
    id,
    toolName: data.toolName,
    args: data.args
  }));
  
  res.json(approvals);
});

// Endpoint to respond to an approval request
app.post('/api/approve-tool', (req: express.Request, res: express.Response) => {
  try {
    const { id, approved } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Approval ID is required' });
    }
    
    const approval = pendingApprovals.get(id);
    
    if (!approval) {
      return res.status(404).json({ error: 'Approval request not found' });
    }
    
    // Resolve the promise with the user's decision
    approval.resolve(approved === true);
    
    // Remove from the pending list
    pendingApprovals.delete(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving tool:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP Client API Server running on port ${PORT}`);
}); 