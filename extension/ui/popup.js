let cachedContext = null;
let defaultLabels = [];

const statusEl = document.getElementById('status');
const titleInput = document.getElementById('title');
const bodyInput = document.getElementById('body');
const contextPreviewEl = document.getElementById('context-preview');
const lastIssueEl = document.getElementById('last-issue');
const createButton = document.getElementById('create');
const signInButton = document.getElementById('sign-in');
const signOutButton = document.getElementById('sign-out');
const clearContextButton = document.getElementById('clear-context');
const openOptionsLink = document.getElementById('open-options');

init();

function init() {
  document.getElementById('issue-form').addEventListener('submit', handleSubmit);
  signInButton.addEventListener('click', handleSignIn);
  signOutButton.addEventListener('click', handleSignOut);
  clearContextButton.addEventListener('click', handleClearContext);
  openOptionsLink.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  refresh();
}

async function refresh() {
  await Promise.all([refreshAuthState(), loadConfig(), loadContext(), loadLastIssue()]);
}

async function refreshAuthState(preserveMessage = false) {
  const response = await chrome.runtime.sendMessage({ type: 'getAuthState' });
  if (response?.success && response.authenticated) {
    if (!preserveMessage) {
      statusEl.textContent = 'Signed in.';
    }
    signInButton.disabled = true;
    signOutButton.disabled = false;
  } else {
    if (!preserveMessage) {
      statusEl.textContent = 'Not signed in.';
    }
    signInButton.disabled = false;
    signOutButton.disabled = true;
  }
}

async function loadConfig() {
  const response = await chrome.runtime.sendMessage({ type: 'getConfig' });
  if (response?.success) {
    defaultLabels = Array.isArray(response.config?.labels) ? response.config.labels : [];
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
    setStatus('Title is required.');
    return;
  }

  setLoading(true);
  setStatus('Creating issue…');
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
      setStatus(`Issue created: #${issue.number}`);
      lastIssueEl.innerHTML = `<a class="link" href="${issue.html_url}" target="_blank" rel="noreferrer">#${issue.number}</a>`;
    } else {
      setStatus(response?.error || 'Failed to create issue.');
    }
  } catch (error) {
    setStatus(error.message || 'Failed to create issue.');
  } finally {
    setLoading(false);
  }
}

async function handleSignIn() {
  setStatus('Signing in…');
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: 'signIn' });
    if (!response?.success) {
      setStatus(response?.error || 'Sign-in failed.');
    }
  } catch (error) {
    setStatus(error.message || 'Sign-in failed.');
    await refreshAuthState(true);
    return;
  }
  await refreshAuthState(!(response?.success));
}

async function handleSignOut() {
  await chrome.runtime.sendMessage({ type: 'signOut' });
  setStatus('Signed out.');
  await refreshAuthState(true);
}

async function handleClearContext() {
  await chrome.runtime.sendMessage({ type: 'clearLastContext' });
  cachedContext = null;
  contextPreviewEl.textContent = 'Context cleared.';
  bodyInput.value = '';
  titleInput.value = '';
  setStatus('Context cleared.');
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

function setStatus(message) {
  statusEl.textContent = message;
}

function setLoading(isLoading) {
  createButton.disabled = isLoading;
  createButton.textContent = isLoading ? 'Creating…' : 'Create issue';
}
