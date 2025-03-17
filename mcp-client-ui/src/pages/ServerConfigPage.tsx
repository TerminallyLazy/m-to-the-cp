import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  TextField, 
  Button, 
  Alert, 
  CircularProgress,
  List,
  ListItem,
  Divider,
  Switch,
  FormControlLabel,
  Chip
} from '@mui/material';
import mcpService, { McpServer } from '../utils/mcpService';

const ServerConfigPage: React.FC = () => {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverPath, setServerPath] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  // Memoize fetchServers to avoid recreating it on each render
  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await mcpService.getServers();
      console.log('Fetched server list:', data);
      setServers(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching servers:', err);
      setError('Failed to fetch server list. Please check that the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchServers();
    
    // Register for server updates with mcpService
    const unregister = mcpService.registerServerUpdateCallback(() => {
      console.log('Server update detected in ServerConfigPage, refreshing data');
      fetchServers();
    });
    
    // Clean up the subscription when component unmounts
    return () => {
      unregister();
    };
  }, [fetchServers]);

  const handleConnect = async () => {
    if (!serverPath.trim()) {
      setError('Please enter a valid server path');
      return;
    }

    try {
      setConnecting(true);
      setError(null);
      setSuccess(null);
      
      console.log(`Attempting to connect to server: ${serverPath}`);
      const result = await mcpService.connectToServer(serverPath);
      
      if (result) {
        setSuccess(`Successfully connected to server: ${serverPath}`);
        setServerPath('');
        // Server list will be updated by polling mechanism
      } else {
        setError('Failed to connect to server');
      }
    } catch (err) {
      console.error('Error connecting to server:', err);
      setError('An error occurred when connecting to the server');
    } finally {
      setConnecting(false);
    }
  };

  const handleToggleServer = async (server: McpServer) => {
    try {
      console.log(`Toggling server: ${server.id}, current status: ${server.connected ? 'connected' : 'disconnected'}`);
      
      setToggleLoading(server.id);
      setError(null);
      setSuccess(null);
      
      let result;
      if (server.connected) {
        // Disconnect
        console.log(`Attempting to disconnect from server: ${server.id}`);
        result = await mcpService.disconnectFromServer(server.id);
        console.log(`Disconnect result for ${server.id}:`, result);
        
        if (result) {
          setSuccess(`Successfully disconnected from server: ${server.name}`);
        } else {
          setError(`Failed to disconnect from server: ${server.name}`);
        }
      } else {
        // Connect
        console.log(`Attempting to connect to server: ${server.id}`);
        result = await mcpService.connectToServer(server.id);
        console.log(`Connect result for ${server.id}:`, result);
        
        if (result) {
          setSuccess(`Successfully connected to server: ${server.name}`);
        } else {
          setError(`Failed to connect to server: ${server.name}`);
        }
      }
      
      // Server list will be updated by polling mechanism
    } catch (err) {
      console.error('Error toggling server connection:', err);
      setError('An error occurred when toggling server connection');
    } finally {
      setToggleLoading(null);
    }
  };

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Server Configuration</Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Connect Server Card */}
        <Grid item xs={12}>
          <Card elevation={0}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Connect to MCP Server</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter the path to an MCP server script to connect Claude to additional capabilities.
              </Typography>
              
              <Box 
                component="form" 
                sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' }, 
                  gap: 2, 
                  alignItems: { xs: 'stretch', sm: 'flex-start' } 
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConnect();
                }}
              >
                <TextField
                  fullWidth
                  label="Server Script Path"
                  variant="outlined"
                  placeholder="/path/to/server.js or /path/to/server.py"
                  value={serverPath}
                  onChange={(e) => setServerPath(e.target.value)}
                  disabled={connecting}
                  helperText="Example: /home/user/mcp-servers/database.js"
                />
                <Button 
                  variant="contained" 
                  onClick={handleConnect} 
                  disabled={connecting || !serverPath.trim()}
                  sx={{ minWidth: '120px', height: { sm: '56px' } }}
                >
                  {connecting ? <CircularProgress size={24} /> : 'Connect'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Server List Card */}
        <Grid item xs={12}>
          <Card elevation={0}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Available Servers</Typography>
                <Button 
                  size="small" 
                  onClick={fetchServers} 
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                  Refresh
                </Button>
              </Box>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : servers.length > 0 ? (
                <List>
                  {servers.map((server, index) => (
                    <React.Fragment key={server.id}>
                      <ListItem sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: server.connected ? '#10B981' : 'text.disabled',
                                mr: 1.5,
                              }}
                            />
                            <Typography variant="body1" fontWeight="medium">
                              {server.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              ({server.connected ? 'Connected' : 'Disconnected'})
                            </Typography>
                          </Box>
                          
                          {server.description && (
                            <Typography variant="body2" color="text.secondary">
                              {server.description}
                            </Typography>
                          )}
                          
                          {server.connected && server.tools && server.tools.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Tools: 
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {server.tools.map(tool => (
                                  <Chip 
                                    key={tool.name}
                                    label={tool.name} 
                                    size="small" 
                                    variant="outlined" 
                                    sx={{ fontSize: '0.675rem' }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Box>
                        
                        <FormControlLabel
                          control={
                            <Switch 
                              checked={server.connected} 
                              disabled={toggleLoading === server.id}
                              onChange={() => handleToggleServer(server)}
                            />
                          }
                          label=""
                        />
                      </ListItem>
                      {index < servers.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  No servers available. Connect to an MCP server to enhance Claude's capabilities.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ServerConfigPage; 