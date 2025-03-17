import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { GeminiProvider, AnthropicProvider } from '../utils/llm-providers.js';
import { processLLMResponse, manageConversationContext } from '../utils/conversation-manager.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Example showing how to use the conversation manager with an LLM provider
 * and MCP tools
 */
async function conversationManagerExample() {
  try {
    // Choose your LLM provider based on environment variable
    const useGemini = process.env.USE_GEMINI === 'true';
    
    // Initialize MCP client
    const mcpClient = new Client(
      { name: 'ConversationManager', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
    
    // Connect to calculator tool server
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/mcp-server-calculator']
    });
    
    mcpClient.connect(transport);
    
    // Discover available tools
    const toolsResult = await mcpClient.listTools();
    console.log(`Connected to MCP server, found ${toolsResult.tools.length} tools`);
    
    // Select LLM provider
    let llmProvider;
    
    if (useGemini) {
      console.log('--- USING GEMINI LLM PROVIDER ---');
      
      // Check for API key
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
      }
      
      // Create Gemini provider
      llmProvider = new GeminiProvider(process.env.GEMINI_API_KEY);
    } else {
      console.log('--- USING CLAUDE LLM PROVIDER ---');
      
      // Check for API key
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
      }
      
      // Create Claude provider
      llmProvider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
    }
    
    // Initialize conversation with system message
    const initialMessages = [
      { 
        role: 'system', 
        content: 'You are a helpful assistant with access to tools. When asked to calculate something, use the calculate tool.' 
      }
    ];
    
    // Example 1: Direct user query
    console.log('\nExample 1: Direct user query with approval');
    const userQuery = 'Can you calculate 42 * 17?';
    console.log(`User: ${userQuery}`);
    
    // Manage conversation with direct user query
    const result1 = await manageConversationContext(
      mcpClient, 
      llmProvider, 
      initialMessages, 
      { 
        userQuery,
        requireApproval: true,
        temperature: 0.7
      }
    );
    
    // Display results
    console.log('\nAssistant:');
    if (typeof result1.llmResponse.content === 'string') {
      console.log(result1.llmResponse.content);
    } else if (Array.isArray(result1.llmResponse.content)) {
      // Handle different response formats (Claude vs Gemini)
      result1.llmResponse.content
        .filter((content: any) => content.type === 'text')
        .forEach((content: any) => console.log(content.text));
    }
    
    // Example 2: Multi-turn conversation without approval
    console.log('\nExample 2: Multi-turn conversation without approval');
    
    // Add the first exchange to the conversation history
    const conversationHistory = [...result1.messages];
    
    // Add a follow-up question
    conversationHistory.push({
      role: 'user',
      content: 'Now calculate 42 * 17 + 123'
    });
    
    // Continue the conversation
    const result2 = await manageConversationContext(
      mcpClient, 
      llmProvider, 
      conversationHistory, 
      { 
        requireApproval: false,
        temperature: 0.7
      }
    );
    
    // Display results
    console.log('\nAssistant:');
    if (typeof result2.llmResponse.content === 'string') {
      console.log(result2.llmResponse.content);
    } else if (Array.isArray(result2.llmResponse.content)) {
      // Handle different response formats (Claude vs Gemini)
      result2.llmResponse.content
        .filter((content: any) => content.type === 'text')
        .forEach((content: any) => console.log(content.text));
    }
    
    // Example 3: Processing a specific LLM response with tool calls
    console.log('\nExample 3: Processing a specific LLM response');
    
    // For this example, we'll manually create an LLM response with a tool call
    const manualMessages = [
      { 
        role: 'system', 
        content: 'You are a helpful assistant with access to tools. When asked to calculate something, use the calculate tool.' 
      },
      {
        role: 'user',
        content: 'What is 25 * 4?'
      }
    ];
    
    // Send to LLM
    const formattedTools = llmProvider.formatTools(toolsResult.tools);
    const manualResponse = await llmProvider.sendMessage(manualMessages, { tools: formattedTools });
    
    console.log('User: What is 25 * 4?');
    
    // Process the response
    const result3 = await processLLMResponse(
      mcpClient,
      llmProvider,
      manualResponse,
      manualMessages,
      true // require approval
    );
    
    // Display final result
    console.log('\nFinal Assistant Response:');
    if (typeof result3.llmResponse.content === 'string') {
      console.log(result3.llmResponse.content);
    } else if (Array.isArray(result3.llmResponse.content)) {
      // Handle different response formats (Claude vs Gemini)
      result3.llmResponse.content
        .filter((content: any) => content.type === 'text')
        .forEach((content: any) => console.log(content.text));
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

// Only run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  conversationManagerExample().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 