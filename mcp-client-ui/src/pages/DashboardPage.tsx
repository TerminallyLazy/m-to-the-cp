import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  CircularProgress 
} from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import mcpService, { McpServer } from '../utils/mcpService';

const DashboardPage: React.FC = () => {
  const [connectedServers, setConnectedServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true);
        const serverList = await mcpService.getServers();
        setConnectedServers(serverList.filter(server => server.connected));
      } catch (error) {
        console.error('Failed to fetch servers:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchServers();
  }, []);

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Dashboard</Typography>
      
      <Grid container spacing={3}>
        {/* Welcome Card */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{ 
              p: 3, 
              borderRadius: 3, 
              background: 'linear-gradient(45deg, #3B82F6 30%, #6366F1 90%)',
              color: 'white'
            }}
          >
            <Typography variant="h5" sx={{ mb: 1 }}>Welcome to MCP Client</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Interact with Claude AI using the Model Context Protocol. 
              Connect to various MCP servers to extend Claude's capabilities.
            </Typography>
            <Button 
              variant="contained" 
              component={Link}
              to="/chat"
              endIcon={<ArrowForwardIcon />}
              sx={{ 
                mt: 1, 
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' }
              }}
            >
              Start a Conversation
            </Button>
          </Paper>
        </Grid>
        
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
              <Button 
                variant="outlined"
                component={Link}
                to="/chat"
                sx={{ mt: 2 }}
              >
                Start Chat
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage; 