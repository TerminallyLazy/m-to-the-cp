import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  CircularProgress,
  List,
  ListItem,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
  Alert
} from '@mui/material';
import { Link } from 'react-router-dom';
import mcpService, { McpServer } from '../utils/mcpService';

const DashboardPage: React.FC = () => {
  const [connectedServers, setConnectedServers] = useState<McpServer[]>([]);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  
  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      setLoading(true);
      const serverList = await mcpService.getServers();
      setServers(serverList);
      setConnectedServers(serverList.filter(server => server.connected));
      setError(null);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
      setError('Failed to fetch server list. Please check that the backend is running.');
    } finally {
      setLoading(false);
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
      
      // Refresh server list
      console.log(`Refreshing server list after toggling ${server.id}`);
      await fetchServers();
      console.log('Server list refreshed');
    } catch (err) {
      console.error(`Error toggling server ${server.id} connection:`, err);
      setError('An error occurred when toggling server connection');
    } finally {
      setToggleLoading(null);
    }
  };

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Dashboard</Typography>
      
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
        
        {/* Connected Servers */}
        <Grid container spacing={3}>
          {/* Connected Servers */}
          <Grid item xs={12} md={6}>
            <Card elevation={0} sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Connected Servers</Typography>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress />
                  </Box>
                ) : connectedServers.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {connectedServers.map((server) => (
                      <Box
                        key={server.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          p: 1.5,
                          borderRadius: 1,
                          backgroundColor: 'background.default',
                        }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: '#10B981',
                            mr: 1.5,
                          }}
                        />
                        <Box>
                          <Typography variant="body2">{server.name}</Typography>
                          {server.description && (
                            <Typography variant="caption" color="text.secondary">
                              {server.description}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No servers connected. Connect to an MCP server to enhance Claude's capabilities.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Recent Activity */}
          <Grid item xs={12} md={6}>
            <Card elevation={0} sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Recent Activity</Typography>
                <Typography variant="body2" color="text.secondary">
                  No recent activity to display. Start a conversation to see your activity here.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button 
                    variant="outlined"
                    component={Link}
                    to="/chat"
                  >
                    Start Chat
                  </Button>
                  {/* <Button 
                    variant="outlined"
                    component={Link}
                    to="/server-config"
                  >
                    Server Config
                  </Button> */}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Available Servers */}
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

export default DashboardPage; 