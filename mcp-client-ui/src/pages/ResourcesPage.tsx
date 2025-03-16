import React from 'react';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';

const ResourcesPage: React.FC = () => {
  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Resources</Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card elevation={0}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>MCP Documentation</Typography>
              <Typography variant="body2" color="text.secondary">
                This page will provide resources, documentation, and guides for using the Model Context Protocol.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ResourcesPage; 