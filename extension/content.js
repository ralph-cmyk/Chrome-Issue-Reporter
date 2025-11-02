const MAX_SNIPPET_LENGTH = 5 * 1024; // 5 KB per block
const MAX_CONSOLE_LOGS = 100; // Maximum number of console logs to capture (increased for better debugging)
let lastJsError = null;
let consoleLogs = [];
let liveSelectMode = false;
let highlightedElement = null;
let overlayDiv = null;
let originalConsoleLog = null;
let originalConsoleError = null;
let originalConsoleWarn = null;
let originalConsoleInfo = null;
let originalConsoleDebug = null;

// Capture console logs
function initConsoleCapture() {
  if (!originalConsoleLog) {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalConsoleInfo = console.info;
    originalConsoleDebug = console.debug;
    
    console.log = function(...args) {
      captureConsoleLog('log', args);
      originalConsoleLog.apply(console, args);
    };
    
    console.error = function(...args) {
      captureConsoleLog('error', args);
      originalConsoleError.apply(console, args);
    };
    
    console.warn = function(...args) {
      captureConsoleLog('warn', args);
      originalConsoleWarn.apply(console, args);
    };
    
    console.info = function(...args) {
      captureConsoleLog('info', args);
      originalConsoleInfo.apply(console, args);
    };
    
    console.debug = function(...args) {
      captureConsoleLog('debug', args);
      originalConsoleDebug.apply(console, args);
    };
  }
}

function captureConsoleLog(type, args) {
  try {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    consoleLogs.push({
      type,
      message,
      timestamp: Date.now()
    });
    
    // Keep only the last MAX_CONSOLE_LOGS
    if (consoleLogs.length > MAX_CONSOLE_LOGS) {
      consoleLogs = consoleLogs.slice(-MAX_CONSOLE_LOGS);
    }
  } catch (error) {
    // Silently fail to avoid infinite loops
  }
}

// Initialize console capture on load
initConsoleCapture();

window.addEventListener(
  'error',
  (event) => {
    if (event?.message) {
      lastJsError = {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack || '',
        timestamp: Date.now()
      };
    }
  },
  { capture: true }
);

// Also capture unhandled promise rejections
window.addEventListener(
  'unhandledrejection',
  (event) => {
    if (event?.reason) {
      const reason = event.reason;
      const now = Date.now();
      // Only overwrite if no recent error (within 5 seconds) to avoid masking synchronous errors
      if (!lastJsError || (now - lastJsError.timestamp) > 5000) {
        lastJsError = {
          message: reason?.message || String(reason),
          source: 'Unhandled Promise Rejection',
          line: 0,
          column: 0,
          stack: reason?.stack || '',
          timestamp: now
        };
      }
    }
  },
  { capture: true }
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'captureContext') {
    try {
      const context = collectContext();
      sendResponse(context);
    } catch (error) {
      sendResponse({ error: error.message || 'Unable to capture context.' });
    }
  } else if (message?.type === 'startLiveSelect') {
    startLiveSelect();
    sendResponse({ success: true });
  } else if (message?.type === 'stopLiveSelect') {
    stopLiveSelect();
    sendResponse({ success: true });
  }
  return true;
});

function collectContext(selectedElement = null) {
  const selection = window.getSelection ? window.getSelection() : null;
  const selectedText = selection ? truncate(selection.toString().trim()) : '';

  const anchorElement = selectedElement || findAnchorElement(selection);
  const htmlSnippet = anchorElement ? truncate(anchorElement.outerHTML || '') : '';
  const scriptSnippet = anchorElement ? extractScriptSnippet(anchorElement) : '';
  const cssSelector = anchorElement ? generateCSSSelector(anchorElement) : '';
  const elementDescription = anchorElement ? getElementDescription(anchorElement) : '';

  return {
    url: window.location.href,
    title: document.title,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
    selectedText,
    htmlSnippet,
    scriptSnippet,
    cssSelector,
    elementDescription,
    jsError: lastJsError,
    consoleLogs: consoleLogs.slice(-100), // Return last 100 console logs for better debugging context
    timestamp: Date.now()
  };
}

function generateCSSSelector(element) {
  if (!element) return '';
  
  if (element.id) {
    return `#${element.id}`;
  }
  
  const path = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).join('.');
      }
    }
    path.unshift(selector);
    element = element.parentElement;
    if (path.length >= 4) break; // Limit depth
  }
  
  return path.join(' > ');
}

function getElementDescription(element) {
  if (!element) return '';
  
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = element.className && typeof element.className === 'string' 
    ? '.' + element.className.trim().split(/\s+/).filter(c => c).join('.') 
    : '';
  const text = element.textContent ? element.textContent.trim().slice(0, 50) : '';
  
  let desc = `<${tag}${id}${classes}>`;
  if (text && text.length > 0) {
    desc += ` - "${text}${text.length === 50 ? '...' : ''}"`;
  }
  
  return desc;
}

function findAnchorElement(selection) {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const node = selection.anchorNode || selection.focusNode;
  if (!node) {
    return null;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return node.closest('*');
  }
  if (node.parentElement) {
    return node.parentElement.closest('*');
  }
  return null;
}

function extractScriptSnippet(anchorElement) {
  if (!anchorElement) {
    return '';
  }
  let current = anchorElement;
  while (current) {
    if (current.tagName && current.tagName.toLowerCase() === 'script') {
      return truncate(current.textContent || '');
    }
    current = current.parentElement;
  }
  const script = anchorElement.querySelector('script');
  return script ? truncate(script.textContent || '') : '';
}

function truncate(value) {
  if (!value) {
    return '';
  }
  if (value.length <= MAX_SNIPPET_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_SNIPPET_LENGTH)}\n… (truncated)`;
}

// Live Select Mode Functions
function startLiveSelect() {
  if (liveSelectMode) return;
  
  liveSelectMode = true;
  
  // Create overlay to freeze interactions
  createOverlay();
  
  // Add event listeners
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('click', handleElementClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  
  // Show instructions
  showInstructions();
}

function stopLiveSelect() {
  if (!liveSelectMode) return;
  
  liveSelectMode = false;
  
  // Remove event listeners
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('click', handleElementClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  
  // Remove highlight
  removeHighlight();
  
  // Remove overlay
  removeOverlay();
  
  // Remove instructions
  removeInstructions();
}

function createOverlay() {
  overlayDiv = document.createElement('div');
  overlayDiv.id = 'chrome-issue-reporter-overlay';
  overlayDiv.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: rgba(0, 0, 0, 0.05) !important;
    z-index: 2147483646 !important;
    cursor: crosshair !important;
    pointer-events: none !important;
  `;
  document.documentElement.appendChild(overlayDiv);
}

function removeOverlay() {
  if (overlayDiv && overlayDiv.parentNode) {
    overlayDiv.parentNode.removeChild(overlayDiv);
  }
  overlayDiv = null;
}

function handleMouseOver(event) {
  if (!liveSelectMode) return;
  
  event.stopPropagation();
  event.preventDefault();
  
  const target = event.target;
  
  // Don't highlight our own overlay or instruction elements
  if (target.id === 'chrome-issue-reporter-overlay' || 
      target.id === 'chrome-issue-reporter-instructions' ||
      target.closest('#chrome-issue-reporter-instructions')) {
    return;
  }
  
  highlightElement(target);
}

function handleElementClick(event) {
  if (!liveSelectMode) return;
  
  event.stopPropagation();
  event.preventDefault();
  
  const target = event.target;
  
  // Don't select our own elements
  if (target.id === 'chrome-issue-reporter-overlay' || 
      target.id === 'chrome-issue-reporter-instructions' ||
      target.closest('#chrome-issue-reporter-instructions')) {
    return;
  }
  
  // Capture context for this element
  const context = collectContext(target);
  
  // Send to background script
  chrome.runtime.sendMessage({
    type: 'liveSelectComplete',
    context: context
  });
  
  // Stop live select mode
  stopLiveSelect();
}

function handleKeyDown(event) {
  if (!liveSelectMode) return;
  
  // ESC key to cancel
  if (event.key === 'Escape') {
    event.stopPropagation();
    event.preventDefault();
    stopLiveSelect();
  }
}

function highlightElement(element) {
  // Remove previous highlight
  removeHighlight();
  
  if (!element) return;
  
  highlightedElement = element;
  
  // Create highlight overlay
  const rect = element.getBoundingClientRect();
  
  // Validate and sanitize rect values to prevent injection
  const top = Math.max(0, parseFloat(rect.top) || 0);
  const left = Math.max(0, parseFloat(rect.left) || 0);
  const width = Math.max(0, parseFloat(rect.width) || 0);
  const height = Math.max(0, parseFloat(rect.height) || 0);
  
  const highlightDiv = document.createElement('div');
  highlightDiv.id = 'chrome-issue-reporter-highlight';
  highlightDiv.style.cssText = `
    position: fixed !important;
    top: ${top}px !important;
    left: ${left}px !important;
    width: ${width}px !important;
    height: ${height}px !important;
    border: 3px solid #667eea !important;
    background: rgba(102, 126, 234, 0.15) !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.4), inset 0 0 0 3px rgba(255, 255, 255, 0.5) !important;
  `;
  document.documentElement.appendChild(highlightDiv);
}

function removeHighlight() {
  const existing = document.getElementById('chrome-issue-reporter-highlight');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
  highlightedElement = null;
}

function showInstructions() {
  const instructions = document.createElement('div');
  instructions.id = 'chrome-issue-reporter-instructions';
  instructions.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
    padding: 16px 24px !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2) !important;
    z-index: 2147483647 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    pointer-events: none !important;
    animation: slideDown 0.3s ease !important;
  `;
  instructions.textContent = '🎯 Click on any element to select it (ESC to cancel)';
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
  
  document.documentElement.appendChild(instructions);
}

function removeInstructions() {
  const existing = document.getElementById('chrome-issue-reporter-instructions');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}
