let cachedContext = null;
let defaultLabels = [];

// Constants
const SCRIPT_INITIALIZATION_DELAY = 100; // ms to wait for content script to initialize
const UNSUPPORTED_URL_PREFIXES = ['chrome://', 'chrome-extension://', 'edge://', 'about:'];

const statusEl = document.getElementById('status');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const technicalContextInput = document.getElementById('technical-context');
const contextPreviewEl = document.getElementById('context-preview');
const lastIssueEl = document.getElementById('last-issue');
const createButton = document.getElementById('create');
const liveSelectButton = document.getElementById('live-select');
const openOptionsLink = document.getElementById('open-options');
const repoInfoEl = document.getElementById('repo-info');

init();

function init() {
  document.getElementById('issue-form').addEventListener('submit', handleSubmit);
  liveSelectButton.addEventListener('click', handleLiveSelect);
  openOptionsLink.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // Add Shift+Enter handler for description textarea
  descriptionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      document.getElementById('issue-form').dispatchEvent(new Event('submit'));
    }
  });
  
  refresh();
}

async function refresh() {
  await Promise.all([
    refreshAuthState(),
    loadConfig(),
    loadContext(),
    loadLastIssue()
  ]);
}

async function refreshAuthState(preserveMessage = false) {
  const response = await chrome.runtime.sendMessage({ type: 'getAuthState' });
  
  if (response?.success && response.authenticated) {
    // Enable live select button when authenticated
    liveSelectButton.disabled = false;
    if (!preserveMessage) {
      setStatus('', 'info');
    }
  } else {
    // Disable and grey out live select button when not authenticated
    liveSelectButton.disabled = true;
    if (!preserveMessage) {
      setStatus('', 'info');
    }
  }
}

async function loadConfig() {
  const response = await chrome.runtime.sendMessage({ type: 'getConfig' });
  const repoNameEl = repoInfoEl.querySelector('.repo-name');
  
  if (response?.success) {
    defaultLabels = Array.isArray(response.config?.labels) ? response.config.labels : [];
    
    if (response.config?.owner && response.config?.repo) {
      repoNameEl.textContent = `📂 ${response.config.owner}/${response.config.repo}`;
    } else {
      repoNameEl.textContent = '📂 Repository not configured';
    }
  }
}

async function loadContext() {
  const response = await chrome.runtime.sendMessage({ type: 'getLastContext' });
  if (response?.success && response.context) {
    cachedContext = response.context;
    contextPreviewEl.textContent = formatContextPreview(cachedContext);
    
    // Store technical context in hidden field
    technicalContextInput.value = JSON.stringify(cachedContext);
    
    if (!titleInput.value) {
      titleInput.value = buildDefaultTitle(cachedContext);
    }
    // Pre-fill placeholder suggestions based on context
    if (cachedContext.elementDescription) {
      descriptionInput.placeholder = `e.g., The ${cachedContext.elementDescription} shows an error or doesn't work as expected...`;
    }
  } else {
    cachedContext = null;
    technicalContextInput.value = '';
    contextPreviewEl.textContent = 'No captured context yet. Use "Live Select" to collect details from a page element.';
  }
}

async function loadLastIssue() {
  const response = await chrome.runtime.sendMessage({ type: 'getLastIssue' });
  if (response?.success && response.issue) {
    lastIssueEl.innerHTML = `<a class="link" href="${response.issue.html_url}" target="_blank" rel="noreferrer">#${response.issue.number}</a>`;
  } else {
    lastIssueEl.textContent = '';
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const technicalContextStr = technicalContextInput.value;
  
  if (!title) {
    setStatus('Title is required.', 'error');
    return;
  }
  
  if (!description) {
    setStatus('Please describe what\'s wrong.', 'error');
    return;
  }

  // Parse the context
  let context = null;
  try {
    if (technicalContextStr) {
      context = JSON.parse(technicalContextStr);
    }
  } catch (e) {
    console.warn('Failed to parse technical context:', e);
  }

  setLoading(true);
  setStatus('Creating issue…', 'info');
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'createIssue',
      payload: {
        title,
        description,
        context,
        labels: defaultLabels
      }
    });

    if (response?.success) {
      const issue = response.issue;
      setStatus(`✅ Issue #${issue.number} created successfully!`, 'success');
      lastIssueEl.innerHTML = `<a href="${issue.html_url}" target="_blank" rel="noreferrer">🔗 View Issue #${issue.number}</a>`;
    } else {
      setStatus('❌ ' + (response?.error || 'Failed to create issue.'), 'error');
    }
  } catch (error) {
    setStatus('❌ ' + (error.message || 'Failed to create issue.'), 'error');
  } finally {
    setLoading(false);
  }
}

async function handleLiveSelect() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) {
      setStatus('❌ No active tab found.', 'error');
      return;
    }
    
    // Check if page supports content scripts
    if (tab.url && UNSUPPORTED_URL_PREFIXES.some(prefix => tab.url.startsWith(prefix))) {
      setStatus('❌ Live select is not supported on browser internal pages.', 'error');
      return;
    }
    
    // Try to communicate with content script, inject if needed
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'startLiveSelect' });
    } catch (error) {
      // Content script not responding, try to inject it
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        // Wait for the script to initialize
        await new Promise(resolve => setTimeout(resolve, SCRIPT_INITIALIZATION_DELAY));
        // Try sending the message again
        await chrome.tabs.sendMessage(tab.id, { type: 'startLiveSelect' });
      } catch (injectError) {
        console.error('Failed to inject content script:', injectError);
        throw new Error('Cannot start live select on this page. The page may restrict extensions.');
      }
    }
    
    // Close popup so user can see the page
    setStatus('🎯 Click on any element on the page...', 'info');
    window.close();
  } catch (error) {
    console.error('Live select error:', error);
    setStatus('❌ ' + (error.message || 'Failed to start live select.'), 'error');
  }
}

function buildDefaultTitle(context) {
  if (!context) {
    return '';
  }
  if (context.elementDescription) {
    return `Issue with ${context.elementDescription}`;
  }
  if (context.title) {
    return `Issue: ${context.title}`;
  }
  return `Issue for ${context.url}`;
}

function formatContextPreview(context) {
  const parts = [];
  
  if (context.elementDescription) {
    parts.push(`Selected: ${context.elementDescription}`);
  }
  
  parts.push(context.url);
  
  if (context.selectedText) {
    parts.push('\nSelection:\n' + truncate(context.selectedText));
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
  if (context.consoleLogs && Array.isArray(context.consoleLogs)) {
    if (context.consoleLogs.length > 0) {
      parts.push(`\n${context.consoleLogs.length} console log(s) captured.`);
    }
  }
  
  return parts.join('\n');
}

function truncate(value) {
  if (!value) {
    return '';
  }
  return value.length > 200 ? `${value.slice(0, 200)}…` : value;
}

function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = 'status ' + type;
  if (message) {
    statusEl.style.display = 'block';
  }
}

function setLoading(isLoading) {
  createButton.disabled = isLoading;
  createButton.textContent = isLoading ? '⏳ Creating…' : '✨ Create Issue';
  if (isLoading) {
    createButton.classList.add('loading');
  } else {
    createButton.classList.remove('loading');
  }
}
