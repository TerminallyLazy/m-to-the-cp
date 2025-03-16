#!/bin/bash

echo "Setting up MCP Client with UI..."
echo "================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "Node.js is required but not installed. Please install Node.js and try again."
  exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "npm is required but not installed. Please install npm and try again."
  exit 1
fi

# Install backend dependencies
echo "Installing backend dependencies..."
cd mcp-client-typescript
npm install
echo "Done!"

# Build the backend
echo "Building backend..."
npm run build
echo "Done!"

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../mcp-client-ui
npm install
echo "Done!"

# Create .env file for backend if it doesn't exist
if [ ! -f "../mcp-client-typescript/.env" ]; then
  echo "Creating .env file for backend..."
  echo "ANTHROPIC_API_KEY=your_anthropic_api_key_here" > ../mcp-client-typescript/.env
  echo "PORT=3001" >> ../mcp-client-typescript/.env
  echo "Created .env file. Please update it with your Anthropic API key."
fi

echo "================================"
echo "Setup completed!"
echo ""
echo "To start the backend API server:"
echo "cd mcp-client-typescript && npm run dev:server"
echo ""
echo "To start the frontend development server:"
echo "cd mcp-client-ui && npm run dev"
echo ""
echo "Make sure to update the Anthropic API key in mcp-client-typescript/.env before starting the backend."
echo "================================" 