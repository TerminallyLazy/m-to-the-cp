# MCP Client with Zod Schema Validation

This project demonstrates how to use the Model Context Protocol (MCP) client with Zod schema validation for input validation when working with MCP tools.

## Features

- Connect to MCP servers and discover available tools
- Convert JSON Schema from tool definitions to Zod schemas
- Validate inputs against schemas before calling tools
- Handle validation errors gracefully
- Integrate with multiple LLM providers (Gemini, Claude)
- Use validated MCP tools with LLM function calls
- Manage conversation context with tool execution and user approval
- Process LLM responses with tool calls

## Installation

```bash
# Install dependencies
npm install

# Copy the example .env file and update with your API keys
cp .env.example .env
```

## Usage

### Schema Validation Utility

The `utils/schema.ts` file provides a utility to convert JSON Schema to Zod schemas:

```typescript
import { createZodSchema } from './utils/schema.js';
import type { JSONSchema7 } from 'json-schema';

// Convert a JSON Schema to a Zod schema
const schema = createZodSchema(toolSchema as JSONSchema7);

// Validate data against the schema
const validatedData = schema.parse(inputData);
```

### Conversation Management

The `utils/conversation-manager.ts` file provides utilities for managing conversations with LLMs that use tools:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { LLMProvider } from './utils/llm-with-tools.js';
import { processLLMResponse, manageConversationContext } from './utils/conversation-manager.js';
```

### Multi-Server Connections

The `connectionManager.ts` file provides a class for managing connections to multiple MCP servers:

```typescript
import { MCPConnectionManager } from './connectionManager.js';

// Create a connection manager
const connectionManager = new MCPConnectionManager();

// Connect to multiple servers
await connectionManager.connectToServerWithPath('file-server', 'mcp-file-operations');
await connectionManager.connectToServerWithPath('weather-server', 'mcp-weather-server');

// Get a specific client
const fileClient = connectionManager.getClient('file-server');

// Get tools from all servers
const allTools = await connectionManager.getAllTools();

// Disconnect when done
await connectionManager.disconnectAll();
```

### Multi-Step (Agentic) Flows

The `agentFlow.ts` file provides utilities for implementing complex multi-step workflows where an LLM chains together multiple tool calls:

```typescript
import { 
  performComplexTask, 
  createAnthropicLLMClient 
} from './agentFlow.js';

// Create an LLM client
const llmClient = createAnthropicLLMClient(process.env.ANTHROPIC_API_KEY);

// Execute a complex task
const result = await performComplexTask(mcpClient, llmClient, 
  "Read the weather.txt file and calculate the average temperature", 
  {
    systemPrompt: 'You are a helpful assistant that can process weather data.',
    maxIterations: 5,
    temperature: 0.3,
  }
);

console.log(`Task completed in ${result.iterations} iterations`);
```

Check out the `examples/multi-server-example.ts` file for a complete example of using both multi-server connections and multi-step agentic flows together.

### Validate and Call Tool Utility

The `utils/validateAndCallTool.ts` file provides a convenient utility that handles the entire validation and tool calling workflow in a single function:

```typescript
import { validateAndCallTool } from './utils/validateAndCallTool.js';

// Create and connect your MCP client
const client = new Client(...);

try {
  // Validate input against schema and call the tool in one step
  const result = await validateAndCallTool(client, 'tool_name', {
    // Your input data
    param1: 'value1',
    param2: 'value2'
  });
  
  // Handle the result
  console.log('Tool result:', result);
} catch (error) {
  // Handle validation errors or tool not found errors
  console.error('Error:', error);
}
```

### LLM Integration with MCP Tools

The `utils/llm-with-tools.ts` and `utils/llm-providers.ts` files provide integration with multiple LLM providers:

```typescript
import { LLMWithTools } from './utils/llm-with-tools.js';
import { GeminiProvider } from './utils/llm-providers.js';
import dotenv from 'dotenv';

dotenv.config();

// Create an LLM provider (Gemini in this example)
const geminiProvider = new GeminiProvider(process.env.GEMINI_API_KEY);

// Create the LLM with tools client
const llmWithTools = new LLMWithTools(geminiProvider);

// Connect to an MCP server
await llmWithTools.connect('npx', ['-y', '@modelcontextprotocol/mcp-server-calculator']);

// Send a message to the LLM with tool access
const messages = [
  { role: 'system', content: 'You are a helpful assistant with access to tools.' },
  { role: 'user', content: 'Can you calculate 42 * 17?' }
];

const response = await llmWithTools.chat(messages);

// The response will include both the LLM's response and any tool results
console.log(response.llmResponse);
console.log(response.toolResults);
```

### Domain-Specific Example: FHIR Chat Service

The `utils/fhir-chat-service.ts` file provides a specialized chat service for healthcare data:

```typescript
import { FhirChatService } from './utils/fhir-chat-service.js';

// Create the FHIR chat service
const fhirChat = new FhirChatService();

// Initialize with your FHIR MCP server
await fhirChat.initialize('./fhir-mcp-server.js');

// Send a user query
const response = await fhirChat.chat("Show me patient 123456");

// Handle the response
console.log(response.llmResponse);
console.log(response.toolResults);
```

### Examples

Run the examples to see Zod validation and LLM integration in action:

```bash
# Build the project
npm run build

# Run the tool discovery example
node build/examples/tool-discovery.js

# Run the validate-and-call-tool example
node build/examples/validate-and-call-tool.js

# Run the LLM integration example (requires API keys in .env)
node build/examples/llm-with-tools-example.js
```

#### Tool Discovery Example
This example:
1. Connects to a calculator tool server
2. Discovers available tools
3. Creates a Zod schema from the calculator tool's input schema
4. Validates input against the schema
5. Calls the tool with validated input
6. Demonstrates validation error handling with invalid input

#### Validate and Call Tool Example
This example:
1. Connects to a calculator tool server
2. Uses the `validateAndCallTool` utility to simplify validation and calling
3. Demonstrates successful validation and tool calling
4. Shows how validation errors are handled for different types of invalid input
5. Shows how "tool not found" errors are handled

#### LLM with Tools Example
This example:
1. Allows selecting between Gemini and Claude LLM providers
2. Connects to a calculator tool server
3. Sends a request to the LLM that requires using the calculate tool
4. Shows the LLM's response and any tool calls it made
5. Demonstrates a FHIR-specific chat service for healthcare data

## Implementation Details

### JSON Schema to Zod Conversion

The `createZodSchema` function converts JSON Schema objects to Zod schemas, supporting:

- Basic types (string, number, boolean, null)
- Objects with properties and required fields
- Arrays with item schemas
- String formats (email, URI)
- Number constraints (min/max)
- String constraints (minLength/maxLength, pattern)
- Union types (oneOf, anyOf)
- Intersection types (allOf)

### Tool Validation Workflow

1. Discover tools using `client.listTools()`
2. Find the desired tool
3. Convert its input schema to a Zod schema
4. Validate user input against the schema
5. If valid, call the tool with validated input
6. Handle any validation errors

### LLM Integration Workflow

1. Create an LLM provider (Gemini, Claude, etc.)
2. Create an `LLMWithTools` instance with the provider
3. Connect to an MCP server to discover tools
4. Format the tools for the specific LLM provider
5. Send messages to the LLM with tools
6. Extract and execute tool calls using `validateAndCallTool`
7. Return both the LLM response and tool results

## License

ISC 