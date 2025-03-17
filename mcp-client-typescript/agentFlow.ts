import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Anthropic } from "@anthropic-ai/sdk";
import { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";

/**
 * Interface for a tool call from the LLM
 */
interface ToolCall {
  name: string;
  input: { [key: string]: any };
}

/**
 * Interface for the LLM response
 */
interface LLMResponse {
  content: string;
  tool_calls?: ToolCall[];
}

/**
 * Interface for an LLM client
 */
interface LLMClient {
  sendMessage(messages: MessageParam[], options?: any): Promise<LLMResponse>;
}

/**
 * Prepare MCP tools for use with an LLM
 * @param mcpClient The MCP client to get tools from
 */
export async function prepareToolsForLLM(mcpClient: Client): Promise<Tool[]> {
  try {
    const toolsResult = await mcpClient.listTools();
    return toolsResult.tools.map((tool) => {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      };
    });
  } catch (error) {
    console.error('Error preparing tools for LLM:', error);
    return [];
  }
}

/**
 * Process an LLM response, execute any tool calls, and update the message history
 * @param mcpClient The MCP client to use for tool calls
 * @param llmClient The LLM client to use for follow-up interactions
 * @param response The LLM response to process
 * @param messages The current message history
 */
export async function processLLMResponse(
  mcpClient: Client, 
  llmClient: LLMClient, 
  response: LLMResponse, 
  messages: MessageParam[]
): Promise<{ messages: MessageParam[] }> {
  // Add assistant response to messages
  messages.push({
    role: 'assistant',
    content: response.content,
  });
  
  // Process tool calls if any
  if (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      try {
        console.log(`Executing tool: ${toolCall.name} with args:`, toolCall.input);
        
        // Call the tool via MCP
        const result = await mcpClient.callTool({
          name: toolCall.name,
          arguments: toolCall.input,
        });
        
        // Add tool response to messages
        messages.push({
          role: 'user',
          content: `Tool ${toolCall.name} returned: ${JSON.stringify(result.content)}`,
        });
      } catch (error) {
        console.error(`Error executing tool ${toolCall.name}:`, error);
        
        // Add error information to messages
        messages.push({
          role: 'user',
          content: `Error executing tool ${toolCall.name}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  }
  
  return { messages };
}

/**
 * Create an Anthropic-based LLM client
 * @param apiKey Anthropic API key
 */
export function createAnthropicLLMClient(apiKey: string | undefined): LLMClient {
  if (!apiKey) {
    throw new Error("Anthropic API key is required");
  }
  
  const anthropic = new Anthropic({ apiKey });
  
  return {
    async sendMessage(messages: MessageParam[], options?: any): Promise<LLMResponse> {
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-latest",
        max_tokens: 1000,
        temperature: options?.temperature || 0.7,
        messages,
        tools: options?.tools,
        system: options?.systemPrompt,
      });
      
      // Convert Anthropic response to our standard format
      let content = '';
      let tool_calls: ToolCall[] = [];
      
      for (const c of response.content) {
        if (c.type === "text") {
          content += c.text;
        } else if (c.type === "tool_use") {
          tool_calls.push({
            name: c.name,
            input: c.input as { [key: string]: any },
          });
        }
      }
      
      return { content, tool_calls };
    }
  };
}

/**
 * Perform a complex task by having the LLM chain together multiple tool calls
 * @param mcpClient The MCP client to use for tool calls
 * @param llmClient The LLM client to use for reasoning
 * @param task The task description
 */
export async function performComplexTask(
  mcpClient: Client,
  llmClient: LLMClient,
  task: string,
  options: {
    maxIterations?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}
): Promise<{
  completed: boolean;
  finalMessages: MessageParam[];
  iterations: number;
}> {
  // Default options
  const maxIterations = options.maxIterations || 10;
  const temperature = options.temperature || 0.7;
  const systemPrompt = options.systemPrompt || '';
  
  // Prepare tools
  const tools = await prepareToolsForLLM(mcpClient);
  
  // Start conversation with task description
  let messages: MessageParam[] = [{
    role: 'user',
    content: `Perform this task: ${task}. You have access to tools to help you.`,
  }];
  
  // Run iterations
  let iterations = 0;
  
  while (iterations < maxIterations) {
    iterations++;
    console.log(`Iteration ${iterations}/${maxIterations}`);
    
    // Get LLM response
    const response = await llmClient.sendMessage(messages, { 
      tools, 
      temperature,
      systemPrompt 
    });
    
    // Check if LLM wants to use tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Process tool calls and update messages
      const result = await processLLMResponse(mcpClient, llmClient, response, messages);
      messages = result.messages;
    } else {
      // LLM has completed the task
      messages.push({
        role: 'assistant',
        content: response.content,
      });
      
      console.log('Task completed successfully');
      break;
    }
  }
  
  if (iterations >= maxIterations) {
    console.log('Reached maximum iterations - task may not be complete');
    messages.push({
      role: 'user',
      content: 'Reached maximum number of iterations. Please provide a final response or summary.',
    });
    
    // Get final summary from LLM
    const finalResponse = await llmClient.sendMessage(messages, { 
      temperature,
      systemPrompt 
    });
    messages.push({
      role: 'assistant',
      content: finalResponse.content,
    });
  }
  
  return {
    completed: iterations < maxIterations,
    finalMessages: messages,
    iterations,
  };
}

/**
 * Example of using the Multi-Server approach with Multi-Step Flows
 */
export async function exampleMultiServerAgentFlow(task: string, apiKey: string) {
  // Import required modules
  const { MCPConnectionManager } = await import('./connectionManager.js');
  
  // Create connection manager
  const connectionManager = new MCPConnectionManager();
  
  try {
    // Connect to multiple servers
    await connectionManager.connectToServerWithPath('file-server', 'mcp-file-server');
    await connectionManager.connectToServerWithPath('weather-server', 'mcp-weather-server');
    
    // Get the client for a specific server
    const fileClient = connectionManager.getClient('file-server');
    if (!fileClient) {
      throw new Error('Failed to connect to file server');
    }
    
    // Create LLM client
    const llmClient = createAnthropicLLMClient(apiKey);
    
    // Execute the complex task
    const result = await performComplexTask(fileClient, llmClient, task, {
      systemPrompt: 'You are a helpful assistant with access to available Model Context Protocol (MCP) Servers with various tools. You will use the tools to accomplish tasks.',
      maxIterations: 15,
      temperature: 0.5,
    });
    
    console.log(`Task completed in ${result.iterations} iterations.`);
    return result;
  } finally {
    // Clean up
    await connectionManager.disconnectAll();
  }
} 