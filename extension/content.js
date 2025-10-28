const MAX_SNIPPET_LENGTH = 5 * 1024; // 5 KB per block
let lastJsError = null;

window.addEventListener(
  'error',
  (event) => {
    if (event?.message) {
      lastJsError = {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        timestamp: Date.now()
      };
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
  }
  return true;
});

function collectContext() {
  const selection = window.getSelection ? window.getSelection() : null;
  const selectedText = selection ? truncate(selection.toString().trim()) : '';

  const anchorElement = findAnchorElement(selection);
  const htmlSnippet = anchorElement ? truncate(anchorElement.outerHTML || '') : '';
  const scriptSnippet = anchorElement ? extractScriptSnippet(anchorElement) : '';

  return {
    url: window.location.href,
    title: document.title,
    userAgent: navigator.userAgent,
    selectedText,
    htmlSnippet,
    scriptSnippet,
    jsError: lastJsError,
    timestamp: Date.now()
  };
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
