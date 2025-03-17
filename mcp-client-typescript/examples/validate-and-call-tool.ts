import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { validateAndCallTool } from '../utils/validateAndCallTool.js';

/**
 * Example showing how to validate input data against a tool's schema
 * and call the tool if validation passes
 */
async function validateAndCallToolExample() {
  console.log('Connecting to a calculator tool server...');
  
  // Create and initialize the MCP client
  const client = new Client(
    { name: 'mcp-tool-validation-example', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
  
  // Connect to a server that provides the calculate tool
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/mcp-server-calculator']
  });
  
  // Connect to the server
  client.connect(transport);
  
  try {
    // Valid input example
    try {
      console.log('\nTrying with valid input...');
      const validInput = { a: 10, b: 5, operation: 'multiply' };
      console.log('Input:', validInput);
      
      // Validate and call the tool
      const result = await validateAndCallTool(client, 'calculate', validInput);
      
      // Handle the result
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const content = result.content[0];
        if (typeof content === 'object' && content && 'text' in content) {
          console.log('Calculation result:', content.text);
        }
      }
    } catch (error) {
      console.error('Error with valid input:', error);
    }
    
    // Invalid input example - wrong type
    try {
      console.log('\nTrying with invalid input type...');
      const invalidTypeInput = { a: 10, b: "five", operation: 'multiply' };
      console.log('Input:', invalidTypeInput);
      
      // Validate and call the tool - this should throw an error
      await validateAndCallTool(client, 'calculate', invalidTypeInput);
    } catch (error) {
      console.error('Error with invalid type (expected):', error instanceof Error ? error.message : String(error));
    }
    
    // Invalid input example - missing required field
    try {
      console.log('\nTrying with missing required field...');
      const invalidMissingInput = { a: 10, operation: 'multiply' };
      console.log('Input:', invalidMissingInput);
      
      // Validate and call the tool - this should throw an error
      await validateAndCallTool(client, 'calculate', invalidMissingInput);
    } catch (error) {
      console.error('Error with missing field (expected):', error instanceof Error ? error.message : String(error));
    }
    
    // Non-existent tool example
    try {
      console.log('\nTrying with non-existent tool...');
      const input = { a: 10, b: 5 };
      
      // Validate and call the tool - this should throw an error
      await validateAndCallTool(client, 'non_existent_tool', input);
    } catch (error) {
      console.error('Error with non-existent tool (expected):', error instanceof Error ? error.message : String(error));
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    // Disconnect from the server
    console.log('\nDisconnecting from server...');
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
  validateAndCallToolExample().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 