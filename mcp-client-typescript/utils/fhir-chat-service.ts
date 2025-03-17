import { LLMWithTools } from './llm-with-tools.js';
import { GeminiProvider } from './llm-providers.js';
import dotenv from 'dotenv';

dotenv.config();

export class FhirChatService {
  private llmWithTools: LLMWithTools;
  private systemPrompt: string;
  
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    
    // Create Gemini provider
    const geminiProvider = new GeminiProvider(process.env.GEMINI_API_KEY, 'gemini-2.0-flash');
    
    // Create LLM with tools client
    this.llmWithTools = new LLMWithTools(geminiProvider);
    
    // Configure system prompt for FHIR
    this.systemPrompt = `You are a helpful assistant with expertise in FHIR (Fast Healthcare Interoperability Resources). 
      You can help users interact with FHIR data and understand medical information. 
      When users ask about patient data or medical records, try to formulate FHIR queries to help them.
      The FHIR server base URL is: ${process.env.FHIR_BASE_URL || 'http://hapi.fhir.org/baseR4'}
      
      Some example interactions:
      1. "show patient 1234" -> Get patient by ID
      2. "find patient named Smith" -> Search patients by name
      3. "get observations for patient 1234" -> Get patient observations
      
      Keep responses clear and concise. When suggesting FHIR queries, format them as proper FHIR REST API calls.`;
  }
  
  async initialize(serverPath: string = './fhir-mcp-server.js', args: string[] = []) {
    // Connect to FHIR MCP server
    await this.llmWithTools.connect(serverPath, args);
    console.log('Connected to FHIR MCP server');
  }
  
  async chat(userMessage: string, options: any = {}) {
    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userMessage }
    ];
    
    return await this.llmWithTools.chat(messages, {
      temperature: options.temperature || 0.3, // Lower temperature for more deterministic responses
      ...options
    });
  }
} 