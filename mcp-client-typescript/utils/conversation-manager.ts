import { LLMWithTools, LLMProvider } from './llm-with-tools.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { validateAndCallTool } from './validateAndCallTool.js';
import readline from 'readline';

/**
 * Process an LLM response for tool calls and execute them
 * @param mcpClient The MCP client instance
 * @param llmProvider The LLM provider instance
 * @param llmResponse The response from the LLM
 * @param messages The current message history
 * @param requireApproval Whether to require user approval for tool calls
 * @returns The processed response and updated message history
 */
export async function processLLMResponse(
  mcpClient: Client,
  llmProvider: LLMProvider,
  llmResponse: any,
  messages: any[],
  requireApproval: boolean = true
) {
  // Extract tool calls using the provider-specific method
  const toolCalls = llmProvider.extractToolCalls(llmResponse);
  
  // If no tool calls, return the response as is
  if (!toolCalls || toolCalls.length === 0) {
    return { llmResponse, messages };
  }
  
  // Handle each tool call
  const toolResults = [];
  
  for (const toolCall of toolCalls) {
    const { name, arguments: args } = toolCall;
    let id = toolCall.id || `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    console.log(`LLM wants to call tool: ${name}`);
    console.log('Tool arguments:', JSON.stringify(args, null, 2));
    
    let userApproved = !requireApproval; // Skip approval if not required
    
    if (requireApproval) {
      // Get user approval
      userApproved = await getUserApproval(name, args);
    }
    
    if (userApproved) {
      try {
        // Call the tool with validation
        const toolResult = await validateAndCallTool(mcpClient, name, args);
        
        // Add the tool call to messages
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [{ id, name, arguments: JSON.stringify(args) }]
        });
        
        // Add the tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: id,
          content: toolResult.isError 
            ? `Error: ${toolResult.content && Array.isArray(toolResult.content) && toolResult.content.length > 0 ? toolResult.content[0].text : 'Unknown error'}`
            : (toolResult.content && Array.isArray(toolResult.content) && toolResult.content.length > 0 ? toolResult.content[0].text : JSON.stringify(toolResult))
        });
        
        // Add to tool results
        toolResults.push({
          name,
          status: 'success',
          result: toolResult
        });
        
      } catch (error: any) {
        console.error(`Error calling tool ${name}:`, error);
        
        // Add error to messages
        messages.push({
          role: 'tool',
          tool_call_id: id,
          content: `Error executing tool ${name}: ${error.message}`
        });
        
        // Add to tool results
        toolResults.push({
          name,
          status: 'error',
          error: error.message
        });
      }
    } else {
      // User didn't approve
      console.log(`Tool call to ${name} was not approved`);
      
      messages.push({
        role: 'system',
        content: `Tool call to ${name} was not approved by the user.`
      });
    }
  }
  
  // If we had tool calls and now have tool results, send the updated conversation back to the LLM
  if (toolResults.length > 0) {
    // Format tools for the specific LLM provider
    const availableTools = await mcpClient.listTools();
    const formattedTools = llmProvider.formatTools(availableTools.tools);
    
    // Send updated conversation to LLM
    console.log('Sending updated conversation with tool results back to LLM...');
    const newResponse = await llmProvider.sendMessage(messages, { tools: formattedTools });
    
    // Return the new response with tool results
    return { 
      llmResponse: newResponse, 
      messages,
      toolResults
    };
  }
  
  // Return the original response with any tool results
  return { 
    llmResponse, 
    messages,
    toolResults
  };
}

/**
 * Manage a conversation with an LLM including tool calls
 * @param mcpClient The MCP client
 * @param llmProvider The LLM provider
 * @param initialMessages Initial conversation messages
 * @param options Additional options for the conversation
 * @returns The complete conversation context
 */
export async function manageConversationContext(
  mcpClient: Client,
  llmProvider: LLMProvider,
  initialMessages: any[] = [],
  options: any = {}
) {
  // Initialize conversation history with any provided messages
  let messages = [...initialMessages];
  
  // If no initial messages and we have a user query in options, add it
  if (messages.length === 0 && options.userQuery) {
    // Add system message if none exists
    if (!messages.some(m => m.role === 'system')) {
      messages.push({
        role: 'system',
        content: options.systemMessage || 'You are a helpful assistant with access to tools made available by the Model Context Protocol (MCP) servers. Use tools when appropriate to answer the user\'s questions.'
      });
    }
    
    // Add user query
    messages.push({
      role: 'user',
      content: options.userQuery
    });
  }
  
  // Get available tools from MCP
  const toolsResult = await mcpClient.listTools();
  const formattedTools = llmProvider.formatTools(toolsResult.tools);
  
  // Add tools to options
  const llmOptions = { 
    ...options,
    tools: formattedTools
  };
  
  // Send initial request to LLM
  console.log(`Sending request to ${llmProvider.name}...`);
  let llmResponse = await llmProvider.sendMessage(messages, llmOptions);
  
  // Process response and handle any tool calls
  const result = await processLLMResponse(
    mcpClient, 
    llmProvider, 
    llmResponse, 
    messages,
    options.requireApproval !== false
  );
  
  // Return the complete context
  return result;
}

/**
 * Get user approval for a tool call
 * @param toolName The name of the tool to call
 * @param args The arguments for the tool call
 * @returns Promise resolving to true if approved, false otherwise
 */
export async function getUserApproval(toolName: string, args: any): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    console.log(`Approve tool call to ${toolName}?`);
    console.log('Arguments:', JSON.stringify(args, null, 2));
    console.log('Type "y" to approve, anything else to deny:');
    
    rl.question('', (answer) => {
      rl.close();
      const approved = answer.trim().toLowerCase() === 'y';
      console.log(approved ? 'Tool call approved' : 'Tool call denied');
      resolve(approved);
    });
  });
} 