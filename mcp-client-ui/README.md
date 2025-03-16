# MCP Client UI

A modern web interface for the Model Context Protocol (MCP) Client. This UI allows you to interact with Claude AI through MCP servers, extending its capabilities with various tools.

## Features

- Clean, modern UI built with React, TypeScript, and Material UI
- Chat interface to communicate with Claude AI
- Dashboard to view connected MCP servers
- Integration with MCP Client TypeScript implementation

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- NPM (v7 or later)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
cd mcp-client-ui
npm install
```

3. Start the development server:

```bash
npm run dev
```

## Project Structure

- `/src` - Source code
  - `/components` - Reusable UI components
  - `/layouts` - Layout components like Sidebar and ChatLayout
  - `/pages` - Page components
  - `/utils` - Utility functions and services
  - `/hooks` - Custom React hooks

## Integration with MCP Client

This UI integrates with the MCP Client TypeScript implementation found in the `mcp-client-typescript` directory. The integration is handled by the `mcpService.ts` utility.

## Building for Production

To build the application for production, run:

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## License

This project is licensed under the ISC License.
