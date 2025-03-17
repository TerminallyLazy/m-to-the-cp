import { LLMProvider } from './llm-with-tools.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Anthropic } from '@anthropic-ai/sdk';

// Gemini implementation
export class GeminiProvider implements LLMProvider {
  private model: any;
  name = 'Gemini';
  
  constructor(apiKey: string, modelName = 'gemini-2.0-flash') {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: modelName });
  }
  
  async sendMessage(messages: any[], options: any = {}) {
    const chat = this.model.startChat({
      history: messages.slice(0, -1),
      generationConfig: {
        temperature: options.temperature || 0.7,
        topK: options.topK || 40,
        topP: options.topP || 0.95,
      },
      tools: options.tools || [],
    });
    
    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    return result.response;
  }
  
  formatTools(mcpTools: any[]) {
    return mcpTools.map(tool => ({
      functionDeclarations: [{
        name: tool.name,
        description: tool.description || `Tool: ${tool.name}`,
        parameters: tool.inputSchema
      }]
    }));
  }
  
  extractToolCalls(response: any) {
    if (!response.functionCalls) return [];
    
    return response.functionCalls.map((call: any) => ({
      name: call.name,
      arguments: call.args ? JSON.parse(call.args) : {}
    }));
  }
}

// Anthropic implementation
export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  name = 'Claude';
  
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }
  
  async sendMessage(messages: any[], options: any = {}) {
    const response = await this.client.messages.create({
      model: options.model || 'claude-3-5-sonnet-20240620',
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      messages: messages,
      tools: options.tools || []
    });
    
    return response;
  }
  
  formatTools(mcpTools: any[]) {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description || `Tool: ${tool.name}`,
      input_schema: tool.inputSchema
    }));
  }
  
  extractToolCalls(response: any) {
    if (!response.content || !Array.isArray(response.content)) return [];
    
    const toolCalls = [];
    for (const content of response.content) {
      if (content.type === 'tool_use') {
        toolCalls.push({
          name: content.name,
          arguments: content.input || {}
        });
      }
    }
    
    return toolCalls;
  }
} 