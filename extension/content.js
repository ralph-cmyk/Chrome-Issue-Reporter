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
const MODAL_OVERLAY_ID = 'chrome-issue-reporter-modal-overlay';
const MODAL_STYLE_ID = 'chrome-issue-reporter-modal-styles';
const MAX_AUTO_TITLE_LENGTH = 100;
let modalElements = null;
let toastTimeoutId = null;
const columnsCache = new Map();
const modalState = {
  context: null,
  screenshotDataUrl: null,
  repo: null,
  preferences: { milestoneNumber: null, projectId: null, statusFieldId: null, statusOptionId: null },
  generatedTitle: '',
  titleDirty: false,
  submitting: false,
  lastIssue: null,
  projectFieldId: null
};
let modalStylesInjected = false;

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
  (async () => {
    switch (message?.type) {
      case 'captureContext': {
        try {
          const context = collectContext();
          sendResponse(context);
        } catch (error) {
          sendResponse({ error: error.message || 'Unable to capture context.' });
        }
        break;
      }
      case 'startLiveSelect': {
        startLiveSelect();
        sendResponse({ success: true });
        break;
      }
      case 'stopLiveSelect': {
        stopLiveSelect();
        sendResponse({ success: true });
        break;
      }
      case 'ping': {
        sendResponse({ success: true });
        break;
      }
      case 'startIssueFlow': {
        closeIssueModal();
        startLiveSelect();
        sendResponse({ success: true });
        break;
      }
      case 'showIssueModal': {
        try {
          await openIssueModal(message.payload || {}, Boolean(message.fromLiveSelect));
          sendResponse({ success: true });
        } catch (error) {
          console.error('Failed to open issue modal', error);
          sendResponse({ success: false, error: error.message || 'Failed to open issue modal.' });
        }
        break;
      }
      case 'issueFlowError': {
        showToast(message?.message || 'Unable to start issue capture on this page.', 'error');
        sendResponse({ success: true });
        break;
      }
      default:
        // Allow other handlers to process if needed
        sendResponse({ success: false, error: 'Unhandled message type' });
    }
  })();
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
  const rect = target.getBoundingClientRect();
  const selection = {
    rect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    },
    devicePixelRatio: window.devicePixelRatio || 1
  };
  
  // Send to background script
  chrome.runtime.sendMessage({
    type: 'liveSelectComplete',
    context: context,
    selection
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

function ensureModalStyles() {
  if (modalStylesInjected) {
    return;
  }
  const style = document.createElement('style');
  style.id = MODAL_STYLE_ID;
  style.textContent = `
    #${MODAL_OVERLAY_ID} {
      position: fixed !important;
      inset: 0 !important;
      display: none !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(15, 23, 42, 0.45) !important;
      z-index: 2147483644 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      color: #0f172a !important;
    }
    #${MODAL_OVERLAY_ID}.is-visible {
      display: flex !important;
    }
    #${MODAL_OVERLAY_ID} .cir-modal {
      width: min(520px, calc(100vw - 48px)) !important;
      background: #ffffff !important;
      border-radius: 18px !important;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.26) !important;
      padding: 24px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 14px !important;
    }
    #${MODAL_OVERLAY_ID} .cir-modal-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      gap: 12px !important;
    }
    #${MODAL_OVERLAY_ID} .cir-heading {
      font-size: 18px !important;
      font-weight: 700 !important;
      color: #4338ca !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
    #${MODAL_OVERLAY_ID} .cir-heading::before {
      content: "🐛";
    }
    #${MODAL_OVERLAY_ID} .cir-close {
      border: none !important;
      background: transparent !important;
      font-size: 20px !important;
      cursor: pointer !important;
      color: #64748b !important;
      padding: 4px !important;
      border-radius: 6px !important;
      line-height: 1 !important;
    }
    #${MODAL_OVERLAY_ID} .cir-close:hover {
      background: rgba(99, 102, 241, 0.08) !important;
      color: #4338ca !important;
    }
    #${MODAL_OVERLAY_ID} .cir-status {
      min-height: 20px !important;
      font-size: 13px !important;
      border-radius: 10px !important;
      padding: 0 !important;
      color: transparent !important;
      transition: background 0.2s ease, color 0.2s ease !important;
    }
    #${MODAL_OVERLAY_ID} .cir-status.is-visible {
      padding: 10px 12px !important;
      color: #0f172a !important;
    }
    #${MODAL_OVERLAY_ID} .cir-status.info {
      background: rgba(99, 102, 241, 0.12) !important;
      color: #3730a3 !important;
    }
    #${MODAL_OVERLAY_ID} .cir-status.error {
      background: rgba(248, 113, 113, 0.18) !important;
      color: #b91c1c !important;
    }
    #${MODAL_OVERLAY_ID} .cir-status.success {
      background: rgba(16, 185, 129, 0.16) !important;
      color: #047857 !important;
    }
    #${MODAL_OVERLAY_ID} .cir-form {
      display: flex !important;
      flex-direction: column !important;
      gap: 12px !important;
    }
    #${MODAL_OVERLAY_ID} .cir-form button,
    #${MODAL_OVERLAY_ID} .cir-form input,
    #${MODAL_OVERLAY_ID} .cir-form select,
    #${MODAL_OVERLAY_ID} .cir-form textarea {
      font-family: inherit !important;
      font-size: 14px !important;
    }
    #${MODAL_OVERLAY_ID} .cir-live-select {
      border: none !important;
      background: linear-gradient(135deg, #34d399 0%, #10b981 100%) !important;
      color: white !important;
      padding: 12px !important;
      border-radius: 12px !important;
      cursor: pointer !important;
      font-weight: 600 !important;
      box-shadow: 0 10px 20px rgba(16, 185, 129, 0.25) !important;
      transition: transform 0.15s ease, box-shadow 0.15s ease !important;
    }
    #${MODAL_OVERLAY_ID} .cir-live-select:disabled {
      opacity: 0.6 !important;
      cursor: not-allowed !important;
      box-shadow: none !important;
    }
    #${MODAL_OVERLAY_ID} .cir-live-select:hover:not(:disabled) {
      transform: translateY(-1px) !important;
      box-shadow: 0 12px 24px rgba(16, 185, 129, 0.35) !important;
    }
    #${MODAL_OVERLAY_ID} .cir-label {
      font-size: 13px !important;
      font-weight: 600 !important;
      color: #475569 !important;
      display: block !important;
    }
    #${MODAL_OVERLAY_ID} .cir-input,
    #${MODAL_OVERLAY_ID} .cir-select,
    #${MODAL_OVERLAY_ID} .cir-textarea {
      width: 100% !important;
      border-radius: 10px !important;
      border: 1px solid #e2e8f0 !important;
      padding: 10px 12px !important;
      background: #f8fafc !important;
      transition: border 0.15s ease, box-shadow 0.15s ease !important;
      color: #0f172a !important;
    }
    #${MODAL_OVERLAY_ID} .cir-textarea {
      min-height: 110px !important;
      resize: vertical !important;
      line-height: 1.5 !important;
    }
    #${MODAL_OVERLAY_ID} .cir-input:focus,
    #${MODAL_OVERLAY_ID} .cir-select:focus,
    #${MODAL_OVERLAY_ID} .cir-textarea:focus {
      outline: none !important;
      border-color: #6366f1 !important;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
      background: #ffffff !important;
    }
    #${MODAL_OVERLAY_ID} .cir-submit {
      width: 100% !important;
      border: none !important;
      border-radius: 12px !important;
      padding: 12px !important;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      box-shadow: 0 12px 24px rgba(99, 102, 241, 0.28) !important;
      transition: transform 0.15s ease, box-shadow 0.15s ease !important;
    }
    #${MODAL_OVERLAY_ID} .cir-submit:disabled {
      opacity: 0.7 !important;
      cursor: not-allowed !important;
      box-shadow: none !important;
    }
    #${MODAL_OVERLAY_ID} .cir-submit:hover:not(:disabled) {
      transform: translateY(-1px) !important;
      box-shadow: 0 14px 28px rgba(99, 102, 241, 0.35) !important;
    }
    #${MODAL_OVERLAY_ID} .cir-context summary {
      cursor: pointer !important;
      user-select: none !important;
      font-weight: 600 !important;
      color: #4f46e5 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
    #${MODAL_OVERLAY_ID} .cir-context summary::marker {
      display: none !important;
    }
    #${MODAL_OVERLAY_ID} .cir-context .cir-context-preview {
      max-height: 160px !important;
      overflow: auto !important;
      background: #f8fafc !important;
      border-radius: 10px !important;
      padding: 12px !important;
      border: 1px solid #e2e8f0 !important;
      white-space: pre-wrap !important;
      margin-top: 10px !important;
      font-size: 12px !important;
      color: #475569 !important;
    }
    #${MODAL_OVERLAY_ID} .cir-screenshot-container {
      margin-top: 12px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
    }
    #${MODAL_OVERLAY_ID} .cir-screenshot-container img {
      width: 100% !important;
      border-radius: 10px !important;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15) !important;
      border: 1px solid #e2e8f0 !important;
    }
    #${MODAL_OVERLAY_ID} .cir-modal-footer {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      font-size: 12px !important;
      color: #64748b !important;
    }
    #${MODAL_OVERLAY_ID} .cir-settings {
      background: none !important;
      border: none !important;
      color: #4f46e5 !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      padding: 0 !important;
    }
    #${MODAL_OVERLAY_ID} .cir-last-issue {
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      background: rgba(16, 185, 129, 0.15) !important;
      color: #047857 !important;
      padding: 4px 8px !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      text-decoration: none !important;
    }
    #chrome-issue-reporter-toast {
      position: fixed !important;
      bottom: 18px !important;
      right: 18px !important;
      background: #111827 !important;
      color: #f8fafc !important;
      padding: 12px 16px !important;
      border-radius: 12px !important;
      box-shadow: 0 16px 30px rgba(15, 23, 42, 0.25) !important;
      font-size: 13px !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity 0.25s ease !important;
      z-index: 2147483646 !important;
    }
    #chrome-issue-reporter-toast.is-visible {
      opacity: 1 !important;
      pointer-events: auto !important;
    }
    #chrome-issue-reporter-toast.success {
      background: #16a34a !important;
    }
    #chrome-issue-reporter-toast.error {
      background: #b91c1c !important;
    }
    #chrome-issue-reporter-toast a {
      color: inherit !important;
      text-decoration: underline !important;
      font-weight: 600 !important;
    }
  `;
  document.head.appendChild(style);
  modalStylesInjected = true;
}

function ensureIssueModalElements() {
  if (modalElements) {
    return modalElements;
  }

  ensureModalStyles();

  const overlay = document.createElement('div');
  overlay.id = MODAL_OVERLAY_ID;
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML = `
    <div class="cir-modal" role="dialog" aria-modal="true" aria-labelledby="cir-heading">
      <div class="cir-modal-header">
        <div class="cir-heading" id="cir-heading">Create GitHub Issue</div>
        <button type="button" class="cir-close" aria-label="Close">&times;</button>
      </div>
      <div class="cir-status" role="status"></div>
      <form class="cir-form">
        <button type="button" class="cir-live-select">🎯 Live select element</button>
        <label class="cir-label" for="cir-description">What's the problem?</label>
        <textarea id="cir-description" class="cir-textarea" placeholder="Describe what you expected and what happened…" required></textarea>
        <label class="cir-label" for="cir-title">Issue title</label>
        <input id="cir-title" class="cir-input" type="text" placeholder="Auto-generated from your selection" required />
        <label class="cir-label" for="cir-project">Project</label>
        <select id="cir-project" class="cir-select"></select>
        <label class="cir-label" for="cir-milestone">Milestone</label>
        <select id="cir-milestone" class="cir-select"></select>
        <label class="cir-label" for="cir-column">Status</label>
        <select id="cir-column" class="cir-select"></select>
        <button type="submit" class="cir-submit">Create issue</button>
      </form>
      <details class="cir-context">
        <summary>See full context</summary>
        <pre class="cir-context-preview"></pre>
        <div class="cir-screenshot-container"></div>
      </details>
      <div class="cir-modal-footer">
        <span class="cir-repo"></span>
        <div class="cir-footer-actions">
          <a href="#" class="cir-last-issue" target="_blank" rel="noreferrer" style="display:none;">Last issue</a>
          <button type="button" class="cir-settings">Settings</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const modal = overlay.querySelector('.cir-modal');
  const status = overlay.querySelector('.cir-status');
  const form = overlay.querySelector('.cir-form');
  const liveSelectButton = overlay.querySelector('.cir-live-select');
  const description = overlay.querySelector('#cir-description');
  const title = overlay.querySelector('#cir-title');
  const projectSelect = overlay.querySelector('#cir-project');
  const milestoneSelect = overlay.querySelector('#cir-milestone');
  const columnSelect = overlay.querySelector('#cir-column');
  const submitButton = overlay.querySelector('.cir-submit');
  const contextPreview = overlay.querySelector('.cir-context-preview');
  const screenshotContainer = overlay.querySelector('.cir-screenshot-container');
  const repoLabel = overlay.querySelector('.cir-repo');
  const settingsButton = overlay.querySelector('.cir-settings');
  const closeButton = overlay.querySelector('.cir-close');
  const lastIssueLink = overlay.querySelector('.cir-last-issue');

  closeButton.addEventListener('click', () => closeIssueModal());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeIssueModal();
    }
  });

  liveSelectButton.addEventListener('click', () => {
    closeIssueModal();
    startLiveSelect();
  });

  settingsButton.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
    closeIssueModal();
  });

  form.addEventListener('submit', handleModalSubmit);
  description.addEventListener('input', handleDescriptionInput);
  title.addEventListener('input', () => {
    if (!modalState.submitting) {
      modalState.titleDirty = true;
    }
  });
  projectSelect.addEventListener('change', handleProjectChange);
  milestoneSelect.addEventListener('change', handleMilestoneChange);
  columnSelect.addEventListener('change', handleColumnChange);

  modalElements = {
    overlay,
    modal,
    status,
    form,
    liveSelectButton,
    description,
    title,
    projectSelect,
    milestoneSelect,
    columnSelect,
    submitButton,
    contextPreview,
    screenshotContainer,
    repoLabel,
    settingsButton,
    lastIssueLink
  };

  return modalElements;
}

async function openIssueModal(payload = {}, fromLiveSelect = false) {
  const elements = ensureIssueModalElements();
  modalState.context = payload.context || null;
  modalState.screenshotDataUrl = payload.screenshotDataUrl || null;
  modalState.repo = payload.repo || null;
  modalState.preferences = payload.preferences || { milestoneNumber: null, projectId: null, statusFieldId: null, statusOptionId: null };
  modalState.generatedTitle = buildDefaultTitle(modalState.context);
  modalState.titleDirty = false;
  modalState.submitting = false;
  modalState.lastIssue = payload.lastIssue || null;
  modalState.projectFieldId = modalState.preferences.statusFieldId || null;

  setModalStatus('');
  setSubmittingState(false);

  elements.description.value = '';
  elements.description.placeholder = modalState.context?.elementDescription
    ? `e.g., The ${modalState.context.elementDescription} is misaligned…`
    : 'Describe what you expected and what happened…';

  elements.title.value = modalState.generatedTitle || '';

  elements.repoLabel.textContent = modalState.repo
    ? `${modalState.repo.owner}/${modalState.repo.name}`
    : 'Repository not configured';

  updateContextPreview(modalState.context);
  updateScreenshotPreview(modalState.screenshotDataUrl, modalState.context);
  updateLastIssueLink(payload.lastIssue);

  elements.overlay.classList.add('is-visible');
  document.body.dataset.cirIssueModalOpen = 'true';
  document.body.style.setProperty('overflow', 'hidden');

  requestAnimationFrame(() => {
    elements.description.focus();
  });

  document.addEventListener('keydown', handleModalKeydown, true);

  try {
    await populateDropdowns();
  } catch (error) {
    console.error('Unable to populate dropdowns', error);
    setModalStatus(error.message || 'Unable to load milestones and projects.', 'error');
  }

  if (fromLiveSelect) {
    showToast('Element captured. Describe the problem and submit when ready.');
  }
}

function closeIssueModal() {
  if (!modalElements) {
    return;
  }
  modalElements.overlay.classList.remove('is-visible');
  document.body.removeAttribute('data-cir-issue-modal-open');
  document.body.style.removeProperty('overflow');
  document.removeEventListener('keydown', handleModalKeydown, true);
}

function setModalStatus(message, type = 'info') {
  if (!modalElements) return;
  const statusEl = modalElements.status;
  statusEl.textContent = message || '';
  statusEl.className = 'cir-status';
  if (message) {
    statusEl.classList.add('is-visible', type);
  }
}

function setSubmittingState(isSubmitting) {
  if (!modalElements) return;
  modalState.submitting = isSubmitting;
  const controls = [
    modalElements.description,
    modalElements.title,
    modalElements.projectSelect,
    modalElements.milestoneSelect,
    modalElements.columnSelect,
    modalElements.submitButton,
    modalElements.liveSelectButton
  ];
  controls.forEach(control => {
    control.disabled = isSubmitting;
  });
  modalElements.submitButton.textContent = isSubmitting ? 'Creating…' : 'Create issue';
}

async function populateDropdowns() {
  if (!modalElements) return;

  modalElements.projectSelect.innerHTML = '<option value="">Loading projects…</option>';
  modalElements.projectSelect.disabled = true;
  modalElements.milestoneSelect.innerHTML = '<option value="">Loading milestones…</option>';
  modalElements.milestoneSelect.disabled = true;
  modalElements.columnSelect.innerHTML = '<option value="">Select a project first</option>';
  modalElements.columnSelect.disabled = true;

  const milestonePromise = chrome.runtime.sendMessage({ type: 'getMilestones' }).catch(() => null);
  const projectsPromise = chrome.runtime.sendMessage({ type: 'getProjects' }).catch(() => null);

  const [milestonesResponse, projectsResponse] = await Promise.all([milestonePromise, projectsPromise]);

  const milestones = milestonesResponse?.success ? milestonesResponse.milestones || [] : [];
  const projects = projectsResponse?.success ? projectsResponse.projects || [] : [];

  modalElements.milestoneSelect.innerHTML = '';
  const milestoneDefaultOption = document.createElement('option');
  milestoneDefaultOption.value = '';
  milestoneDefaultOption.textContent = 'No milestone';
  modalElements.milestoneSelect.appendChild(milestoneDefaultOption);
  milestones.forEach(milestone => {
    const option = document.createElement('option');
    option.value = String(milestone.number);
    const due = milestone.due_on ? ` • due ${new Date(milestone.due_on).toLocaleDateString()}` : '';
    option.textContent = `${milestone.title}${due}`;
    modalElements.milestoneSelect.appendChild(option);
  });
  modalElements.milestoneSelect.disabled = false;

  if (modalState.preferences.milestoneNumber && milestones.some(m => m.number === modalState.preferences.milestoneNumber)) {
    modalElements.milestoneSelect.value = String(modalState.preferences.milestoneNumber);
  } else {
    modalElements.milestoneSelect.value = '';
  }

  modalElements.projectSelect.innerHTML = '';
  const projectDefaultOption = document.createElement('option');
  projectDefaultOption.value = '';
  projectDefaultOption.textContent = 'No project board';
  modalElements.projectSelect.appendChild(projectDefaultOption);
  projects.forEach(project => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    modalElements.projectSelect.appendChild(option);
  });
  modalElements.projectSelect.disabled = false;

  const preferredProjectId = modalState.preferences.projectId;
  if (preferredProjectId && projects.some(project => project.id === preferredProjectId)) {
    modalElements.projectSelect.value = preferredProjectId;
    const columnData = await loadColumnsForProject(preferredProjectId, modalState.preferences.statusOptionId || null);
    modalState.preferences.statusFieldId = columnData?.fieldId || null;
  } else {
    modalElements.projectSelect.value = '';
    modalState.projectFieldId = null;
    modalElements.columnSelect.innerHTML = '<option value="">Select a project first</option>';
    modalElements.columnSelect.disabled = true;
  }
}

async function loadColumnsForProject(projectId, selectOptionId = null) {
  if (!modalElements) return;
  if (!projectId) {
    modalState.projectFieldId = null;
    modalElements.columnSelect.innerHTML = '<option value="">Select a project first</option>';
    modalElements.columnSelect.disabled = true;
    return null;
  }

  let columnData = columnsCache.get(projectId);
  if (!columnData) {
    const response = await chrome.runtime.sendMessage({ type: 'getProjectColumns', projectId }).catch(() => null);
    if (!response?.success) {
      modalState.projectFieldId = null;
      modalElements.columnSelect.innerHTML = '<option value="">Unable to load status options</option>';
      modalElements.columnSelect.disabled = true;
      return null;
    }
    columnData = response.columns || { fieldId: null, options: [] };
    columnsCache.set(projectId, columnData);
  }

  modalState.projectFieldId = columnData.fieldId || null;
  modalState.preferences.statusFieldId = columnData.fieldId || null;

  const options = Array.isArray(columnData.options) ? columnData.options : [];

  modalElements.columnSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = options.length > 0 ? 'Select status' : 'No status options';
  modalElements.columnSelect.appendChild(defaultOption);

  options.forEach(option => {
    const optionEl = document.createElement('option');
    optionEl.value = option.id;
    optionEl.textContent = option.name;
    modalElements.columnSelect.appendChild(optionEl);
  });

  modalElements.columnSelect.disabled = options.length === 0;

  if (selectOptionId && options.some(option => option.id === selectOptionId)) {
    modalElements.columnSelect.value = selectOptionId;
    modalState.preferences.statusOptionId = selectOptionId;
  } else {
    modalElements.columnSelect.value = '';
    modalState.preferences.statusOptionId = null;
  }

  return columnData;
}

async function handleModalSubmit(event) {
  event.preventDefault();
  if (modalState.submitting) {
    return;
  }

  const title = modalElements.title.value.trim();
  const description = modalElements.description.value.trim();

  if (!title) {
    setModalStatus('Title is required.', 'error');
    modalElements.title.focus();
    return;
  }

  if (!description) {
    setModalStatus('Please describe what\'s wrong.', 'error');
    modalElements.description.focus();
    return;
  }

  setModalStatus('Creating issue…', 'info');
  setSubmittingState(true);

  const projectId = modalElements.projectSelect.value || null;
  const milestoneNumber = Number(modalElements.milestoneSelect.value) || null;
  const statusOptionId = modalElements.columnSelect.value || null;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'createIssue',
      payload: {
        title,
        description,
        context: modalState.context,
        milestoneNumber: milestoneNumber || undefined,
        projectId: projectId || undefined,
        projectFieldId: modalState.projectFieldId || undefined,
        projectOptionId: statusOptionId || undefined,
        screenshotDataUrl: modalState.screenshotDataUrl
      }
    });

    if (response?.success) {
      const issue = response.issue;
      closeIssueModal();
      showToast(`Issue #${issue.number} created`, 'success', { href: issue.html_url, label: 'Open issue' });
    } else {
      throw new Error(response?.error || 'Issue creation failed');
    }
  } catch (error) {
    console.error('Issue creation error', error);
    setModalStatus(error.message || 'Failed to create issue.', 'error');
    setSubmittingState(false);
  }
}

function handleDescriptionInput() {
  if (modalState.titleDirty || modalState.submitting || !modalElements) {
    return;
  }
  const autoTitle = generateTitleFromDescription(modalElements.description.value, buildDefaultTitle(modalState.context));
  modalState.generatedTitle = autoTitle;
  modalElements.title.value = autoTitle;
}

async function handleProjectChange(event) {
  if (!modalElements) return;
  const value = event.target.value || null;
  modalState.preferences.projectId = value;
  modalState.preferences.statusOptionId = null;
  modalState.preferences.statusFieldId = null;
  modalState.projectFieldId = null;

  try {
    await chrome.runtime.sendMessage({
      type: 'saveSelectionPreferences',
      preferences: { projectId: value, statusOptionId: null, statusFieldId: null }
    });
  } catch {
    // ignore
  }

  const columnData = await loadColumnsForProject(value, null);
  if (columnData) {
    modalState.preferences.statusFieldId = columnData.fieldId || null;
    modalState.projectFieldId = columnData.fieldId || null;
    if (value && modalState.projectFieldId) {
      try {
        await chrome.runtime.sendMessage({
          type: 'saveSelectionPreferences',
          preferences: {
            projectId: value,
            statusFieldId: modalState.projectFieldId,
            statusOptionId: null
          }
        });
      } catch {
        // ignore
      }
    }
  }
}

async function handleMilestoneChange(event) {
  const value = Number(event.target.value) || null;
  modalState.preferences.milestoneNumber = value;
  try {
    await chrome.runtime.sendMessage({
      type: 'saveSelectionPreferences',
      preferences: { milestoneNumber: value }
    });
  } catch {
    // ignore
  }
}

async function handleColumnChange(event) {
  if (!modalElements) return;
  const projectId = modalElements.projectSelect.value || null;
  const statusOptionId = event.target.value || null;
  modalState.preferences.projectId = projectId;
  modalState.preferences.statusFieldId = modalState.projectFieldId;
  modalState.preferences.statusOptionId = statusOptionId || null;
  if (projectId && modalState.projectFieldId) {
    try {
      await chrome.runtime.sendMessage({
        type: 'saveSelectionPreferences',
        preferences: {
          projectId,
          statusFieldId: modalState.projectFieldId,
          statusOptionId
        }
      });
    } catch {
      // ignore
    }
  }
}

function handleModalKeydown(event) {
  if (!modalElements?.overlay.classList.contains('is-visible')) {
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeIssueModal();
  }
}

function updateContextPreview(context) {
  if (!modalElements) return;
  modalElements.contextPreview.textContent = context ? formatContextPreview(context) : 'No context captured yet.';
}

function updateScreenshotPreview(dataUrl, context) {
  if (!modalElements) return;
  modalElements.screenshotContainer.innerHTML = '';
  if (!dataUrl) {
    return;
  }

  const title = document.createElement('span');
  title.textContent = 'Screenshot';
  title.style.fontSize = '12px';
  title.style.fontWeight = '600';
  title.style.color = '#475569';

  const image = document.createElement('img');
  image.src = dataUrl;
  image.alt = context?.elementDescription ? `Screenshot of ${context.elementDescription}` : 'Screenshot of selected element';

  modalElements.screenshotContainer.appendChild(title);
  modalElements.screenshotContainer.appendChild(image);
}

function updateLastIssueLink(lastIssue) {
  if (!modalElements) return;
  const link = modalElements.lastIssueLink;
  if (lastIssue?.html_url && lastIssue?.number) {
    link.style.display = 'inline-flex';
    link.href = lastIssue.html_url;
    link.textContent = `#${lastIssue.number}`;
  } else {
    link.style.display = 'none';
    link.href = '#';
  }
}

function showToast(message, type = 'info', link) {
  let toast = document.getElementById('chrome-issue-reporter-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'chrome-issue-reporter-toast';
    document.body.appendChild(toast);
  }

  toast.className = '';
  toast.classList.add('cir-toast', 'is-visible');
  if (type !== 'info') {
    toast.classList.add(type);
  }

  toast.textContent = message;
  if (link?.href) {
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.label || 'Open';
    anchor.target = '_blank';
    anchor.rel = 'noreferrer noopener';
    anchor.style.marginLeft = '8px';
    toast.appendChild(anchor);
  }

  clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 4000);
}

function generateTitleFromDescription(description, fallback = '') {
  if (!description) {
    return fallback || 'Change requested on page';
  }
  const firstLine = description.trim().split(/\n+/)[0];
  if (!firstLine) {
    return fallback || 'Change requested on page';
  }
  let candidate = sanitizeForTitle(firstLine);
  candidate = candidate.replace(/[.!?]+$/g, '').trim();

  if (candidate.length > MAX_AUTO_TITLE_LENGTH) {
    candidate = candidate.slice(0, MAX_AUTO_TITLE_LENGTH).trim();
  }

  if (candidate) {
    candidate = candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  return candidate || fallback || 'Change requested on page';
}

function buildDefaultTitle(context) {
  if (!context) {
    return 'Change requested on page';
  }

  if (context.elementDescription) {
    const desc = context.elementDescription;
    const tagMatch = desc.match(/<(\w+)/);
    const textMatch = desc.match(/"([^"]+)"/);
    const idMatch = desc.match(/#([\w-]+)/);
    const classMatch = desc.match(/\.([\w-]+)/);

    const tag = tagMatch ? sanitizeForTitle(tagMatch[1]) : '';
    const text = textMatch ? sanitizeForTitle(textMatch[1]) : '';
    const id = idMatch ? sanitizeForTitle(idMatch[1]) : '';
    const className = classMatch ? sanitizeForTitle(classMatch[1]) : '';

    const titleParts = [];

    if (tag === 'button') {
      titleParts.push('Change requested in button');
    } else if (tag === 'a') {
      titleParts.push('Change requested in link');
    } else if (tag === 'img') {
      titleParts.push('Change requested in image');
    } else if (['input', 'textarea', 'select'].includes(tag)) {
      titleParts.push('Change requested in form field');
    } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      titleParts.push('Change requested in heading');
    } else if (tag === 'nav') {
      titleParts.push('Change requested in navigation');
    } else if (tag === 'header') {
      titleParts.push('Change requested in header');
    } else if (tag === 'footer') {
      titleParts.push('Change requested in footer');
    } else if (tag === 'section' || tag === 'div') {
      if (className) {
        if (className.includes('hero') || className.includes('banner')) {
          titleParts.push('Change requested in the hero of the page');
        } else if (className.includes('nav') || className.includes('menu')) {
          titleParts.push('Change requested in navigation');
        } else if (className.includes('card')) {
          titleParts.push('Change requested in card');
        } else if (className.includes('modal') || className.includes('dialog')) {
          titleParts.push('Change requested in modal');
        } else if (className.includes('sidebar')) {
          titleParts.push('Change requested in sidebar');
        } else {
          titleParts.push(`Change requested in ${className} section`);
        }
      } else if (id) {
        if (id.includes('hero') || id.includes('banner')) {
          titleParts.push('Change requested in the hero of the page');
        } else {
          titleParts.push(`Change requested in ${id}`);
        }
      } else {
        titleParts.push('Change requested in section');
      }
    } else if (tag) {
      titleParts.push(`Change requested in ${tag}`);
    } else {
      titleParts.push('Change requested on page');
    }

    if (text && text.length < 40) {
      titleParts.push(`(${text})`);
    }

    return sanitizeForTitle(titleParts.join(' '));
  }

  if (context.title) {
    return `Change requested: ${sanitizeForTitle(context.title)}`;
  }

  return 'Change requested on page';
}

function sanitizeForTitle(value) {
  if (!value) {
    return '';
  }
  let sanitized = String(value);
  let prevLength;
  do {
    prevLength = sanitized.length;
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  } while (sanitized.length !== prevLength);

  const dangerousSchemes = [ /javascript:/gi, /data:/gi, /vbscript:/gi, /file:/gi, /about:/gi ];
  dangerousSchemes.forEach(regex => {
    do {
      prevLength = sanitized.length;
      sanitized = sanitized.replace(regex, '');
    } while (sanitized.length !== prevLength);
  });

  do {
    prevLength = sanitized.length;
    sanitized = sanitized.replace(/on\w+=/gi, '');
  } while (sanitized.length !== prevLength);

  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  if (sanitized.length > MAX_AUTO_TITLE_LENGTH) {
    sanitized = sanitized.substring(0, MAX_AUTO_TITLE_LENGTH);
  }

  return sanitized;
}

function formatContextPreview(context) {
  if (!context) {
    return '';
  }
  const parts = [];

  if (context.elementDescription) {
    parts.push(`Selected: ${context.elementDescription}`);
  }

  if (context.url) {
    parts.push(context.url);
  }

  if (context.selectedText) {
    parts.push('\nSelection:\n' + truncatePreview(context.selectedText));
  }
  if (context.htmlSnippet) {
    parts.push('\nHTML snippet captured.');
  }
  if (context.scriptSnippet) {
    parts.push('\nJS snippet captured.');
  }
  if (context.jsError) {
    parts.push(`\nLast error: ${context.jsError.message}`);
  }
  if (context.consoleLogs && Array.isArray(context.consoleLogs) && context.consoleLogs.length > 0) {
    parts.push(`\n${context.consoleLogs.length} console log(s) captured.`);
  }

  return parts.join('\n');
}

function truncatePreview(value, limit = 200) {
  if (!value) {
    return '';
  }
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
