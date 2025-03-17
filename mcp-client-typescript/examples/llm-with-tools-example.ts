import { LLMWithTools } from '../utils/llm-with-tools.js';
import { GeminiProvider, AnthropicProvider } from '../utils/llm-providers.js';
import { FhirChatService } from '../utils/fhir-chat-service.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Example showing how to use the LLM with tools implementation
 * with different LLM providers
 */
async function llmWithToolsExample() {
  try {
    // Choose your LLM provider based on environment variable
    const useGemini = process.env.USE_GEMINI === 'true';
    
    if (useGemini) {
      console.log('--- USING GEMINI LLM PROVIDER ---');
      
      // Check for API key
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
      }
      
      // Create Gemini provider
      const geminiProvider = new GeminiProvider(process.env.GEMINI_API_KEY);
      
      // Create LLM with tools client
      const llmWithTools = new LLMWithTools(geminiProvider);
      
      // Connect to calculator tool server
      await llmWithTools.connect('npx', ['-y', '@modelcontextprotocol/mcp-server-calculator']);
      
      // Create messages array with a simple calculation request
      const messages = [
        { role: 'system', content: 'You are a helpful assistant with access to tools. When asked to calculate something, use the calculate tool.' },
        { role: 'user', content: 'Can you calculate 42 * 17?' }
      ];
      
      // Send chat and get response with tool calls
      console.log('Sending request to Gemini...');
      const response = await llmWithTools.chat(messages);
      
      // Print results
      console.log('\nGemini Response:');
      console.log(response.llmResponse);
      
      if (response.toolResults.length > 0) {
        console.log('\nTool Results:');
        console.log(JSON.stringify(response.toolResults, null, 2));
      }
    } else {
      console.log('--- USING CLAUDE LLM PROVIDER ---');
      
      // Check for API key
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
      }
      
      // Create Claude provider
      const claudeProvider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
      
      // Create LLM with tools client
      const llmWithTools = new LLMWithTools(claudeProvider);
      
      // Connect to calculator tool server
      await llmWithTools.connect('npx', ['-y', '@modelcontextprotocol/mcp-server-calculator']);
      
      // Create messages array with a simple calculation request
      const messages = [
        { role: 'system', content: 'You are a helpful assistant with access to tools. When asked to calculate something, use the calculate tool.' },
        { role: 'user', content: 'Can you calculate 42 * 17?' }
      ];
      
      // Send chat and get response with tool calls
      console.log('Sending request to Claude...');
      const response = await llmWithTools.chat(messages);
      
      // Print results
      console.log('\nClaude Response:');
      if (response.llmResponse.content) {
        console.log(response.llmResponse.content
          .filter((content: any) => content.type === 'text')
          .map((content: any) => content.text)
          .join('\n'));
      }
      
      if (response.toolResults.length > 0) {
        console.log('\nTool Results:');
        console.log(JSON.stringify(response.toolResults, null, 2));
      }
    }
    
    // FHIR Example (using Gemini)
    console.log('\n\n--- FHIR CHAT SERVICE EXAMPLE ---');
    
    // Only run FHIR example if configured
    if (process.env.RUN_FHIR_EXAMPLE === 'true') {
      try {
        const fhirChat = new FhirChatService();
        
        // Initialize with a mock FHIR server (replace with actual server path)
        // In a real scenario, this would be your actual FHIR MCP server
        await fhirChat.initialize('./mock-fhir-server.js', []);
        
        // Example query
        const userQuery = "Show me patient 123456";
        console.log(`User: ${userQuery}`);
        
        // Send to FHIR chat service
        const response = await fhirChat.chat(userQuery);
        
        // Display response
        console.log("Assistant:");
        if (response.llmResponse.text) {
          console.log(response.llmResponse.text);
        } else if (response.llmResponse.content) {
          console.log(response.llmResponse.content);
        }
        
        // Display FHIR data if any tools were called
        if (response.toolResults.length > 0) {
          console.log('\nFHIR Data:');
          response.toolResults.forEach(result => {
            if (result.status === 'success' && result.result && result.result.content && 
                Array.isArray(result.result.content) && result.result.content.length > 0 && 
                'text' in result.result.content[0]) {
              console.log(result.result.content[0].text);
            }
          });
        }
      } catch (error: any) {
        console.error('FHIR Example Error:', error.message);
      }
    } else {
      console.log('FHIR example skipped. Set RUN_FHIR_EXAMPLE=true to run it.');
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

// Only run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  llmWithToolsExample().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 