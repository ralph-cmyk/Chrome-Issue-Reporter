const TOKEN_KEY = 'github_token';
const CONFIG_KEY = 'repo_config';
const OAUTH_CONFIG_KEY = 'oauth_config';
const LAST_CONTEXT_KEY = 'last_context';
const LAST_ISSUE_KEY = 'last_issue';
const CONTEXT_MENU_ID = 'create-github-issue';
const MAX_SNIPPET_LENGTH = 5 * 1024; // 5 KB

// GitHub Device Flow Configuration
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
// DEPRECATED: Client ID is now configured by the user in options
// This is kept as a fallback but should not be used
const GITHUB_CLIENT_ID_FALLBACK = 'Ov23liJyiD9bKVNz2X2w';

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
      case 'getOAuthConfig': {
        const config = await getOAuthConfig();
        sendResponse({ success: true, config });
        break;
      }
      case 'saveOAuthConfig': {
        await saveOAuthConfig(message.config);
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
      case 'startDeviceFlow': {
        try {
          const result = await startDeviceFlow(message.scopes || 'repo');
          sendResponse({ success: true, ...result });
        } catch (error) {
          console.error('Device flow failed', error);
          sendResponse({ success: false, error: error.message || 'Device flow failed' });
        }
        break;
      }
      case 'pollDeviceToken': {
        try {
          const result = await pollForDeviceToken(message.deviceCode, message.interval);
          sendResponse({ success: true, ...result });
        } catch (error) {
          console.error('Token polling failed', error);
          sendResponse({ success: false, error: error.message || 'Token polling failed' });
        }
        break;
      }
      case 'fetchRepos': {
        try {
          const repos = await fetchUserRepos();
          sendResponse({ success: true, repos });
        } catch (error) {
          console.error('Failed to fetch repos', error);
          sendResponse({ success: false, error: error.message || 'Failed to fetch repositories' });
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

async function getOAuthConfig() {
  const data = await chrome.storage.sync.get(OAUTH_CONFIG_KEY);
  if (data && data[OAUTH_CONFIG_KEY]) {
    return data[OAUTH_CONFIG_KEY];
  }
  return {
    clientId: '',
    clientSecret: ''
  };
}

async function saveOAuthConfig(config = {}) {
  const sanitized = {
    clientId: config.clientId || '',
    clientSecret: config.clientSecret || ''
  };
  await chrome.storage.sync.set({ [OAUTH_CONFIG_KEY]: sanitized });
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

async function startDeviceFlow(scopes = 'repo') {
  try {
    // Get the user-configured OAuth client ID
    const oauthConfig = await getOAuthConfig();
    const clientId = oauthConfig.clientId || GITHUB_CLIENT_ID_FALLBACK;
    
    if (!oauthConfig.clientId) {
      throw new Error(
        'OAuth Client ID not configured!\n\n' +
        'Please configure your GitHub OAuth App Client ID in the extension options before signing in.\n\n' +
        'Steps:\n' +
        '1. Go to https://github.com/settings/developers\n' +
        '2. Create a new OAuth App (or use existing)\n' +
        '3. Enable Device Flow in the OAuth App settings\n' +
        '4. Copy the Client ID\n' +
        '5. Enter it in the extension options\n' +
        '6. Save and try again\n\n' +
        'See SETUP-DEVICE-FLOW.md for detailed instructions.'
      );
    }
    
    // Step 1: Request device and user codes
    const deviceCodeResponse = await fetch(GITHUB_DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        scope: scopes
      })
    });
    
    if (!deviceCodeResponse.ok) {
      const errorData = await safeParseJson(deviceCodeResponse);
      
      // Provide helpful error message for 404 (most common issue)
      if (deviceCodeResponse.status === 404) {
        const setupUrl = 'https://github.com/settings/developers';
        throw new Error(
          `OAuth App not configured correctly!\n\n` +
          `Common causes:\n` +
          `1. Device Flow is not enabled in your GitHub OAuth App\n` +
          `2. The Client ID in background.js is incorrect\n` +
          `3. The OAuth App doesn't exist\n\n` +
          `To fix:\n` +
          `1. Go to ${setupUrl}\n` +
          `2. Open your OAuth App settings\n` +
          `3. Enable "Device Flow" checkbox\n` +
          `4. Update GITHUB_CLIENT_ID in background.js\n` +
          `5. Reload the extension\n\n` +
          `See INSTALL.md for detailed instructions.`
        );
      }
      
      const errorMessage = errorData?.error_description || errorData?.message || 
                          `Failed to initiate device flow (status: ${deviceCodeResponse.status})`;
      throw new Error(errorMessage);
    }
    
    const deviceData = await deviceCodeResponse.json();
    
    if (deviceData.error) {
      throw new Error(deviceData.error_description || deviceData.error);
    }
    
    // Return device code data to show to user
    return {
      device_code: deviceData.device_code,
      user_code: deviceData.user_code,
      verification_uri: deviceData.verification_uri,
      expires_in: deviceData.expires_in,
      interval: deviceData.interval || 5
    };
  } catch (error) {
    console.error('Device flow initiation failed:', error);
    throw error;
  }
}

async function pollForDeviceToken(deviceCode, interval = 5) {
  const maxAttempts = 60; // 5 minutes with 5 second intervals
  let attempts = 0;
  
  // Get the user-configured OAuth client ID
  const oauthConfig = await getOAuthConfig();
  const clientId = oauthConfig.clientId || GITHUB_CLIENT_ID_FALLBACK;
  
  while (attempts < maxAttempts) {
    await sleep(interval * 1000);
    attempts++;
    
    try {
      const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      
      const data = await safeParseJson(response);
      
      if (!response.ok && !data) {
        // Network or parsing error - continue polling
        console.warn('Token request failed, retrying...', response.status);
        continue;
      }
      
      if (data && data.error) {
        // Check for specific error types
        if (data.error === 'authorization_pending') {
          // User hasn't completed authorization yet, continue polling
          continue;
        } else if (data.error === 'slow_down') {
          // GitHub is asking us to slow down, increase interval
          interval += 5;
          continue;
        } else if (data.error === 'expired_token') {
          throw new Error('The device code has expired. Please try signing in again.');
        } else if (data.error === 'access_denied') {
          throw new Error('Authorization was denied. Please try again if this was a mistake.');
        } else {
          throw new Error(data.error_description || data.error);
        }
      }
      
      if (data && data.access_token) {
        // Success! Save the token
        await saveToken(data.access_token);
        return { success: true, token: data.access_token };
      }
    } catch (error) {
      // If it's a known error (expired, denied, etc.), throw it immediately
      if (error.message && (
        error.message.includes('expired') ||
        error.message.includes('denied') ||
        error.message.includes('error_description')
      )) {
        throw error;
      }
      
      // For other errors, continue polling unless we've hit max attempts
      if (attempts >= maxAttempts) {
        throw new Error('Timeout waiting for authorization. Please try again.');
      }
      console.warn('Polling attempt failed, retrying...', error.message);
    }
  }
  
  throw new Error('Timeout waiting for authorization. Please try again.');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchUserRepos() {
  const token = await getStoredToken();
  if (!token) {
    throw new Error('Authentication required.');
  }
  
  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        await clearStoredToken();
        throw new Error('Authentication expired. Please sign in again.');
      }
      throw new Error(`Failed to fetch repositories: ${response.status}`);
    }
    
    const repos = await response.json();
    return repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      permissions: repo.permissions
    }));
  } catch (error) {
    console.error('Error fetching repos:', error);
    throw error;
  }
}

async function createIssue(payload = {}) {
  const token = await getStoredToken();
  if (!token) {
    throw new Error('Authentication required. Please sign in with GitHub.');
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
