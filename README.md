# MCP Client with UI

A modern web-based interface for the Model Context Protocol (MCP) Client that allows you to interact with Claude AI through MCP servers, extending its capabilities with various tools.

## Overview

This project consists of two main components:

1. **Backend (mcp-client-typescript)**: A TypeScript implementation of the MCP Client that communicates with the Anthropic API and MCP servers. It exposes a REST API for the frontend to consume.

2. **Frontend (mcp-client-ui)**: A React UI built with Vite, TypeScript, and Material UI that provides a modern interface for interacting with Claude through the MCP Client.

![MCP Client UI Screenshot](./screenshot.png)

## Features

- Clean, modern UI built with React, TypeScript, and Material UI
- Interactive chat interface to communicate with Claude AI
- Server configuration management for connecting to MCP servers
- Dashboard for monitoring connected servers and activity
- Seamless integration between the frontend and backend

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm (v7 or later)
- An Anthropic API key for Claude

### Installation

1. Run the setup script to install dependencies for both the backend and frontend:

```bash
chmod +x setup.sh
./setup.sh
```

2. Update the Anthropic API key in `mcp-client-typescript/.env`:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PORT=3001
```

### Running the Application

#### Start the Backend API Server

```bash
cd mcp-client-typescript
npm run dev:server
```

The backend will start running on http://localhost:3001.

#### Start the Frontend Development Server

In a new terminal:

```bash
cd mcp-client-ui
npm run dev
```

The frontend will start running on http://localhost:5173.

## Usage

1. Open your browser and navigate to http://localhost:5173
2. Go to the Server Config page to connect to MCP servers
3. Enter the path to the MCP server script (e.g., `/path/to/server.js` or `/path/to/server.py`)
4. Once connected to at least one server, go to the Chat page to start a conversation with Claude
5. Claude will use the connected servers to enhance its capabilities

## Project Structure

- `/mcp-client-typescript` - Backend MCP Client implementation
  - `index.ts` - Core MCP Client implementation
  - `server.ts` - Express API server

- `/mcp-client-ui` - Frontend React application
  - `/src/components` - UI components
  - `/src/layouts` - Layout components
  - `/src/pages` - Page components
  - `/src/utils` - Utility functions and services

## License

This project is licensed under the ISC License.

## Acknowledgements

- [Model Context Protocol (MCP)](https://github.com/anthropics/anthropic-cookbook/tree/main/model_context_protocol) - For the protocol specification
- [Anthropic](https://www.anthropic.com/) - For Claude AI
- [Material UI](https://mui.com/) - For the UI components
- [Vite](https://vitejs.dev/) - For the frontend build system