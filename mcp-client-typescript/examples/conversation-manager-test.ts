import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { LLMProvider } from '../utils/llm-with-tools.js';
import { processLLMResponse, manageConversationContext } from '../utils/conversation-manager.js';

// Define tool type
interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

// Define response type
interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: any;
    id?: string;
  }>;
}

/**
 * Mock MCP Client for testing
 */
class MockMCPClient {
  tools: Tool[];
  
  constructor(tools: Tool[] = []) {
    this.tools = tools;
  }
  
  async listTools() {
    return { tools: this.tools };
  }
  
  async callTool({ name, arguments: args }: { name: string, arguments: any }) {
    console.log(`Mock MCP Client calling tool: ${name}`);
    console.log(`Arguments:`, JSON.stringify(args, null, 2));
    
    if (name === 'calculate') {
      // Implement calculator functionality for testing
      try {
        let result: number;
        
        switch (args.operation) {
          case 'add':
            result = args.a + args.b;
            break;
          case 'subtract':
            result = args.a - args.b;
            break;
          case 'multiply':
            result = args.a * args.b;
            break;
          case 'divide':
            if (args.b === 0) throw new Error('Division by zero');
            result = args.a / args.b;
            break;
          default:
            throw new Error(`Unknown operation: ${args.operation}`);
        }
        
        return {
          isError: false,
          content: [{ text: String(result) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ text: error.message }]
        };
      }
    }
    
    // Default fallback for unknown tools
    return {
      isError: false,
      content: [{ text: `Mock result for tool ${name}` }]
    };
  }
}

/**
 * Mock LLM Provider for testing
 */
class MockLLMProvider implements LLMProvider {
  name = 'MockLLM';
  tools: Tool[];
  responses: LLMResponse[] = [];
  
  constructor(tools: Tool[] = [], responses: LLMResponse[] = []) {
    this.tools = tools;
    this.responses = responses;
  }
  
  async sendMessage(messages: any[], options?: any): Promise<any> {
    console.log('Mock LLM received messages:', JSON.stringify(messages, null, 2));
    
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage.content;
    
    // For testing, generate different responses based on the message content
    if (this.responses.length > 0) {
      // Return a pre-configured response
      return this.responses.shift();
    } else if (userMessage.toLowerCase().includes('calculate') || 
               userMessage.toLowerCase().includes('what is') || 
               userMessage.match(/[\d\s\+\-\*\/]+/)) {
      // Generate a calculation tool call
      return {
        content: "I'll help you calculate that. Let me use the calculator tool.",
        toolCalls: [
          {
            name: 'calculate',
            arguments: this.parseCalculation(userMessage)
          }
        ]
      };
    } else {
      // Regular response without tool calls
      return {
        content: `This is a mock response to: ${userMessage}`
      };
    }
  }
  
  formatTools(mcpTools: any[]): any[] {
    // For testing, just return the tools as-is
    return mcpTools;
  }
  
  extractToolCalls(response: any): any[] {
    // Extract tool calls from the response
    if (!response.toolCalls) return [];
    return response.toolCalls;
  }
  
  // Helper to parse calculation requests
  private parseCalculation(message: string): any {
    // Simple regex-based parsing for test
    const addMatch = message.match(/(\d+)\s*\+\s*(\d+)/);
    const subtractMatch = message.match(/(\d+)\s*\-\s*(\d+)/);
    const multiplyMatch = message.match(/(\d+)\s*\*\s*(\d+)/);
    const divideMatch = message.match(/(\d+)\s*\/\s*(\d+)/);
    
    if (addMatch) {
      return {
        operation: 'add',
        a: parseInt(addMatch[1]),
        b: parseInt(addMatch[2])
      };
    } else if (subtractMatch) {
      return {
        operation: 'subtract',
        a: parseInt(subtractMatch[1]),
        b: parseInt(subtractMatch[2])
      };
    } else if (multiplyMatch) {
      return {
        operation: 'multiply',
        a: parseInt(multiplyMatch[1]),
        b: parseInt(multiplyMatch[2])
      };
    } else if (divideMatch) {
      return {
        operation: 'divide',
        a: parseInt(divideMatch[1]),
        b: parseInt(divideMatch[2])
      };
    }
    
    // Default to multiplication of 2 and 2
    return {
      operation: 'multiply',
      a: 2,
      b: 2
    };
  }
}

/**
 * Test the conversation manager
 */
async function testConversationManager() {
  console.log('=== Testing Conversation Manager ===');
  
  // Create calculator tool schema
  const calculatorTool: Tool = {
    name: 'calculate',
    description: 'Perform basic arithmetic operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
          description: 'The arithmetic operation to perform'
        },
        a: {
          type: 'number',
          description: 'First number for calculation'
        },
        b: {
          type: 'number',
          description: 'Second number for calculation'
        }
      },
      required: ['operation', 'a', 'b']
    }
  };
  
  // Create mocks
  const mockMcpClient = new MockMCPClient([calculatorTool as any]) as unknown as Client;
  
  // Test 1: Basic calculation with no approval
  console.log('\n--- Test 1: Basic calculation with no approval ---');
  
  const mockLlm1 = new MockLLMProvider();
  const result1 = await manageConversationContext(
    mockMcpClient,
    mockLlm1,
    [], // empty initial messages
    {
      userQuery: 'What is 42 * 17?',
      requireApproval: false,
      systemMessage: 'You are a calculator assistant'
    }
  );
  
  console.log('Test 1 Result:');
  console.log('Final messages:', JSON.stringify(result1.messages, null, 2));
  
  // Test 2: Pre-configured LLM responses
  console.log('\n--- Test 2: Pre-configured LLM responses ---');
  
  // Create mock with specific responses
  const mockLlm2 = new MockLLMProvider([], [
    // First response with tool call
    {
      content: "I'll help calculate 25 * 5",
      toolCalls: [
        {
          name: 'calculate',
          arguments: {
            operation: 'multiply',
            a: 25,
            b: 5
          }
        }
      ]
    } as LLMResponse,
    // Second response (after tool result)
    {
      content: "The result of 25 * 5 is 125"
    } as LLMResponse
  ]);
  
  const result2 = await manageConversationContext(
    mockMcpClient,
    mockLlm2,
    [], // empty initial messages
    {
      userQuery: 'Calculate 25 * 5',
      requireApproval: false
    }
  );
  
  console.log('Test 2 Result:');
  console.log('Final LLM Response:', result2.llmResponse.content);
  
  // Test 3: Process a specific response with processLLMResponse
  console.log('\n--- Test 3: Process a specific response ---');
  
  const initialMessages = [
    { role: 'system', content: 'You are a calculator assistant' },
    { role: 'user', content: 'Calculate 10 / 2' }
  ];
  
  // Create a response with a tool call
  const response: LLMResponse = {
    content: "Let me calculate 10 / 2",
    toolCalls: [
      {
        name: 'calculate',
        arguments: {
          operation: 'divide',
          a: 10,
          b: 2
        }
      }
    ]
  };
  
  const mockLlm3 = new MockLLMProvider([], [
    // Response after tool result
    {
      content: "The result of 10 / 2 is 5"
    } as LLMResponse
  ]);
  
  const result3 = await processLLMResponse(
    mockMcpClient,
    mockLlm3,
    response,
    [...initialMessages],
    false // no approval
  );
  
  console.log('Test 3 Result:');
  console.log('Final messages:', JSON.stringify(result3.messages, null, 2));
  console.log('Final LLM Response:', result3.llmResponse.content);
  
  console.log('\n=== All tests completed ===');
}

// Run the tests
testConversationManager().catch(error => {
  console.error('Test failed:', error);
}); 