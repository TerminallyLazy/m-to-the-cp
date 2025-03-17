import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { createZodSchema } from '../utils/schema.js';

/**
 * Example showing how to discover and use an MCP tool with Zod schema validation
 */
async function discoverAndUseTool() {
  console.log('Connecting to a calculator tool server...');
  
  // Create and initialize the MCP client
  const client = new Client(
    { name: 'mcp-tool-discovery-example', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
  
  // Connect to a server that provides the calculate tool
  // Using the calculator server for this example
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/mcp-server-calculator']
  });
  
  // Connect to the server
  client.connect(transport);
  
  try {
    // Discover available tools
    const toolsResult = await client.listTools();
    console.log('Available tools:', toolsResult.tools.map(t => t.name));
    
    // Find the calculator tool
    const calculatorTool = toolsResult.tools.find(tool => tool.name === 'calculate');
    
    if (calculatorTool) {
      console.log('Found calculator tool:', calculatorTool.name);
      console.log('Description:', calculatorTool.description);
      console.log('Input schema:', JSON.stringify(calculatorTool.inputSchema, null, 2));
      
      // Create a zod schema from the tool's input schema
      // Need to cast the input schema as any to avoid TypeScript errors with JSON Schema conversion
      const inputSchema = createZodSchema(calculatorTool.inputSchema as any);
      
      // Validate input against the schema
      try {
        const input = { a: 5, b: 3, operation: 'add' };
        console.log('Validating input:', input);
        
        const validatedInput = inputSchema.parse(input);
        console.log('Input is valid:', validatedInput);
        
        // Call the tool with validated input
        console.log('Calling calculator tool...');
        const result = await client.callTool({
          name: 'calculate',
          arguments: validatedInput
        });
        
        // Access the result content safely with type checking
        if (result.content && Array.isArray(result.content) && result.content.length > 0) {
          const content = result.content[0];
          if (typeof content === 'object' && content && 'text' in content) {
            console.log('Calculation result:', content.text);
          }
        }
      } catch (error) {
        console.error('Invalid input:', error);
      }
      
      // Try with an invalid input to demonstrate validation
      try {
        const invalidInput = { a: 5, b: 'not a number', operation: 'add' };
        console.log('Validating invalid input:', invalidInput);
        
        const validatedInput = inputSchema.parse(invalidInput);
        console.log('This should not be reached');
      } catch (error) {
        console.error('Validation error (expected):', error instanceof Error ? error.message : String(error));
      }
    } else {
      console.log('Calculator tool not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect from the server
    console.log('Disconnecting from server...');
    // Close the transport by stopping the child process
    // Note: StdioClientTransport doesn't have a disconnect method directly
    // The client should handle termination when it goes out of scope
    // but we can ensure cleanup by explicitly terminating the process
    try {
      // Attempt to close any open connections
      transport.close?.();
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }
}

// Only run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  discoverAndUseTool().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 