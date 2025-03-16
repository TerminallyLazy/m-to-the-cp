// Core Prism import must be first
import Prism from 'prismjs';

// Import themes
import 'prismjs/themes/prism-tomorrow.css';

// Import language components
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';

// Initialize Prism
const initPrism = () => {
  if (typeof Prism !== 'undefined') {
    console.log('Initializing Prism...');
    
    // Register all languages
    const languages = [
      'javascript', 'typescript', 'jsx', 'tsx', 'json', 
      'css', 'markdown', 'bash', 'python'
    ];
    
    languages.forEach(lang => {
      if (!Prism.languages[lang]) {
        console.warn(`Language ${lang} not loaded in Prism`);
      }
    });
    
    // Manual highlighting call
    setTimeout(() => {
      try {
        Prism.highlightAll();
        console.log('Prism highlighting applied');
      } catch (err) {
        console.error('Error applying Prism highlighting:', err);
      }
    }, 0);
    
    return true;
  } else {
    console.error('Prism is not defined!');
    return false;
  }
};

// Highlight specific element
const highlightElement = (element: Element) => {
  if (typeof Prism !== 'undefined' && element) {
    try {
      Prism.highlightElement(element);
      return true;
    } catch (err) {
      console.error('Error highlighting element with Prism:', err);
      return false;
    }
  }
  return false;
};

// Export Prism and utilities
export { Prism, initPrism, highlightElement };
export default Prism; 