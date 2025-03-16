import React, { useState, useEffect } from 'react';
import { 
  Box, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Divider, 
  Typography,
  Collapse,
  IconButton,
  CircularProgress,
  Tooltip
} from '@mui/material';
import { 
  Dashboard as DashboardIcon, 
  Chat as ChatIcon, 
  Code as CodeIcon,
  Build as BuildIcon,
  LibraryBooks as ResourcesIcon, 
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import mcpService, { McpServer } from '../utils/mcpService';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const [serversOpen, setServersOpen] = useState(true);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get server list from the service
    const fetchServers = async () => {
      try {
        setLoading(true);
        const serverList = await mcpService.getServers();
        setServers(serverList);
      } catch (error) {
        console.error('Failed to fetch servers:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchServers();
    
    // Poll for server updates every 10 seconds
    const interval = setInterval(fetchServers, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Navigation items
  const navItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Chat', icon: <ChatIcon />, path: '/chat' },
    { text: 'Tools', icon: <BuildIcon />, path: '/tools' },
    { text: 'Resources', icon: <ResourcesIcon />, path: '/resources' },
    { text: 'Server Config', icon: <StorageIcon />, path: '/server-config' },
  ];

  const handleToggleServers = () => {
    setServersOpen(!serversOpen);
  };

  return (
    <Box
      sx={{
        width: 220,
        height: '100%',
        backgroundColor: '#1E1E2D',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Logo and title */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          p: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}
      >
        <Box 
          component="img" 
          src="/mcp-logo.svg" 
          alt="MCP Logo" 
          sx={{ width: 28, height: 28, mr: 1 }} 
        />
        <Typography variant="subtitle1" fontWeight="bold">
          MCP Client
        </Typography>
        <Tooltip title="Settings">
          <IconButton 
            size="small" 
            sx={{ ml: 'auto' }}
            aria-label="settings"
            component={Link}
            to="/server-config"
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Main navigation */}
      <List sx={{ py: 0 }}>
        {navItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
              sx={{ 
                py: 1,
                mx: 1,
                my: 0.5,
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.05)' }} />

      {/* Servers section */}
      <Box>
        <ListItemButton 
          onClick={handleToggleServers} 
          sx={{ py: 1, px: 2 }}
          component={Link}
          to="/server-config"
        >
          <ListItemText 
            primary={
              <Typography
                variant="body2"
                color="text.secondary"
                fontWeight={600}
                sx={{ letterSpacing: 0.5, textTransform: 'uppercase' }}
              >
                MCP Servers
              </Typography>
            } 
          />
          {serversOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </ListItemButton>

        <Collapse in={serversOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : servers.length > 0 ? (
              servers.map((server) => (
                <ListItem key={server.id} disablePadding>
                  <ListItemButton
                    component={Link}
                    to={`/server/${server.id}`}
                    selected={location.pathname === `/server/${server.id}`}
                    sx={{ 
                      py: 0.75,
                      px: 2,
                      pl: 3,
                      opacity: server.connected ? 1 : 0.6,
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        mr: 1.5,
                        bgcolor: server.connected ? '#10B981' : 'text.disabled',
                      }}
                    />
                    <ListItemText 
                      primary={
                        <Typography variant="body2">
                          {server.name}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No servers available
                </Typography>
              </Box>
            )}
          </List>
        </Collapse>
      </Box>

      {/* Version info at bottom */}
      <Box 
        sx={{ 
          mt: 'auto', 
          p: 2, 
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Model Context Protocol
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ pb: 1, textAlign: 'center' }}>
        v1.0.0
      </Typography>
    </Box>
  );
};

export default Sidebar; 