const TOKEN_KEY = 'github_token';
const CONFIG_KEY = 'repo_config';
const LAST_CONTEXT_KEY = 'last_context';
const LAST_ISSUE_KEY = 'last_issue';
const CONTEXT_MENU_ID = 'create-github-issue';
const MAX_SNIPPET_LENGTH = 5 * 1024; // 5 KB

chrome.runtime.onInstalled.addListener(async () => {
  await ensureContextMenu();
  await seedDefaultConfig();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureContextMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) {
    return;
  }

  try {
    const context = await requestContextFromTab(tab.id);
    if (context?.error) {
      console.warn('Context capture reported an error:', context.error);
      return;
    }
    if (context) {
      await chrome.storage.local.set({ [LAST_CONTEXT_KEY]: context });
      try {
        await chrome.action.openPopup();
      } catch (popupError) {
        console.debug('Unable to open popup automatically:', popupError);
      }
    }
  } catch (error) {
    console.error('Failed to capture context from tab', error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case 'getConfig': {
        const config = await getRepoConfig();
        sendResponse({ success: true, config });
        break;
      }
      case 'saveConfig': {
        await saveRepoConfig(message.config);
        sendResponse({ success: true });
        break;
      }
      case 'getAuthState': {
        const token = await getStoredToken();
        sendResponse({
          success: true,
          authenticated: Boolean(token)
        });
        break;
      }
      case 'signIn': {
        try {
          const result = await signIn(message.token);
          sendResponse({ success: true, ...result });
        } catch (error) {
          console.error('Sign-in failed', error);
          sendResponse({ success: false, error: error.message || 'Sign-in failed' });
        }
        break;
      }
      case 'signOut': {
        await clearStoredToken();
        sendResponse({ success: true });
        break;
      }
      case 'createIssue': {
        try {
          const result = await createIssue(message.payload);
          sendResponse({ success: true, issue: result });
        } catch (error) {
          console.error('Issue creation failed', error);
          sendResponse({ success: false, error: error.message || 'Issue creation failed' });
        }
        break;
      }
      case 'getLastContext': {
        const data = await chrome.storage.local.get(LAST_CONTEXT_KEY);
        sendResponse({ success: true, context: data?.[LAST_CONTEXT_KEY] || null });
        break;
      }
      case 'clearLastContext': {
        await chrome.storage.local.remove(LAST_CONTEXT_KEY);
        sendResponse({ success: true });
        break;
      }
      case 'getLastIssue': {
        const data = await chrome.storage.local.get(LAST_ISSUE_KEY);
        sendResponse({ success: true, issue: data?.[LAST_ISSUE_KEY] || null });
        break;
      }
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  })();
  return true;
});

async function ensureContextMenu() {
  try {
    await chrome.contextMenus.remove(CONTEXT_MENU_ID);
  } catch (error) {
    // Ignore missing menu errors.
  }

  try {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Create GitHub Issue from Page/Selection',
      contexts: ['page', 'selection'],
      documentUrlPatterns: ['<all_urls>']
    });
  } catch (error) {
    console.error('Unable to create context menu', error);
  }
}

async function seedDefaultConfig() {
  const existing = await chrome.storage.sync.get(CONFIG_KEY);
  if (!existing || !existing[CONFIG_KEY]) {
    const config = {
      owner: '',
      repo: '',
      labels: []
    };
    await chrome.storage.sync.set({ [CONFIG_KEY]: config });
  }
}

async function getRepoConfig() {
  const data = await chrome.storage.sync.get(CONFIG_KEY);
  if (data && data[CONFIG_KEY]) {
    return data[CONFIG_KEY];
  }
  return {
    owner: '',
    repo: '',
    labels: []
  };
}

async function saveRepoConfig(config = {}) {
  const sanitized = {
    owner: config.owner || '',
    repo: config.repo || '',
    labels: Array.isArray(config.labels) ? config.labels.filter(Boolean) : []
  };
  await chrome.storage.sync.set({ [CONFIG_KEY]: sanitized });
}

async function getStoredToken() {
  const data = await chrome.storage.sync.get(TOKEN_KEY);
  return data?.[TOKEN_KEY] || null;
}

async function saveToken(token) {
  if (!token) {
    await clearStoredToken();
    return;
  }
  await chrome.storage.sync.set({ [TOKEN_KEY]: token });
}

async function clearStoredToken() {
  await chrome.storage.sync.remove(TOKEN_KEY);
}

async function validateToken(token) {
  if (!token) {
    return false;
  }
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    return response.ok;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
}

async function signIn(token) {
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new Error('Valid token is required.');
  }
  
  const trimmedToken = token.trim();
  const isValid = await validateToken(trimmedToken);
  
  if (!isValid) {
    throw new Error('Invalid token. Please check your Personal Access Token.');
  }
  
  await saveToken(trimmedToken);
  return { success: true };
}

async function createIssue(payload = {}) {
  const token = await getStoredToken();
  if (!token) {
    throw new Error('Authentication required. Please sign in with your Personal Access Token.');
  }

  const { owner, repo, labels } = await getRepoConfig();
  if (!owner || !repo) {
    throw new Error('Repository configuration is incomplete. Please configure owner and repo in settings.');
  }

  const title = payload.title?.trim();
  const body = truncateBody(payload.body || '');
  const requestLabels = Array.isArray(payload.labels) ? payload.labels : labels || [];

  if (!title) {
    throw new Error('Issue title is required.');
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({
      title,
      body,
      labels: requestLabels
    })
  });

  if (response.status === 401 || response.status === 403) {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining === '0') {
      throw new Error('GitHub rate limit exceeded. Please try again later.');
    }
    if (response.status === 401) {
      await clearStoredToken();
      throw new Error('Authentication expired or invalid. Please sign in again with a valid token.');
    }
  }

  if (!response.ok) {
    const errorBody = await safeParseJson(response);
    throw new Error(errorBody?.message || `GitHub responded with ${response.status}`);
  }

  const issue = await response.json();
  const summary = { html_url: issue.html_url, number: issue.number, title: issue.title };
  await chrome.storage.local.set({ [LAST_ISSUE_KEY]: summary });
  return summary;
}

function truncateBody(body) {
  if (!body) {
    return body;
  }
  if (body.length <= MAX_SNIPPET_LENGTH * 3) {
    return body;
  }
  return `${body.slice(0, MAX_SNIPPET_LENGTH * 3)}\n… (truncated)`;
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function requestContextFromTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'captureContext' });
  } catch (error) {
    console.error('Unable to retrieve context from tab', error);
    throw error;
  }
}
