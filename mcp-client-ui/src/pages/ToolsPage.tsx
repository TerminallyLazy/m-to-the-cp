import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  Build as BuildIcon, 
  Refresh as RefreshIcon,
  Extension as ExtensionIcon 
} from '@mui/icons-material';
import mcpService, { McpTool, McpServer } from '../utils/mcpService';

const ToolsPage: React.FC = () => {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize fetchData to avoid recreating it on each render
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get servers first
      const serverList = await mcpService.getServers();
      setServers(serverList);
      
      // Then get all available tools
      const toolsList = mcpService.getAllTools();
      setTools(toolsList);
      
      console.log('Updated tools list:', toolsList);
    } catch (err) {
      console.error('Error fetching tools data:', err);
      setError('Failed to fetch tools. Please check that the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchData();
    
    // Register for server updates with mcpService
    const unregister = mcpService.registerServerUpdateCallback(() => {
      console.log('Server update detected in ToolsPage, refreshing data');
      fetchData();
    });
    
    // Clean up the subscription when component unmounts
    return () => {
      unregister();
    };
  }, [fetchData]);

  // Group tools by server
  const toolsByServer = servers.reduce<Record<string, McpTool[]>>((acc, server) => {
    if (server.connected && server.tools && server.tools.length > 0) {
      acc[server.id] = server.tools;
    }
    return acc;
  }, {});

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Tools</Typography>
        <Button 
          startIcon={<RefreshIcon />} 
          onClick={fetchData}
          disabled={loading}
          variant="outlined"
          size="small"
        >
          {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
          Refresh
        </Button>
      </Box>
      
      {error && (
        <Card sx={{ mb: 3, bgcolor: 'error.light' }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* All Tools List */}
          <Card elevation={0} sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                All Available Tools ({tools.length})
              </Typography>
              
              {tools.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No tools are currently available. Connect to an MCP server to see available tools.
                </Alert>
              ) : null}
              
              {tools.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No tools available. Connect to MCP servers to access tools.
                  </Typography>
                </Paper>
              ) : (
                <List>
                  {tools.map((tool, index) => (
                    <React.Fragment key={`${tool.serverId}-${tool.name}`}>
                      {index > 0 && <Divider component="li" />}
                      <ListItem>
                        <ListItemIcon>
                          <BuildIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary={tool.name} 
                          secondary={
                            <>
                              <Typography variant="body2" color="text.secondary">
                                {tool.description || 'No description available'}
                              </Typography>
                              {tool.inputSchema && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                                    Parameters:
                                  </Typography>
                                  <pre style={{ 
                                    fontSize: '12px', 
                                    backgroundColor: '#f5f5f5', 
                                    padding: '4px 8px', 
                                    borderRadius: '4px',
                                    overflowX: 'auto' 
                                  }}>
                                    {JSON.stringify(tool.inputSchema, null, 2)}
                                  </pre>
                                </Box>
                              )}
                            </>
                          } 
                        />
                        <Chip 
                          size="small" 
                          label={servers.find(s => s.id === tool.serverId)?.name || tool.serverId} 
                          color="primary" 
                          variant="outlined" 
                        />
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
          
          {/* Tools Grouped by Server */}
          <Typography variant="h6" sx={{ mb: 2 }}>Tools by Server</Typography>
          
          <Grid container spacing={3}>
            {Object.entries(toolsByServer).length === 0 ? (
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No connected servers with tools available.
                  </Typography>
                </Paper>
              </Grid>
            ) : (
              Object.entries(toolsByServer).map(([serverId, serverTools]) => {
                const server = servers.find(s => s.id === serverId);
                return (
                  <Grid item xs={12} md={6} lg={4} key={serverId}>
                    <Card elevation={0}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <ExtensionIcon sx={{ mr: 1, color: 'primary.main' }} />
                          <Typography variant="h6">{server?.name}</Typography>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: server?.connected ? 'success.main' : 'text.disabled',
                              ml: 1.5,
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            {server?.connected ? 'Connected' : 'Disconnected'}
                          </Typography>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {server?.description || `Tools provided by ${server?.name}`}
                        </Typography>
                        
                        <List dense disablePadding>
                          {serverTools.map((tool, idx) => (
                            <ListItem key={tool.name} disablePadding sx={{ py: 0.5 }}>
                              <ListItemText 
                                primary={tool.name} 
                                secondary={tool.description}
                                primaryTypographyProps={{ variant: 'body2' }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })
            )}
          </Grid>
        </>
      )}
    </Box>
  );
};

export default ToolsPage; 