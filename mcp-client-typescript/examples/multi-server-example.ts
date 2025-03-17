import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCPConnectionManager } from '../connectionManager.js';
import { 
  createAnthropicLLMClient, 
  performComplexTask, 
  prepareToolsForLLM 
} from '../agentFlow.js';
import { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages.mjs";

// Load environment variables
dotenv.config();

// Make sure the API key exists
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

async function main() {
  console.log('Multi-Server MCP Example');
  console.log('-----------------------');
  
  // Create a connection manager instance
  const connectionManager = new MCPConnectionManager();
  
  try {
    // Connect to multiple servers
    console.log('Connecting to servers...');
    
    // Connect to a file server
    await connectionManager.connectToServerWithPath(
      'file', 
      'mcp-file-operations'
    );
    
    // Connect to a calculator server
    await connectionManager.connectToServerWithPath(
      'calc', 
      'mcp-calculator'
    );
    
    // List all connected servers
    const serverIds = connectionManager.getAllClientIds();
    console.log('Connected servers:', serverIds);
    
    // Get tools from all servers
    const allToolsResult = await connectionManager.getAllTools();
    console.log('All available tools:');
    
    for (const { serverId, tools } of allToolsResult) {
      console.log(`Server ${serverId} tools:`, tools.map(tool => tool.name).join(', '));
    }
    
    // Get the file server client
    const fileClient = connectionManager.getClient('file');
    if (!fileClient) {
      throw new Error('Failed to connect to file server');
    }
    
    // Create an LLM client with non-null apiKey
    const llmClient = createAnthropicLLMClient(apiKey);
    
    // Define a complex task that requires multiple steps
    const task = `
      Please help me organize my notes. I need you to:
      1. Read the content of a text file called "notes.txt"
      2. Create a new organized version with headers and better formatting
      3. Save the organized version to a new file called "notes-organized.txt"
    `;
    
    console.log('\nPerforming complex task...');
    console.log('Task:', task);
    
    // Execute the complex task
    const result = await performComplexTask(fileClient, llmClient, task, {
      systemPrompt: 'You are a helpful assistant with access to available Model Context Protocol (MCP) Servers with various tools. You will use the tools to accomplish tasks.',
      maxIterations: 5,
      temperature: 0.3,
    });
    
    console.log(`\nTask completed in ${result.iterations} iterations.`);
    console.log(`Task was ${result.completed ? 'completed successfully' : 'not completed within the maximum iterations'}.`);
    
    // Now demonstrate using multiple servers in a single flow
    console.log('\nDemonstrating multi-server agentic flow...');
    
    // Create a multi-server task
  await demonstrateMultiServerFlow(connectionManager);
    
  } catch (error) {
    console.error('Error in multi-server example:', error);
  } finally {
    // Disconnect from all servers
    console.log('\nDisconnecting from all servers...');
    await connectionManager.disconnectAll();
    console.log('All servers disconnected');
  }
}

async function demonstrateMultiServerFlow(connectionManager: MCPConnectionManager) {
  // Get clients for different servers
  const fileClient = connectionManager.getClient('file');
  const calcClient = connectionManager.getClient('calc');
  
  if (!fileClient || !calcClient) {
    throw new Error('Required servers not connected');
  }
  
  // Create an LLM client
  const llmClient = createAnthropicLLMClient(apiKey);
  
  // Define a task that requires tools from multiple servers
  const task = `
    I need to analyze some numerical data. Please:
    1. Read the numbers from a file called "data.txt"
    2. Calculate the average of these numbers
    3. Save the result to a new file called "result.txt"
  `;
  
  console.log('Task:', task);
  
  // First use the file client to read the data
  const fileTools = await prepareToolsForLLM(fileClient);
  const calcTools = await prepareToolsForLLM(calcClient);
  
  // Combine tools from both servers
  const combinedTools = [...fileTools, ...calcTools];
  
  // Start with a simple task to read the file
  let messages: MessageParam[] = [{
    role: 'user',
    content: 'Read the contents of data.txt',
  }];
  
  // First step: Read the file
  console.log('Step 1: Reading file...');
  const readResponse = await llmClient.sendMessage(messages, { 
    tools: fileTools,
    systemPrompt: 'You are a helpful assistant with access to available Model Context Protocol (MCP) Servers with various tools. You will use the tools to accomplish tasks, and you can read files.'
  });
  
  // Process the tool calls (simplified for example)
  if (readResponse.tool_calls && readResponse.tool_calls.length > 0) {
    const toolCall = readResponse.tool_calls[0];
    
    try {
      console.log(`Executing tool: ${toolCall.name}`);
      
      const result = await fileClient.callTool({
        name: toolCall.name,
        arguments: toolCall.input,
      });
      
      // Assume the file contains a list of numbers
      const fileContents = result.content as string;
      console.log('File contents:', fileContents);
      
      // Second step: Calculate average using the calculator server
      console.log('\nStep 2: Calculating average...');
      
      messages.push({
        role: 'assistant',
        content: readResponse.content,
      });
      
      messages.push({
        role: 'user',
        content: `The file contains: ${fileContents}. Now calculate the average of these numbers.`,
      });
      
      const calcResponse = await llmClient.sendMessage(messages, { 
        tools: calcTools,
        systemPrompt: 'You are a helpful assistant with access to available Model Context Protocol (MCP) Servers with various tools. You will use the tools to accomplish tasks, and you can perform calculations.'
      });
      
      // Process calculation tool call
      if (calcResponse.tool_calls && calcResponse.tool_calls.length > 0) {
        const calcToolCall = calcResponse.tool_calls[0];
        
        try {
          console.log(`Executing tool: ${calcToolCall.name}`);
          
          const calcResult = await calcClient.callTool({
            name: calcToolCall.name,
            arguments: calcToolCall.input,
          });
          
          const average = calcResult.content;
          console.log('Calculated average:', average);
          
          // Third step: Save result to a file
          console.log('\nStep 3: Saving result...');
          
          messages.push({
            role: 'assistant',
            content: calcResponse.content,
          });
          
          messages.push({
            role: 'user',
            content: `The average is ${average}. Now save this result to a file called "result.txt".`,
          });
          
          const saveResponse = await llmClient.sendMessage(messages, { 
            tools: fileTools,
            systemPrompt: 'You are a helpful assistant with access to available Model Context Protocol (MCP) Servers with various tools. You will use the tools to accomplish tasks. You can work with files.'
          });
          
          // Process save file tool call
          if (saveResponse.tool_calls && saveResponse.tool_calls.length > 0) {
            const saveToolCall = saveResponse.tool_calls[0];
            
            try {
              console.log(`Executing tool: ${saveToolCall.name}`);
              
              const saveResult = await fileClient.callTool({
                name: saveToolCall.name,
                arguments: saveToolCall.input,
              });
              
              console.log('Result saved successfully');
              
              // Final confirmation
              messages.push({
                role: 'assistant',
                content: saveResponse.content,
              });
              
              messages.push({
                role: 'user',
                content: 'Summarize what you did.',
              });
              
              const finalResponse = await llmClient.sendMessage(messages, { 
                systemPrompt: 'YYou are a helpful assistant with access to available Model Context Protocol (MCP) Servers with various tools. You will use the tools to accomplish tasks.'
              });
              
              console.log('\nTask summary:', finalResponse.content);
              
            } catch (error) {
              console.error('Error saving result:', error);
            }
          }
          
        } catch (error) {
          console.error('Error calculating average:', error);
        }
      }
      
    } catch (error) {
      console.error('Error reading file:', error);
    }
  }
}

// Run the example
main().catch(console.error); 