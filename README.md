# MCP Client with UI

A modern web-based interface for the Model Context Protocol (MCP) Client that allows you to interact with Claude AI through MCP servers, extending its capabilities with various tools.

## Overview

This project consists of two main components:

1. **Backend (mcp-client-typescript)**: A TypeScript implementation of the MCP Client that communicates with the Anthropic API and MCP servers. It exposes a REST API for the frontend to consume.

2. **Frontend (mcp-client-ui)**: A React UI built with Vite, TypeScript, and Material UI that provides a modern interface for interacting with Claude through the MCP Client.

## Screenshots

### 1. Application Overview

Here is an overview of the application interface:

![Screenshot 2025-03-16 at 18-00-36 Vite React TS](https://github.com/user-attachments/assets/e9083418-9128-416a-ac6c-4c3959433168)

---

![Screenshot 2025-03-16 at 18-01-20 Vite React TS](https://github.com/user-attachments/assets/9297ebc6-1b7a-42de-bfb9-f61e71abc630)

--- 

![Screenshot 2025-03-16 at 18-01-42 Vite React TS](https://github.com/user-attachments/assets/4bf95f39-11d8-4c79-ba88-5933acf7c8d3)

---

![Screenshot 2025-03-16 at 18-02-44 Vite React TS](https://github.com/user-attachments/assets/593f0896-3491-4352-aa47-cd78f3165b2f)

---

### 3. Additional Visuals

![image1](https://github.com/user-attachments/assets/471b0880-1f76-49a8-8564-9b5e7b2884d4)

---

![image3](https://github.com/user-attachments/assets/fafc6e7c-52b7-4502-ad52-36015c39e48d)

---

![image4](https://github.com/user-attachments/assets/9bbcf3fd-e023-46f8-b843-37c5bd1efe18)

---

![image5](https://github.com/user-attachments/assets/b1d3b4ad-03d3-4c11-acec-a24ec75eba4f)

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
