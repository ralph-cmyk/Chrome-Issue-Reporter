let cachedContext = null;
let defaultLabels = [];

const statusEl = document.getElementById('status');
const titleInput = document.getElementById('title');
const bodyInput = document.getElementById('body');
const contextPreviewEl = document.getElementById('context-preview');
const lastIssueEl = document.getElementById('last-issue');
const createButton = document.getElementById('create');
const clearContextButton = document.getElementById('clear-context');
const openOptionsLink = document.getElementById('open-options');

init();

function init() {
  document.getElementById('issue-form').addEventListener('submit', handleSubmit);
  clearContextButton.addEventListener('click', handleClearContext);
  openOptionsLink.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
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
  const authStatusEl = document.getElementById('auth-status');
  
  if (response?.success && response.authenticated) {
    if (!preserveMessage) {
      setStatus('Ready to create issues.', 'info');
    }
    authStatusEl.innerHTML = '<span class="badge success">✅ Authenticated</span>';
  } else {
    if (!preserveMessage) {
      setStatus('Not authenticated. Configure in settings.', 'error');
    }
    authStatusEl.innerHTML = '<span class="badge warning">⚠️ Not authenticated</span>';
  }
}

async function loadConfig() {
  const response = await chrome.runtime.sendMessage({ type: 'getConfig' });
  const repoStatusEl = document.getElementById('repo-status');
  
  if (response?.success) {
    defaultLabels = Array.isArray(response.config?.labels) ? response.config.labels : [];
    
    if (response.config?.owner && response.config?.repo) {
      repoStatusEl.innerHTML = `<span class="badge success">📂 ${response.config.owner}/${response.config.repo}</span>`;
    } else {
      repoStatusEl.innerHTML = '<span class="badge warning">⚠️ Repository not configured</span>';
    }
  }
}

async function loadContext() {
  const response = await chrome.runtime.sendMessage({ type: 'getLastContext' });
  if (response?.success && response.context) {
    cachedContext = response.context;
    contextPreviewEl.textContent = formatContextPreview(cachedContext);
    if (!titleInput.value) {
      titleInput.value = buildDefaultTitle(cachedContext);
    }
    if (!bodyInput.value) {
      bodyInput.value = buildIssueBody(cachedContext);
    }
  } else {
    cachedContext = null;
    contextPreviewEl.textContent = 'No captured context yet. Use the context menu to collect details.';
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
  const body = bodyInput.value;
  if (!title) {
    setStatus('Title is required.', 'error');
    return;
  }

  setLoading(true);
  setStatus('Creating issue…', 'info');
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'createIssue',
      payload: {
        title,
        body,
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

async function handleClearContext() {
  await chrome.runtime.sendMessage({ type: 'clearLastContext' });
  cachedContext = null;
  contextPreviewEl.textContent = 'Context cleared.';
  bodyInput.value = '';
  titleInput.value = '';
  setStatus('🗑️ Context cleared.', 'info');
}

function buildDefaultTitle(context) {
  if (!context) {
    return '';
  }
  if (context.title) {
    return `Issue: ${context.title}`;
  }
  return `Issue for ${context.url}`;
}

function buildIssueBody(context) {
  if (!context) {
    return '';
  }
  const lines = [];
  lines.push(`**URL:** ${context.url || 'N/A'}`);
  lines.push(`**User Agent:** ${context.userAgent || 'N/A'}`);
  lines.push('');
  lines.push('**Selection:**');
  lines.push(context.selectedText ? context.selectedText : '_None_');
  lines.push('');
  lines.push('HTML:');
  lines.push('```html');
  lines.push(context.htmlSnippet ? context.htmlSnippet : '');
  lines.push('```');
  lines.push('');
  lines.push('JS:');
  lines.push('```javascript');
  lines.push(context.scriptSnippet ? context.scriptSnippet : '');
  lines.push('```');
  if (context.jsError) {
    lines.push('');
    lines.push('**Last JS Error:**');
    lines.push('```');
    lines.push(`${context.jsError.message || 'Unknown error'}`);
    if (context.jsError.source) {
      lines.push(`Source: ${context.jsError.source}:${context.jsError.line || 0}:${context.jsError.column || 0}`);
    }
    lines.push('Timestamp: ' + new Date(context.jsError.timestamp).toISOString());
    lines.push('```');
  }
  return lines.join('\n');
}

function formatContextPreview(context) {
  const parts = [];
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
