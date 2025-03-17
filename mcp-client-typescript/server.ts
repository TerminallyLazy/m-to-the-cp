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

// Helper function to save the config file
const saveConfig = () => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
    console.log('MCP config saved successfully');
    return true;
  } catch (error) {
    console.error('Failed to save MCP config:', error);
    return false;
  }
};

// Helper function to add a new server to config
const addServerToConfig = (serverId: string, serverConfig: any): boolean => {
  try {
    // Add the server to the config
    mcpConfig.mcpServers[serverId] = serverConfig;
    
    // Save the updated config
    return saveConfig();
  } catch (error) {
    console.error('Failed to add server to config:', error);
    return false;
  }
};

// Helper function to extract server ID from path or package name
const extractServerId = (serverPath: string): string => {
  if (serverPath.startsWith('@')) {
    // For npm packages, extract a sensible ID
    // Example: @agentdeskai/browser-tools-mcp@1.2.0 -> browser-tools
    const packageParts = serverPath.split('/');
    if (packageParts.length > 1) {
      let packageName = packageParts[1];
      
      // Remove version if present
      packageName = packageName.split('@')[0];
      
      // Remove common prefixes
      packageName = packageName.replace(/^(mcp-)?server-/, '');
      
      // If the package has "mcp" in the name, extract that part
      if (packageName.includes('mcp')) {
        return packageName.split('-mcp')[0];
      }
      
      return packageName;
    }
    return serverPath.replace('@', '').split('/')[0];
  } else if (serverPath.endsWith('.js') || serverPath.endsWith('.py')) {
    // For script files, use the filename without extension
    return path.basename(serverPath).replace(/\.(js|py)$/, '');
  } else {
    // For other cases, use the raw input
    return serverPath;
  }
};

// Helper function to generate config for npm package
const generateNpmPackageConfig = (packageName: string): any => {
  return {
    enabled: true,
    command: "npx",
    args: [
      "-y",
      packageName
    ]
  };
};

// GET /api/servers - Get all available servers
app.get('/api/servers', async (req, res) => {
  try {
    // Get all connected servers from the MCP client
    const connectedServerIds = mcpClient.getAllConnectedServers();
    console.log('Currently connected servers:', connectedServerIds);
    
    // Get all available tools
    const availableTools = mcpClient.getTools().map(tool => tool.name);
    console.log('Available tools:', availableTools);
    
    // Build the response with all servers from config
    const servers = Object.entries(mcpConfig.mcpServers).map(([id, config]) => {
      // Format the server name for display
      const formattedName = id
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Generate a description based on the server type
      let description = '';
      
      if (config.args && config.args.length > 0) {
        // Try to derive description from package name or server config
        const packageArg = config.args.find((arg: any) => 
          typeof arg === 'string' && (arg.startsWith('@') || !arg.startsWith('-'))
        );
        
        if (packageArg) {
          // Extract descriptive text from package name
          const packageName = typeof packageArg === 'string' ? packageArg.split('/').pop() || '' : '';
          if (packageName.startsWith('mcp-server-') || packageName.startsWith('server-')) {
            // Format from mcp-server-xxx or server-xxx to "xxx service"
            const serviceName = packageName
              .replace(/^(mcp-)?server-/, '')
              .split('-')
              .map(part => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' ');
            description = `${serviceName} service`;
          } else {
            description = `${packageName} service`;
          }
        }
      } else if (config.command === 'node' && typeof config.args[0] === 'string') {
        // For Node.js scripts, use the script path
        const scriptPath = config.args[0];
        const scriptName = path.basename(scriptPath, path.extname(scriptPath));
        description = `${scriptName.charAt(0).toUpperCase() + scriptName.slice(1)} service`;
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
        enabled: config.enabled !== false, // Default to true if not specified
        connected: isConnected && config.enabled !== false,
        tools: serverSpecificTools
      };
    });
    
    res.json(servers);
  } catch (error) {
    console.error('Error getting servers:', error);
    res.status(500).json({ error: 'Failed to get servers' });
  }
});

app.post('/api/servers/connect', async (req: express.Request, res: express.Response) => {
  try {
    const { serverId, serverPath } = req.body;
    
    console.log('Connect request received:', { serverId, serverPath });
    
    if (!serverId && !serverPath) {
      return res.status(400).json({ error: 'Either Server ID or Server Path is required' });
    }
    
    let actualServerId = serverId;
    let actualServerPath = serverPath;
    let isNewServer = false;
    
    // If it's browser-tools-mcp, apply special handling
    const isBrowserTools = 
      (serverPath && serverPath.includes('browser-tools-mcp')) ||
      (serverId && serverId.toLowerCase().includes('browser-tools'));
      
    if (isBrowserTools) {
      console.log('Detected browser-tools-mcp connection request');
    }
    
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
    } else if (serverPath) {
      // This is a new server specification, extract id from path
      if (!actualServerId) {
        actualServerId = extractServerId(serverPath);
      }
      
      // Handle new NPM package
      const isNpmPackage = serverPath.startsWith('@') || !serverPath.includes('/') && !serverPath.includes('\\');
      const isJs = serverPath.endsWith('.js');
      const isPy = serverPath.endsWith('.py');
      
      // Check if this is a new server not in the config
      isNewServer = !mcpConfig.mcpServers[actualServerId];
      
      // Add to config if it's new
      if (isNewServer) {
        let serverConfig: any;
        
        if (isNpmPackage) {
          // Generate config for npm package
          serverConfig = generateNpmPackageConfig(serverPath);
        } else if (isJs) {
          // Generate config for JS file
          serverConfig = {
            enabled: true,
            command: "node",
            args: [
              serverPath
            ]
          };
        } else if (isPy) {
          // Generate config for Python file
          const pythonCommand = process.platform === "win32" ? "python" : "python3";
          serverConfig = {
            enabled: true,
            command: pythonCommand,
            args: [
              serverPath
            ]
          };
        } else {
          return res.status(400).json({ error: "Server script must be a .js or .py file, or an npm package name" });
        }
        
        // Add to config
        addServerToConfig(actualServerId, serverConfig);
      }
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
        tools: mcpClient.getTools(),
        isNewServer // Send flag if this was a new server added to config
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

// Add endpoint to get conversation history
app.get('/api/conversation/history', (req: express.Request, res: express.Response) => {
  try {
    // Retrieve the conversation history from the MCPClient
    const history = mcpClient.getConversationHistory();
    
    // Return the conversation history
    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date()
    });
  }
});

// Add endpoint to reset conversation history
app.post('/api/conversation/reset', (req: express.Request, res: express.Response) => {
  try {
    // Reset the conversation history
    mcpClient.resetConversation();
    
    res.json({
      success: true,
      message: 'Conversation history has been reset'
    });
  } catch (error) {
    console.error('Error resetting conversation history:', error);
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