import { generateCodeVerifier, generateCodeChallenge } from './pkce.js';

const CLIENT_ID = 'CLIENT_ID';
const REDIRECT_URI = 'https://EXTENSION_ID.chromiumapp.org/';
const GITHUB_SCOPES = 'GITHUB_SCOPES';
const DEFAULT_OWNER = 'DEFAULT_OWNER';
const DEFAULT_REPO = 'DEFAULT_REPO';
const DEFAULT_LABELS = ['DEFAULT_LABELS'];

const TOKEN_KEY = 'github_token';
const CONFIG_KEY = 'repo_config';
const LAST_CONTEXT_KEY = 'last_context';
const LAST_ISSUE_KEY = 'last_issue';
const AUTH_PREFS_KEY = 'auth_preferences';
const ALLOWED_SCOPES = new Set(['public_repo', 'repo']);
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
        const preferences = await getAuthPreferences();
        sendResponse({
          success: true,
          authenticated: Boolean(token?.access_token),
          token: token
            ? {
                scope: token.scope,
                token_type: token.token_type,
                received_at: token.received_at,
                expires_at: token.expires_at
              }
            : null,
          scope: preferences.scope || getDefaultScope()
        });
        break;
      }
      case 'signIn': {
        try {
          const token = await signIn(message.scope);
          sendResponse({ success: true, token });
        } catch (error) {
          console.error('Sign-in failed', error);
          sendResponse({ success: false, error: error.message || 'Sign-in failed' });
        }
        break;
      }
      case 'getAuthPreferences': {
        const preferences = await getAuthPreferences();
        sendResponse({
          success: true,
          preferences,
          defaultScope: getDefaultScope()
        });
        break;
      }
      case 'saveAuthPreferences': {
        await saveAuthPreferences(message.preferences || {});
        sendResponse({ success: true });
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
      owner: DEFAULT_OWNER,
      repo: DEFAULT_REPO,
      labels: Array.isArray(DEFAULT_LABELS) ? DEFAULT_LABELS : []
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
    owner: DEFAULT_OWNER,
    repo: DEFAULT_REPO,
    labels: Array.isArray(DEFAULT_LABELS) ? DEFAULT_LABELS : []
  };
}

async function saveRepoConfig(config = {}) {
  const sanitized = {
    owner: config.owner || DEFAULT_OWNER,
    repo: config.repo || DEFAULT_REPO,
    labels: Array.isArray(config.labels)
      ? config.labels.filter(Boolean)
      : Array.isArray(DEFAULT_LABELS)
      ? DEFAULT_LABELS
      : []
  };
  await chrome.storage.sync.set({ [CONFIG_KEY]: sanitized });
}

async function getStoredToken() {
  const data = await chrome.storage.sync.get(TOKEN_KEY);
  return data?.[TOKEN_KEY] || null;
}

async function clearStoredToken() {
  await chrome.storage.sync.remove(TOKEN_KEY);
}

async function getAuthPreferences() {
  const data = await chrome.storage.sync.get(AUTH_PREFS_KEY);
  const prefs = data?.[AUTH_PREFS_KEY];
  const scope = sanitizeScope(prefs?.scope);
  return scope ? { scope } : { scope: null };
}

async function saveAuthPreferences(preferences = {}) {
  const scope = sanitizeScope(preferences.scope);
  if (scope) {
    await chrome.storage.sync.set({ [AUTH_PREFS_KEY]: { scope } });
  } else {
    await chrome.storage.sync.remove(AUTH_PREFS_KEY);
  }
}

async function signIn(scopeOverride) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  const preferences = await getAuthPreferences();
  const scope =
    sanitizeScope(scopeOverride) ||
    preferences.scope ||
    getDefaultScope();

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);

  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true
  });

  if (!redirectUrl) {
    throw new Error('Authorization flow was cancelled.');
  }

  const redirected = new URL(redirectUrl);
  const code = redirected.searchParams.get('code');
  const returnedState = redirected.searchParams.get('state');
  const authError = redirected.searchParams.get('error');
  const authErrorDescription = redirected.searchParams.get('error_description');

  if (authError) {
    throw new Error(authErrorDescription || authError);
  }

  if (!code) {
    throw new Error('Authorization code missing in redirect URL.');
  }

  if (returnedState !== state) {
    throw new Error('State parameter mismatch.');
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json'
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: codeVerifier
    })
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed (${tokenResponse.status})`);
  }

  const tokenData = await tokenResponse.json();
  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }

  const storedToken = {
    access_token: tokenData.access_token,
    scope: tokenData.scope,
    token_type: tokenData.token_type,
    expires_in: tokenData.expires_in,
    refresh_token: tokenData.refresh_token,
    received_at: Date.now(),
    expires_at: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined
  };

  await saveAuthPreferences({ scope });
  await chrome.storage.sync.set({ [TOKEN_KEY]: storedToken });
  return storedToken;
}

async function createIssue(payload = {}) {
  const token = await getStoredToken();
  if (!token?.access_token) {
    throw new Error('Authentication required. Please sign in.');
  }

  const { owner, repo, labels } = await getRepoConfig();
  if (!owner || !repo) {
    throw new Error('Repository configuration is incomplete.');
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
      Authorization: `Bearer ${token.access_token}`,
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
      throw new Error('Authentication expired. Please sign in again.');
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

function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sanitizeScope(scope) {
  if (typeof scope !== 'string') {
    return null;
  }
  const trimmed = scope.trim();
  if (!trimmed || trimmed === 'GITHUB_SCOPES') {
    return null;
  }
  if (ALLOWED_SCOPES.has(trimmed)) {
    return trimmed;
  }
  return null;
}

function getDefaultScope() {
  const sanitized = sanitizeScope(GITHUB_SCOPES);
  if (!sanitized) {
    return 'public_repo';
  }
  return sanitized;
}
