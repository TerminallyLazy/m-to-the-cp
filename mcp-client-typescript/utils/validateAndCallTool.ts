import { z, ZodError } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createZodSchema } from './schema.js';
import type { JSONSchema7 } from 'json-schema';

/**
 * Validates input data against a tool's JSON Schema and calls the tool if validation passes
 * @param client The MCP client instance
 * @param toolName The name of the tool to call
 * @param inputData The input data to validate and pass to the tool
 * @returns The result of the tool call
 * @throws Error if the tool is not found or validation fails
 */
export async function validateAndCallTool(
  client: Client, 
  toolName: string, 
  inputData: Record<string, unknown>
) {
  // Get tool schema
  const tools = await client.listTools();
  const tool = tools.tools.find(t => t.name === toolName);
  
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }
  
  try {
    // Create schema and validate input
    const schema = createZodSchema(tool.inputSchema as JSONSchema7);
    const validatedInput = schema.parse(inputData);
    
    // Call the tool with validated input
    return await client.callTool({
      name: toolName,
      arguments: validatedInput
    });
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Validation error:', error.errors);
      throw new Error(`Invalid input for tool ${toolName}: ${error.message}`);
    }
    throw error;
  }
} 