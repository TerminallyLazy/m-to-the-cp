import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Box, 
  TextField, 
  IconButton, 
  Typography, 
  Paper, 
  Divider,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import mcpService, { ChatMessage, McpServer } from '../utils/mcpService';
import { ToolCallRenderer, ToolApprovalDialog } from '../components/ToolCallRenderer';

// Import our Prism utility instead of direct Prism imports
import { initPrism } from '../utils/prism';

// Update ChatMessage interface to handle tool calls
interface ExtendedChatMessage extends ChatMessage {
  toolCalls?: Array<{
    name: string;
    args: any;
    status: string;
    result?: any;
  }>;
}

// Improved tool call extraction function with better JSON parsing
const processMessageContent = (content: string) => {
  // Clean up the content
  let cleanedContent = content.replace(/\[Code block rendered\]/g, '');
  
  // Extract tool calls if they exist
  const toolCalls: Array<{
    name: string;
    args: any;
    status: string;
    result?: any;
  }> = [];

  // More robust pattern for finding tool calls
  // This handles multi-line JSON better
  const toolCallRegex = /Tool call: (\w+) Arguments: ({[\s\S]*?}) Result: ({[\s\S]*?})(?=\n\nTool call:|$)/g;
  
  let match;
  while ((match = toolCallRegex.exec(content)) !== null) {
    try {
      const name = match[1];
      
      // Clean up potential JSON issues
      let argsText = match[2].trim();
      let resultText = match[3].trim();
      
      // Make sure we have valid JSON by handling common issues
      // Sometimes the JSON might have extra characters or be malformed
      try {
        // First try direct parsing
        const args = JSON.parse(argsText);
        const result = JSON.parse(resultText);
        
        toolCalls.push({
          name,
          args,
          status: result.success ? 'success' : 'error',
          result
        });
        
      } catch (parseError) {
        console.warn('Initial JSON parse failed, attempting to clean up JSON:', parseError);
        
        // Try to fix common JSON issues
        // 1. Handle trailing commas
        argsText = argsText.replace(/,\s*([\]}])/g, '$1');
        resultText = resultText.replace(/,\s*([\]}])/g, '$1');
        
        // 2. Fix unquoted property names
        argsText = argsText.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        resultText = resultText.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        
        // Try parsing again with fixed JSON
        try {
          const args = JSON.parse(argsText);
          const result = JSON.parse(resultText);
          
          toolCalls.push({
            name,
            args,
            status: result.success ? 'success' : 'error',
            result
          });
        } catch (finalError) {
          console.error('Failed to parse JSON after cleanup:', finalError);
          // Use empty objects as fallback
          toolCalls.push({
            name,
            args: {},
            status: 'error',
            result: { success: false, error: 'JSON parsing failed' }
          });
        }
      }
      
      // Remove the processed tool call from the content
      const fullMatch = match[0];
      cleanedContent = cleanedContent.replace(fullMatch, '');
      
    } catch (e) {
      console.error('Error processing tool call:', e);
    }
  }
  
  // Handle standalone code blocks
  const codeBlockRegex = /```([\w-]*)\n([\s\S]*?)```/g;
  let codeMatch;
  let codeBlockIndex = 0;
  
  while ((codeMatch = codeBlockRegex.exec(cleanedContent)) !== null) {
    try {
      const language = codeMatch[1] || 'text';
      const content = codeMatch[2].trim();
      const fullMatch = codeMatch[0];
      
      // Create a synthetic tool call for the code block
      toolCalls.push({
        name: 'code_block',
        args: { language },
        status: 'success',
        result: {
          success: true,
          data: 'Code block rendered',
          codeBlock: {
            language,
            content
          }
        }
      });
      
      // Replace the code block with a placeholder
      cleanedContent = cleanedContent.replace(
        fullMatch,
        `[Code block ${++codeBlockIndex}]`
      );
      
    } catch (e) {
      console.error('Error processing code block:', e);
    }
  }
  
  // Clean up any leftover whitespace from removed tool calls
  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n').trim();
  
  return { content: cleanedContent, toolCalls };
};

const ChatLayout: React.FC = () => {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectedServers, setConnectedServers] = useState<McpServer[]>([]);
  const [serverLoading, setServerLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [pendingApprovals, setPendingApprovals] = useState<Array<{id: string, toolName: string, args: any}>>([]);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [currentApproval, setCurrentApproval] = useState<{id: string, toolName: string, args: any} | null>(null);
  
  // Initialize Prism when component mounts
  useEffect(() => {
    // Initialize Prism using our utility
    initPrism();
  }, []);
  
  // Apply syntax highlighting after messages change
  useEffect(() => {
    // Use our utility to highlight code after messages update
    initPrism();
  }, [messages]);

  // Fetch connected servers
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setServerLoading(true);
        const servers = await mcpService.getServers();
        setConnectedServers(servers.filter(server => server.connected));
        setError(null);
      } catch (err) {
        console.error('Error fetching servers:', err);
        setError('Failed to fetch connected servers');
      } finally {
        setServerLoading(false);
      }
    };
    
    fetchServers();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Process incoming messages to extract and format tool calls
  const processIncomingMessage = useCallback((message: ChatMessage): ExtendedChatMessage => {
    if (message.role === 'assistant') {
      // Process the message to extract tool calls and clean up content
      const { content, toolCalls } = processMessageContent(message.content);
      console.log('Processed message:', { content, toolCalls });
      
      return {
        ...message,
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
    }
    return message as ExtendedChatMessage;
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (inputValue.trim() === '' || isLoading) return;
    
    // Add user message
    const newUserMessage: ExtendedChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Send message to Claude through MCP service
      const response = await mcpService.sendMessage(inputValue);
      console.log('Raw response from mcpService:', response);
      
      // Process the response to extract tool calls and format content
      const processedResponse = processIncomingMessage(response);
      
      setMessages((prev) => [...prev, processedResponse]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message to the backend service. Please check that the server is running.');
      
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'An error occurred while processing your request. Please check that the backend service is running.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, processIncomingMessage]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Set up tool approval handling
  useEffect(() => {
    // Register our UI approval callback with the backend
    mcpService.setToolApprovalCallback(async (toolName, args) => {
      return new Promise<boolean>((resolve) => {
        // We'll handle this in the UI with a dialog
        setCurrentApproval({
          id: `${toolName}_${Date.now()}`,
          toolName,
          args
        });
        setApprovalDialogOpen(true);
        
        // Store the resolve function to call later
        const handleApprove = (approved: boolean) => {
          resolve(approved);
          setApprovalDialogOpen(false);
          setCurrentApproval(null);
        };
        
        // Store the handler in a ref so we can access it later
        approvalHandlerRef.current = handleApprove;
      });
    });
    
    // Clean up when component unmounts
    return () => {
      mcpService.clearToolApprovalCallback();
    };
  }, []);
  
  // Poll for pending approvals (for handling approvals from other components)
  useEffect(() => {
    const fetchPendingApprovals = async () => {
      try {
        const response = await fetch(`${window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin}/api/pending-approvals`);
        if (response.ok) {
          const approvals = await response.json();
          setPendingApprovals(approvals);
        }
      } catch (error) {
        console.error('Error fetching pending approvals:', error);
      }
    };
    
    // Poll every 2 seconds
    const intervalId = setInterval(fetchPendingApprovals, 2000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Approval handler ref to avoid closure issues
  const approvalHandlerRef = useRef<(approved: boolean) => void>(() => {});
  
  // Handle tool approval
  const handleToolApproval = async (id: string, approved: boolean) => {
    try {
      const response = await fetch(`${window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin}/api/approve-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, approved }),
      });
      
      if (response.ok) {
        // Remove from pending approvals
        setPendingApprovals(prevApprovals => prevApprovals.filter(approval => approval.id !== id));
      }
    } catch (error) {
      console.error('Error approving tool:', error);
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden'
    }}>
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {messages.length === 0 ? (
        // Empty state with Claude logo
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            flex: 1,
            color: 'text.secondary',
            padding: 3
          }}
        >
          <Box 
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2
            }}
          >
            <Box component="img" src="/claude-icon.svg" alt="Claude" sx={{ width: 48, height: 48 }} />
          </Box>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Start a conversation with Claude
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ maxWidth: 450 }}>
            Claude can use tools from all connected MCP servers to help you.
          </Typography>
          {serverLoading ? (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              <Typography variant="caption">Loading connected servers...</Typography>
            </Box>
          ) : connectedServers.length > 0 ? (
            <Typography variant="caption" sx={{ mt: 2 }}>
              Connected servers: {connectedServers.map(s => s.name).join(', ')}
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ mt: 2, color: 'warning.main' }}>
              No servers connected. Connect to an MCP server to enhance Claude's capabilities.
            </Typography>
          )}
        </Box>
      ) : (
        // Message display area
        <Box 
          sx={{ 
            flex: 1, 
            overflowY: 'auto', 
            p: isMobile ? 2 : 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            scrollBehavior: 'smooth',
            // Custom scrollbar styles using sx props instead of global styles
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(155, 155, 155, 0.5)',
              borderRadius: '20px',
              border: 'transparent',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              backgroundColor: 'rgba(155, 155, 155, 0.7)',
            },
            // Code block styles
            '& .message-content pre': {
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              padding: '1rem',
              borderRadius: '0.5rem',
              overflow: 'auto',
              margin: '1rem 0',
              fontSize: '0.875rem',
            },
            '& .message-content pre code': {
              backgroundColor: 'transparent',
              padding: 0,
              fontSize: 'inherit',
            }
          }}
        >
          {messages.map((message) => (
            <Box 
              key={message.id} 
              sx={{ 
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: isMobile ? '85%' : '70%',
                animation: 'fadeIn 0.3s ease-in-out',
                '@keyframes fadeIn': {
                  '0%': {
                    opacity: 0,
                    transform: message.role === 'user' 
                      ? 'translateX(20px)' 
                      : 'translateX(-20px)'
                  },
                  '100%': {
                    opacity: 1,
                    transform: 'translateX(0)'
                  }
                }
              }}
            >
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2, 
                  bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                  borderRadius: 2,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                {/* Process message content */}
                {message.role === 'user' ? (
                  <Typography variant="body1">{message.content}</Typography>
                ) : (
                  <Box 
                    sx={{ 
                      whiteSpace: 'pre-wrap',
                      '& code': {
                        fontFamily: 'monospace',
                        backgroundColor: 'rgba(0,0,0,0.04)',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        fontSize: '0.9em'
                      }
                    }} 
                    className="message-content"
                  >
                    <Typography 
                      variant="body1" 
                      component="div" 
                      dangerouslySetInnerHTML={{ 
                        __html: message.content
                          // Highlight inline code with <code> tags
                          .replace(/`([^`]+)`/g, '<code>$1</code>')
                      }} 
                    />
                  </Box>
                )}
                
                {/* Render tool calls if present */}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    {message.toolCalls.map((toolCall, idx) => (
                      <ToolCallRenderer 
                        key={idx}
                        name={toolCall.name}
                        args={toolCall.args}
                        status={toolCall.status}
                        result={toolCall.result}
                      />
                    ))}
                  </Box>
                )}
              </Paper>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  display: 'block', 
                  mt: 0.5, 
                  mb: 1,
                  textAlign: message.role === 'user' ? 'right' : 'left'
                }}
              >
                {message.role === 'user' ? 'You' : 'Claude'} • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>
      )}

      {/* Input area */}
      <Box sx={{ p: isMobile ? 1.5 : 2, backgroundColor: 'background.paper' }}>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Send a message to Claude..."
            multiline
            maxRows={4}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading || connectedServers.length === 0}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: 'background.default',
                transition: 'box-shadow 0.3s ease',
                '&:focus-within': {
                  boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)'
                }
              },
            }}
          />
          <IconButton 
            color="primary" 
            onClick={handleSendMessage} 
            disabled={inputValue.trim() === '' || isLoading || connectedServers.length === 0}
            sx={{ 
              ml: 1, 
              p: 1,
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
              '&.Mui-disabled': {
                backgroundColor: 'rgba(59, 130, 246, 0.4)',
                color: 'white',
              }
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
          </IconButton>
        </Box>
        {connectedServers.length === 0 && !serverLoading && (
          <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
            You need to connect to at least one MCP server to chat with Claude
          </Typography>
        )}
      </Box>

      {/* Render pending approvals */}
      {pendingApprovals.length > 0 && (
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">Pending Tool Approvals</Typography>
          {pendingApprovals.map((approval) => (
            <ToolCallRenderer
              key={approval.id}
              name={approval.toolName}
              args={approval.args}
              status="pending"
              result={{}}
              isPending={true}
              onApprove={(approved) => handleToolApproval(approval.id, approved)}
            />
          ))}
        </Box>
      )}
      
      {/* Tool approval dialog */}
      <ToolApprovalDialog
        open={approvalDialogOpen}
        toolName={currentApproval?.toolName || ''}
        args={currentApproval?.args || {}}
        onApprove={(approved) => {
          if (approvalHandlerRef.current) {
            approvalHandlerRef.current(approved);
          }
        }}
        onClose={() => {
          if (approvalHandlerRef.current) {
            approvalHandlerRef.current(false); // Default to rejecting when dialog is closed
          }
          setApprovalDialogOpen(false);
        }}
      />
    </Box>
  );
};

export default ChatLayout; 