"use client";

import React, { useState, useEffect } from 'react';
import { Button, Stack, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box } from '@mui/material';
import classNames from 'classnames';

// Use our utility instead of direct Prism imports
import { initPrism } from '../utils/prism';

// If you want to use toast notifications, install it with:
// npm install react-hot-toast
// import { toast } from "react-hot-toast";

type ToolCallRendererProps = {
  name: string;
  args: any;
  status: string;
  result: any;
  onApprove?: (approved: boolean) => void;
  isPending?: boolean;
};

// Add CodeBlock type
type CodeBlock = {
  language: string;
  content: string;
};

export const ToolCallRenderer: React.FC<ToolCallRendererProps> = ({
  name,
  args,
  status,
  result,
  onApprove,
  isPending = false
}) => {
  const [isExpanded, setIsExpanded] = useState(name === 'code_block'); // Auto-expand code blocks
  const [isCopied, setIsCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (isCopied) {
      const timeout = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isCopied]);

  // Initialize Prism when component renders
  useEffect(() => {
    // Only initialize if we are expanded (to improve performance)
    if (isExpanded) {
      initPrism();
    }
  }, [isExpanded]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Format JSON objects for display
  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  // Copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setIsCopied(true);
        // Show notification via alert
        // If you want better notifications, install react-hot-toast
        alert('Copied to clipboard!');
      },
      (err) => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy text');
      }
    );
  };

  // Status color mapping
  const statusColors: Record<string, string> = {
    running: "bg-yellow-100 text-yellow-800",
    success: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
    pending: "bg-blue-100 text-blue-800",
  };

  const statusColor = statusColors[status.toLowerCase()] || "bg-gray-100 text-gray-800";

  // Check if result contains a code block
  const hasCodeBlock = result && 
    typeof result === 'object' && 
    result.codeBlock && 
    typeof result.codeBlock === 'object' &&
    'language' in result.codeBlock &&
    'content' in result.codeBlock;

  // Extract code block if present
  const codeBlock: CodeBlock | null = hasCodeBlock ? result.codeBlock : null;

  // Add line numbers to code
  const addLineNumbers = (code: string) => {
    return code.split('\n').map((line, index) => (
      `<div class="code-line" key=${index}>
        <span class="line-number">${index + 1}</span>
        <span class="line-content">${line}</span>
      </div>`
    )).join('');
  };

  // Get syntax highlighting class based on language
  const getSyntaxClass = (language: string) => {
    const languageMap: Record<string, string> = {
      javascript: 'language-javascript',
      js: 'language-javascript',
      typescript: 'language-typescript',
      ts: 'language-typescript',
      html: 'language-html',
      css: 'language-css',
      python: 'language-python',
      py: 'language-python',
      json: 'language-json',
      shell: 'language-shell',
      bash: 'language-bash',
      // Add more languages as needed
    };
    
    return languageMap[language.toLowerCase()] || 'language-plaintext';
  };

  // Special handling for code_block tool - show only code, not the wrapper
  if (name === 'code_block' && codeBlock) {
    return (
      <div className="my-2 rounded-lg overflow-hidden shadow-sm border border-gray-300 code-block-container">
        <div className="bg-gray-800 text-white text-xs px-3 py-2 flex justify-between items-center">
          <span className="font-mono">{codeBlock.language || 'code'}</span>
          <button 
            className={`text-xs px-2 py-1 rounded ${isCopied ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'} transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
            onClick={() => copyToClipboard(codeBlock.content)}
          >
            {isCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="relative bg-gray-900">
          <div className="absolute top-0 left-0 w-8 h-full bg-gray-800 border-r border-gray-700"></div>
          <pre className={`text-xs bg-gray-900 text-gray-100 p-3 pl-10 rounded-b overflow-auto max-h-80 whitespace-pre ${getSyntaxClass(codeBlock.language || 'plaintext')}`}>
            <code>{codeBlock.content}</code>
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      {/* Header - always visible */}
      <div 
        className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={toggleExpand}
      >
        <div className="flex items-center space-x-2">
          <div className="font-medium text-gray-700">{name}</div>
          <div className={`text-xs px-2 py-1 rounded-full ${statusColor}`}>
            {status}
          </div>
        </div>
        <button 
          className="text-gray-500 hover:text-gray-700 focus:outline-none transition-transform transform"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <svg 
            className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Details - visible when expanded */}
      {isExpanded && (
        <div className="p-3 border-t border-gray-200">
          {/* Arguments Section */}
          <div className="mb-3">
            <div className="text-sm font-medium text-gray-500 mb-1">Arguments:</div>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
              {formatJSON(args)}
            </pre>
          </div>

          {/* Result Section - shown only if there's a result */}
          {result && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Result:</div>
              
              {/* Show code block if present */}
              {codeBlock ? (
                <div className="mb-2">
                  <div className="bg-gray-800 text-white text-xs rounded-t px-3 py-2 flex justify-between items-center">
                    <span className="font-mono">{codeBlock.language || 'code'}</span>
                    <button 
                      className={`text-xs px-2 py-1 rounded ${isCopied ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'} transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent expanding/collapsing
                        copyToClipboard(codeBlock.content);
                      }}
                    >
                      {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="relative bg-gray-900">
                    <div className="absolute top-0 left-0 w-8 h-full bg-gray-800 border-r border-gray-700"></div>
                    <pre className={`text-xs bg-gray-900 text-gray-100 p-3 pl-10 rounded-b overflow-auto max-h-80 whitespace-pre ${getSyntaxClass(codeBlock.language || 'plaintext')}`}>
                      <code>{codeBlock.content}</code>
                    </pre>
                  </div>
                </div>
              ) : (
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                  {formatJSON(result)}
                </pre>
              )}

              {/* If we have both a code block and other result data, show the raw result too */}
              {codeBlock && Object.keys(result).length > 1 && (
                <div className="mt-2">
                  <div className="text-sm font-medium text-gray-500 mb-1">Complete Result:</div>
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                    {formatJSON(result)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Approval Buttons */}
          {isPending && onApprove && (
            <div className="mt-2">
              <Stack direction="row" spacing={1}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  size="small"
                  onClick={() => onApprove(true)}
                >
                  Approve
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  size="small"
                  onClick={() => onApprove(false)}
                >
                  Reject
                </Button>
              </Stack>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Render for tool approval dialog
export const ToolApprovalDialog: React.FC<{
  open: boolean;
  toolName: string;
  args: any;
  onApprove: (approved: boolean) => void;
  onClose: () => void;
}> = ({ open, toolName, args, onApprove, onClose }) => {
  // Format JSON for display
  const formatJson = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md">
      <DialogTitle>
        Tool Execution Approval
      </DialogTitle>
      <DialogContent>
        <Typography variant="h6" sx={{ mb: 1 }}>
          The AI wants to execute the <strong>{toolName}</strong> tool
        </Typography>
        
        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
          Arguments:
        </Typography>
        <Box 
          component="pre" 
          sx={{ 
            p: 2, 
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'auto',
            fontSize: '0.8rem'
          }}
        >
          <code>{formatJson(args || {})}</code>
        </Box>
        
        <Typography sx={{ mt: 2 }}>
          Do you want to allow this tool execution?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => {
          onApprove(false);
          onClose();
        }} color="error">
          Reject
        </Button>
        <Button onClick={() => {
          onApprove(true);
          onClose();
        }} color="primary" variant="contained">
          Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 