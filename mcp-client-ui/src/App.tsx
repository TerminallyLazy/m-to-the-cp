import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './utils/theme';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import ToolsPage from './pages/ToolsPage';
import ResourcesPage from './pages/ResourcesPage';
import ServerConfigPage from './pages/ServerConfigPage';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <MainLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/server-config" element={<ServerConfigPage />} />
            <Route path="/server/:id" element={<ChatPage />} />
          </Routes>
        </MainLayout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
