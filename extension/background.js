// Import sanitization utility
import { buildSanitizedIssue } from './sanitizer.js';

const TOKEN_KEY = 'github_token';
const CONFIG_KEY = 'repo_config';
const LAST_CONTEXT_KEY = 'last_context';
const LAST_ISSUE_KEY = 'last_issue';
const CONTEXT_MENU_ID = 'create-github-issue';
const MAX_SNIPPET_LENGTH = 5 * 1024; // 5 KB
const SCRIPT_INITIALIZATION_DELAY = 100; // ms to wait for content script to initialize
const LAST_MILESTONE_KEY = 'last_milestone';
const LAST_COLUMN_KEY = 'last_column';
const UNSUPPORTED_URL_PREFIXES = ['chrome://', 'chrome-extension://', 'edge://', 'about:'];
// R2 has no practical size limit, but we'll keep a reasonable max for performance
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024; // 10 MB (increased from 20KB for R2)
const MAX_SCREENSHOT_DATA_URL_LENGTH = 32000; // Still limit data URL size for memory
const MAX_OUTPUT_DIMENSION = 1920; // Increased from 320px for better quality
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const DEFAULT_DEVICE_FLOW_CLIENT_ID = 'Ov23liZ5WHrt9Wf9FcLN';

// Cloudflare R2 Configuration
// These can be configured via chrome.storage.sync (R2_CONFIG_KEY) or hardcoded below
// Recommended: Use Cloudflare Worker proxy (workerProxyUrl) for secure uploads
const R2_CONFIG_KEY = 'r2_config';
const DEFAULT_R2_WORKER_PROXY_URL = ''; // Recommended: Cloudflare Worker proxy URL
const DEFAULT_R2_ENDPOINT = ''; // Alternative: Direct R2 endpoint (less secure)
const DEFAULT_R2_BUCKET_NAME = 'chrome-issue-reporter-screenshots'; // R2 bucket name
const DEFAULT_R2_PUBLIC_URL = 'https://pub-6aff29174a263fec1dd8515745970ba3.r2.dev'; // Public URL for accessing uploaded files

// GitHub OAuth Configuration
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

chrome.runtime.onInstalled.addListener(async () => {
  await ensureContextMenu();
  await seedDefaultConfig();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureContextMenu();
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) {
    return;
  }

  try {
    const ready = await ensureReadyForIssueCreation(tab);
    if (!ready) {
      return;
    }
    await ensureContentScript(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: 'startIssueFlow' });
  } catch (error) {
    console.error('Failed to start issue flow from action click', error);
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'issueFlowError',
        message: error.message || 'Unable to start issue capture on this page.'
      });
    } catch {
      // No-op if tab cannot be messaged
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) {
    return;
  }

  try {
    const ready = await ensureReadyForIssueCreation(tab);
    if (!ready) {
      return;
    }
    const context = await requestContextFromTab(tab.id);
    if (context?.error) {
      console.warn('Context capture reported an error:', context.error);
      return;
    }
    if (context) {
      await chrome.storage.local.set({ [LAST_CONTEXT_KEY]: context });
      
      // Capture full-page screenshot for context menu flow
      let screenshotDataUrl = null;
      let screenshotError = null;
      try {
        const screenshotResult = await captureElementScreenshot(tab.id, tab.windowId, null);
        if (screenshotResult && typeof screenshotResult === 'object' && 'error' in screenshotResult) {
          screenshotError = screenshotResult.error;
          console.warn('Screenshot capture error:', screenshotError);
        } else if (screenshotResult) {
          screenshotDataUrl = screenshotResult;
        }
      } catch (error) {
        screenshotError = error.message || 'Unknown screenshot capture error';
        console.warn('Unable to capture screenshot from context menu', error);
      }
      
      await ensureContentScript(tab.id);
      const payload = await buildIssueModalPayload(context, screenshotDataUrl, screenshotError);
      await chrome.tabs.sendMessage(tab.id, {
        type: 'showIssueModal',
        payload
      });
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
      case 'getR2Config': {
        const config = await getR2Config();
        sendResponse({ success: true, config });
        break;
      }
      case 'saveR2Config': {
        await chrome.storage.sync.set({ [R2_CONFIG_KEY]: message.config });
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
      case 'getMilestones': {
        try {
          const milestones = await fetchRepoMilestones();
          sendResponse({ success: true, milestones });
        } catch (error) {
          console.error('Failed to fetch milestones', error);
          sendResponse({ success: false, error: error.message || 'Failed to fetch milestones' });
        }
        break;
      }
      case 'getProjects': {
        try {
          const projects = await fetchRepoProjects();
          sendResponse({ success: true, projects });
        } catch (error) {
          console.error('Failed to fetch projects', error);
          sendResponse({ success: false, error: error.message || 'Failed to fetch projects' });
        }
        break;
      }
      case 'getProjectColumns': {
        try {
          if (typeof message.projectId !== 'string') {
            throw new Error('Project id is required to load columns.');
          }
          const columns = await fetchProjectColumns(message.projectId);
          sendResponse({ success: true, columns });
        } catch (error) {
          console.error('Failed to fetch project columns', error);
          sendResponse({ success: false, error: error.message || 'Failed to fetch project columns' });
        }
        break;
      }
      case 'getSelectionPreferences': {
        try {
          const preferences = await getSelectionPreferences();
          sendResponse({ success: true, preferences });
        } catch (error) {
          console.error('Failed to load selection preferences', error);
          sendResponse({ success: false, error: error.message || 'Failed to load preferences' });
        }
        break;
      }
      case 'saveSelectionPreferences': {
        try {
          await saveSelectionPreferences(message.preferences || {});
          sendResponse({ success: true });
        } catch (error) {
          console.error('Failed to save selection preferences', error);
          sendResponse({ success: false, error: error.message || 'Failed to save preferences' });
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
          sendResponse({ 
            success: true, 
            issue: result,
            screenshotAttached: result.screenshotAttached || false
          });
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
      case 'liveSelectComplete': {
        const tabId = sender?.tab?.id;
        if (!tabId) {
          sendResponse({ success: false, error: 'Missing tab context for live select.' });
          break;
        }

        const context = message.context || null;
        if (!context) {
          sendResponse({ success: false, error: 'No context captured from selection.' });
          break;
        }

        await chrome.storage.local.set({ [LAST_CONTEXT_KEY]: context });

        let screenshotDataUrl = null;
        let screenshotError = null;
        try {
          const screenshotResult = await captureElementScreenshot(tabId, sender.tab.windowId, message.selection || null);
          if (screenshotResult && typeof screenshotResult === 'object' && 'error' in screenshotResult) {
            screenshotError = screenshotResult.error;
            console.warn('Screenshot capture error:', screenshotError);
          } else if (screenshotResult) {
            screenshotDataUrl = screenshotResult;
          }
        } catch (error) {
          screenshotError = error.message || 'Unknown screenshot capture error';
          console.warn('Unable to capture screenshot for selection', error);
        }

        try {
          const payload = await buildIssueModalPayload(context, screenshotDataUrl);
          if (screenshotError) {
            payload.screenshotError = screenshotError;
          }
          await chrome.tabs.sendMessage(tabId, {
            type: 'showIssueModal',
            payload,
            fromLiveSelect: true
          });
        } catch (error) {
          console.error('Failed to show issue modal after live select', error);
          sendResponse({ success: false, error: error.message || 'Failed to open issue modal.' });
          break;
        }

        sendResponse({ 
          success: true, 
          screenshotCaptured: Boolean(screenshotDataUrl),
          screenshotError: screenshotError || null
        });
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

async function startDeviceFlow(scopes = 'repo') {
  try {
    const storedConfig = await chrome.storage.sync.get('oauth_config');
    const configuredClientId = storedConfig?.oauth_config?.clientId;
    const clientId = configuredClientId || DEFAULT_DEVICE_FLOW_CLIENT_ID;
    
    if (!clientId) {
      throw new Error(
        'GitHub OAuth Client ID missing. Please configure it in the extension settings.'
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
          `1. The Client ID is incorrect\n` +
          `2. The OAuth App doesn't exist\n\n` +
          `To fix:\n` +
          `1. Go to ${setupUrl}\n` +
          `2. Open your OAuth App settings\n` +
          `3. Update Client ID in the extension options\n` +
          `4. Reload the extension\n\n` +
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
  
  const storedConfig = await chrome.storage.sync.get('oauth_config');
  const configuredClientId = storedConfig?.oauth_config?.clientId;
  const clientId = configuredClientId || DEFAULT_DEVICE_FLOW_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('OAuth Client ID not configured');
  }
  
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
      throw new Error('Authentication expired. Please sign in again from the extension options.');
    }
    if (response.status === 403) {
      throw new Error('Access denied. Please check your GitHub token permissions.');
    }
    throw new Error(`Failed to fetch repositories (HTTP ${response.status}). Please try again later.`);
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

  const userInput = {
    title: payload.title?.trim() || '',
    description: payload.description?.trim() || ''
  };

  const context = payload.context || {};
  const screenshotDataUrl = typeof payload.screenshotDataUrl === 'string' ? payload.screenshotDataUrl : null;
  const milestoneNumber = typeof payload.milestoneNumber === 'number' ? payload.milestoneNumber : null;
  const projectId = typeof payload.projectId === 'string' ? payload.projectId : null;
  const projectFieldId = typeof payload.projectFieldId === 'string' ? payload.projectFieldId : null;
  const projectOptionId = typeof payload.projectOptionId === 'string' ? payload.projectOptionId : null;

  const sanitized = buildSanitizedIssue(context, userInput);
  let issueBody = sanitized.body;
  const bodySize = sanitized.size;

  if (bodySize >= 64 * 1024) {
    throw new Error(`Issue body is ${Math.round(bodySize / 1024)}KB, which exceeds GitHub's 65KB limit. Please shorten your description or capture a smaller page element.`);
  } else if (bodySize >= 55 * 1024) {
    console.warn('Issue body approaching GitHub size limit:', bodySize);
  }

  const requestLabels = Array.isArray(payload.labels) ? payload.labels : labels || [];

  if (!sanitized.title) {
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
      title: sanitized.title,
      body: issueBody,
      labels: requestLabels,
      milestone: milestoneNumber || undefined
    })
  });

  if (response.status === 401 || response.status === 403) {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining === '0') {
      throw new Error('GitHub rate limit exceeded. Please wait a few minutes and try again.');
    }
    if (response.status === 401) {
      await clearStoredToken();
      throw new Error('Authentication expired. Please sign in again from the extension options.');
    }
    if (response.status === 403) {
      throw new Error('Access denied. Please check that your GitHub token has permission to create issues in this repository.');
    }
  }

  if (!response.ok) {
    const errorBody = await safeParseJson(response);
    const errorMsg = errorBody?.message || `GitHub API error (HTTP ${response.status})`;
    
    // Provide more helpful error messages
    if (errorMsg.includes('not found')) {
      throw new Error('Repository not found. Please check that the repository name and owner are correct in extension options.');
    } else if (errorMsg.includes('permission')) {
      throw new Error('Permission denied. Please ensure your GitHub token has access to create issues in this repository.');
    }
    
    throw new Error(errorMsg);
  }

  const issue = await response.json();
  let screenshotAttachmentUrl = null;

  if (projectId) {
    try {
      await addIssueToProjectV2({
        projectId,
        contentNodeId: issue.node_id,
        statusFieldId: projectFieldId,
        statusOptionId: projectOptionId
      });
    } catch (error) {
      console.warn('Failed to add issue to project', error);
    }
  }

  let screenshotAttached = false;
  let screenshotUploadError = null;
  if (screenshotDataUrl) {
    try {
      const attachment = await uploadIssueAttachment({
        owner,
        repo,
        issueNumber: issue.number,
        dataUrl: screenshotDataUrl,
        token
      });
      screenshotAttachmentUrl = attachment?.url || attachment?.download_url || null;
      if (screenshotAttachmentUrl) {
        const augmentedBody = `${issueBody}\n\n![Screenshot](${screenshotAttachmentUrl})`;
        await patchIssueBody(owner, repo, issue.number, augmentedBody, token);
        issueBody = augmentedBody;
        screenshotAttached = true;
      }
    } catch (error) {
      console.error('Screenshot upload to R2 failed', error);
      screenshotUploadError = error.message || 'Unknown upload error';
      // Issue is still created, but without screenshot
      // Don't throw - let issue creation succeed, but notify user
    }
  }

  const summary = { 
    html_url: issue.html_url, 
    number: issue.number, 
    title: issue.title,
    screenshotAttached,
    screenshotUploadError: screenshotUploadError || null
  };
  await chrome.storage.local.set({ [LAST_ISSUE_KEY]: summary });

  try {
    await saveSelectionPreferences({
      milestoneNumber,
      projectId,
      statusFieldId: projectFieldId,
      statusOptionId: projectOptionId
    });
  } catch (error) {
    console.debug('Unable to persist selection preferences', error);
  }

  return summary;
}

async function ensureReadyForIssueCreation(tab) {
  const token = await getStoredToken();
  const config = await getRepoConfig();

  const isConfigured = Boolean(token) && Boolean(config.owner) && Boolean(config.repo);
  if (!isConfigured) {
    await chrome.runtime.openOptionsPage();
    return false;
  }

  if (tab?.url && UNSUPPORTED_URL_PREFIXES.some(prefix => tab.url.startsWith(prefix))) {
    throw new Error('This extension is not available on browser internal pages (chrome://, chrome-extension://, etc.). Please use it on a regular web page.');
  }

  return true;
}

async function ensureContentScript(tabId) {
  // First, try to ping existing content script
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    if (ping?.success) {
      return;
    }
  } catch (error) {
    // Content script not present, will inject below
  }

  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (error) {
    console.error('Failed to inject content script', error);
    throw new Error('Unable to inject content script. The page may not support extensions.');
  }

  // Wait for content script to initialize with exponential backoff
  const maxRetries = 3;
  const baseDelay = 100; // Start with 100ms
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const delay = baseDelay * Math.pow(2, attempt); // 100ms, 200ms, 400ms
    await sleep(delay);

    try {
      const ping = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
      if (ping?.success) {
        return; // Success!
      }
    } catch (error) {
      // Not ready yet, continue to next attempt
      if (attempt === maxRetries - 1) {
        // Last attempt failed
        console.error('Content script did not respond after retries', error);
        throw new Error('Content script initialization failed. The page may not support extensions or may be loading. Please try again.');
      }
    }
  }

  // Should not reach here, but just in case
  throw new Error('Content script initialization timeout. Please try again.');
}

async function buildIssueModalPayload(context, screenshotDataUrl, screenshotError = null) {
  const config = await getRepoConfig();
  const preferences = await getSelectionPreferences();
  const lastIssueData = await chrome.storage.local.get(LAST_ISSUE_KEY);

  return {
    context,
    screenshotDataUrl,
    screenshotError,
    repo: config?.owner && config?.repo
      ? { owner: config.owner, name: config.repo }
      : null,
    preferences,
    lastIssue: lastIssueData?.[LAST_ISSUE_KEY] || null
  };
}

async function captureElementScreenshot(tabId, windowId, selection) {
  let baseDataUrl;
  let captureError = null;
  
  try {
    baseDataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  } catch (error) {
    captureError = error;
    console.warn('captureVisibleTab failed', error);
    // If captureVisibleTab fails, try alternative: get tab and capture
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab?.windowId) {
        baseDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        captureError = null; // Success on fallback
      } else {
        return { error: 'Unable to capture screenshot: Tab window not available' };
      }
    } catch (fallbackError) {
      console.warn('Fallback screenshot capture also failed', fallbackError);
      return { error: 'Unable to capture screenshot: Both primary and fallback methods failed' };
    }
  }

  if (captureError || !baseDataUrl) {
    return { error: captureError?.message || 'Screenshot capture failed' };
  }

  // If no selection provided, compress and return full page screenshot
  if (!selection?.rect) {
    const result = await compressFullPageScreenshot(baseDataUrl);
    if (!result) {
      return { error: 'Failed to process full page screenshot' };
    }
    return result;
  }

  const { rect, devicePixelRatio } = selection;
  const scale = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const cropWidth = Math.max(1, Math.round(rect.width * scale));
  const cropHeight = Math.max(1, Math.round(rect.height * scale));

  if (cropWidth < 2 || cropHeight < 2) {
    // Too small to crop, return full screenshot
    const result = await compressFullPageScreenshot(baseDataUrl);
    if (result && typeof result === 'object' && 'error' in result) {
      return result;
    }
    return result || baseDataUrl;
  }

  try {
    const response = await fetch(baseDataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    let outputWidth = cropWidth;
    let outputHeight = cropHeight;
    if (outputWidth > MAX_OUTPUT_DIMENSION || outputHeight > MAX_OUTPUT_DIMENSION) {
      const scaleFactor = Math.min(
        MAX_OUTPUT_DIMENSION / outputWidth,
        MAX_OUTPUT_DIMENSION / outputHeight
      );
      outputWidth = Math.max(1, Math.round(outputWidth * scaleFactor));
      outputHeight = Math.max(1, Math.round(outputHeight * scaleFactor));
    }

    const canvas = new OffscreenCanvas(outputWidth, outputHeight);
    const ctx = canvas.getContext('2d');
    const sx = Math.max(0, Math.min(bitmap.width - cropWidth, Math.round(rect.left * scale)));
    const sy = Math.max(0, Math.min(bitmap.height - cropHeight, Math.round(rect.top * scale)));

    ctx.drawImage(bitmap, sx, sy, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
    // Improved quality levels for R2 (no size restrictions)
    const qualityLevels = [0.9, 0.8, 0.7, 0.6];
    let croppedBlob = null;

    for (const quality of qualityLevels) {
      const blobCandidate = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      if (blobCandidate.size <= MAX_SCREENSHOT_BYTES || quality === qualityLevels[qualityLevels.length - 1]) {
        croppedBlob = blobCandidate;
        break;
      }
    }

    if (!croppedBlob) {
      return { error: 'Failed to process screenshot: Unable to create image blob' };
    }

    // For R2 upload, we can use the blob directly instead of converting to data URL
    // This avoids data URL size limits and is more efficient
    // However, we need to convert to data URL for now since the upload function expects it
    // TODO: Refactor to pass blob directly to upload function
    
    const buffer = await croppedBlob.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    
    // R2 can handle larger files, so we don't need strict size limits
    // But we still check data URL length for memory reasons
    if ((croppedBlob.size || buffer.byteLength) > MAX_SCREENSHOT_BYTES) {
      console.warn('Screenshot is large but will be uploaded to R2');
    }

    const dataUrl = `data:image/jpeg;base64,${base64}`;
    if (dataUrl.length > MAX_SCREENSHOT_DATA_URL_LENGTH) {
      // For very large screenshots, we might need to use blob directly
      // For now, return error suggesting to capture a smaller area
      return { error: 'Screenshot is too large. Please capture a smaller area or use the full page screenshot option.' };
    }

    return dataUrl;
  } catch (error) {
    console.warn('Unable to crop screenshot to selection', error);
    return { error: `Failed to process screenshot: ${error.message}` };
  }
}

async function compressFullPageScreenshot(dataUrl) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // Resize to max dimension while maintaining aspect ratio
    // Use same max dimension as element screenshots for consistency
    let outputWidth = bitmap.width;
    let outputHeight = bitmap.height;
    
    if (outputWidth > MAX_OUTPUT_DIMENSION || outputHeight > MAX_OUTPUT_DIMENSION) {
      const scaleFactor = Math.min(
        MAX_OUTPUT_DIMENSION / outputWidth,
        MAX_OUTPUT_DIMENSION / outputHeight
      );
      outputWidth = Math.max(1, Math.round(outputWidth * scaleFactor));
      outputHeight = Math.max(1, Math.round(outputHeight * scaleFactor));
    }

    const canvas = new OffscreenCanvas(outputWidth, outputHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, outputWidth, outputHeight);
    
    // High quality for R2 (no strict size limits)
    const qualityLevels = [0.9, 0.85, 0.8];
    let croppedBlob = null;

    for (const quality of qualityLevels) {
      const blobCandidate = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      // R2 can handle larger files, but we'll still cap at 10MB for performance
      if (blobCandidate.size <= MAX_SCREENSHOT_BYTES || quality === qualityLevels[qualityLevels.length - 1]) {
        croppedBlob = blobCandidate;
        break;
      }
    }

    if (!croppedBlob) {
      return { error: 'Failed to compress full page screenshot' };
    }
    
    // R2 can handle larger files, so we don't strictly enforce size limits
    if (croppedBlob.size > MAX_SCREENSHOT_BYTES) {
      console.warn('Full page screenshot is large but will be uploaded to R2');
    }

    const buffer = await croppedBlob.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const dataUrlResult = `data:image/jpeg;base64,${base64}`;
    
    if (dataUrlResult.length > MAX_SCREENSHOT_DATA_URL_LENGTH) {
      return { error: 'Full page screenshot is too large. Please try capturing a specific element instead.' };
    }

    return dataUrlResult;
  } catch (error) {
    console.warn('Unable to compress full page screenshot', error);
    return { error: `Failed to compress screenshot: ${error.message}` };
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function addIssueToProjectColumn(columnId, issueId) {
  const token = await getStoredToken();
  if (!token || !columnId || !issueId) {
    return;
  }

  await fetch(`https://api.github.com/projects/columns/${columnId}/cards`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.inertia-preview+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content_id: issueId,
      content_type: 'Issue'
    })
  });
}

async function fetchRepoMilestones() {
  const token = await getStoredToken();
  if (!token) {
    throw new Error('Authentication required.');
  }
  const { owner, repo } = await getRepoConfig();
  if (!owner || !repo) {
    throw new Error('Repository not configured.');
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/milestones?state=open&direction=asc`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (response.status === 401) {
    await clearStoredToken();
    throw new Error('Authentication expired. Please sign in again.');
  }

  if (!response.ok) {
    throw new Error(`Failed to load milestones (status ${response.status})`);
  }

  const data = await response.json();
  return data.map(milestone => ({
    number: milestone.number,
    title: milestone.title,
    description: milestone.description,
    state: milestone.state,
    due_on: milestone.due_on
  }));
}

async function fetchRepoProjects() {
  const { owner, repo } = await getRepoConfig();
  if (!owner || !repo) {
    throw new Error('Repository not configured.');
  }

  const query = `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        projectsV2(first: 25, orderBy: { field: TITLE, direction: ASC }) {
          nodes {
            id
            title
            number
            closed
          }
        }
      }
    }
  `;

  const data = await githubGraphQLRequest(query, { owner, name: repo });
  const nodes = data?.repository?.projectsV2?.nodes || [];

  return nodes
    .filter(project => project && project.closed === false)
    .map(project => ({
      id: project.id,
      name: project.title,
      number: project.number
    }));
}

async function fetchProjectColumns(projectId) {
  const query = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              __typename
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await githubGraphQLRequest(query, { projectId });
  const fields = data?.node?.fields?.nodes || [];

  const statusField =
    fields.find(field => field?.name?.toLowerCase() === 'status') ||
    fields.find(field => field?.__typename === 'ProjectV2SingleSelectField');

  if (!statusField) {
    return { fieldId: null, options: [] };
  }

  const options = (statusField.options || []).map(option => ({
    id: option.id,
    name: option.name
  }));

  return {
    fieldId: statusField.id,
    options
  };
}

async function getSelectionPreferences() {
  const { owner, repo } = await getRepoConfig();
  if (!owner || !repo) {
    return { milestoneNumber: null, projectId: null, statusFieldId: null, statusOptionId: null };
  }

  const storage = await chrome.storage.sync.get([LAST_MILESTONE_KEY, LAST_COLUMN_KEY]);
  const repoKey = getRepoPreferenceKey(owner, repo);

  const milestoneStore = storage?.[LAST_MILESTONE_KEY] || {};
  const columnStore = storage?.[LAST_COLUMN_KEY] || {};

  const milestoneNumber = typeof milestoneStore[repoKey] === 'number' ? milestoneStore[repoKey] : null;
  const columnPref = columnStore[repoKey] || {};

  return {
    milestoneNumber,
    projectId: columnPref.projectId ?? null,
    statusFieldId: columnPref.statusFieldId ?? null,
    statusOptionId: columnPref.statusOptionId ?? null
  };
}

async function saveSelectionPreferences(preferences = {}) {
  const { owner, repo } = await getRepoConfig();
  if (!owner || !repo) {
    return;
  }

  const repoKey = getRepoPreferenceKey(owner, repo);
  const storage = await chrome.storage.sync.get([LAST_MILESTONE_KEY, LAST_COLUMN_KEY]);

  const milestoneStore = { ...(storage?.[LAST_MILESTONE_KEY] || {}) };
  const columnStore = { ...(storage?.[LAST_COLUMN_KEY] || {}) };

  if ('milestoneNumber' in preferences) {
    if (Number.isFinite(preferences.milestoneNumber)) {
      milestoneStore[repoKey] = preferences.milestoneNumber;
    } else {
      delete milestoneStore[repoKey];
    }
  }

  if ('projectId' in preferences || 'statusOptionId' in preferences || 'statusFieldId' in preferences) {
    if (preferences.projectId) {
      columnStore[repoKey] = {
        projectId: preferences.projectId,
        statusFieldId: preferences.statusFieldId || null,
        statusOptionId: preferences.statusOptionId || null
      };
    } else {
      delete columnStore[repoKey];
    }
  }

  await chrome.storage.sync.set({
    [LAST_MILESTONE_KEY]: milestoneStore,
    [LAST_COLUMN_KEY]: columnStore
  });
}

function getRepoPreferenceKey(owner, repo) {
  return `${owner}/${repo}`;
}

async function addIssueToProjectV2({ projectId, contentNodeId, statusFieldId, statusOptionId }) {
  if (!projectId || !contentNodeId) {
    return;
  }

  const addMutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item {
          id
        }
      }
    }
  `;

  const addResult = await githubGraphQLRequest(addMutation, {
    projectId,
    contentId: contentNodeId
  });
  const itemId = addResult?.addProjectV2ItemById?.item?.id;
  if (!itemId) {
    throw new Error('Project item creation failed.');
  }

  if (statusFieldId && statusOptionId) {
    const updateMutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: { singleSelectOptionId: $optionId }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await githubGraphQLRequest(updateMutation, {
      projectId,
      itemId,
      fieldId: statusFieldId,
      optionId: statusOptionId
    });
  }
}

async function githubGraphQLRequest(query, variables = {}) {
  const token = await getStoredToken();
  if (!token) {
    throw new Error('Authentication required.');
  }

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json'
    },
    body: JSON.stringify({ query, variables })
  });

  if (response.status === 401) {
    await clearStoredToken();
    throw new Error('Authentication expired. Please sign in again.');
  }

  const result = await response.json();

  if (!response.ok || result.errors) {
    const message = result?.errors?.[0]?.message || `GitHub GraphQL error (status ${response.status})`;
    throw new Error(message);
  }

  return result.data;
}

async function getR2Config() {
  const stored = await chrome.storage.sync.get(R2_CONFIG_KEY);
  if (stored?.[R2_CONFIG_KEY]) {
    return stored[R2_CONFIG_KEY];
  }
  // Fallback to defaults if not configured
  return {
    workerProxyUrl: DEFAULT_R2_WORKER_PROXY_URL, // Recommended: Cloudflare Worker proxy URL for secure uploads
    endpoint: DEFAULT_R2_ENDPOINT, // Alternative: Direct R2 endpoint
    bucketName: DEFAULT_R2_BUCKET_NAME,
    publicUrl: DEFAULT_R2_PUBLIC_URL, // Public URL for accessing uploaded files
    accessKeyId: '', // Not used if using Worker proxy
    secretAccessKey: '' // Not used if using Worker proxy
  };
}

async function uploadScreenshotToR2(dataUrl) {
  const blob = await dataUrlToBlob(dataUrl);
  if (!blob) {
    throw new Error('Unable to convert screenshot to blob');
  }

  const config = await getR2Config();
  
  // Check if using Worker proxy (recommended) or direct R2 upload
  if (config.workerProxyUrl) {
    // Use Cloudflare Worker proxy for secure uploads
    return await uploadViaWorkerProxy(config.workerProxyUrl, blob);
  }
  
  if (!config.endpoint || !config.bucketName || !config.publicUrl) {
    throw new Error('R2 configuration is incomplete. Please configure R2 settings in extension options. Either set workerProxyUrl for secure uploads, or configure endpoint, bucketName, and publicUrl for direct uploads.');
  }

  // Direct R2 upload (requires public bucket with CORS)
  // Note: This approach exposes the upload endpoint. Consider using Worker proxy instead.
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 9);
  const filename = `screenshots/${timestamp}-${randomId}.jpg`;
  const publicUrl = `${config.publicUrl}/${filename}`;
  
  try {
    // For public R2 bucket, upload directly
    // The bucket must be configured for public writes with CORS
    const uploadUrl = `${config.publicUrl}/${filename}`;
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg'
      },
      body: blob
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`R2 upload failed: ${response.status} - ${errorText}`);
    }

    return { url: publicUrl, download_url: publicUrl };
  } catch (error) {
    console.error('R2 upload error:', error);
    throw new Error(`Failed to upload screenshot to R2: ${error.message}`);
  }
}

async function uploadViaWorkerProxy(workerUrl, blob) {
  try {
    const formData = new FormData();
    formData.append('screenshot', blob, `screenshot-${Date.now()}.jpg`);
    
    const response = await fetch(workerUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return { url: result.url, download_url: result.url };
  } catch (error) {
    console.error('Worker proxy upload error:', error);
    throw new Error(`Failed to upload via Worker proxy: ${error.message}`);
  }
}

// Legacy function name for compatibility - now uses R2
async function uploadIssueAttachment({ owner, repo, issueNumber, dataUrl, token }) {
  // Use R2 instead of GitHub attachments
  return await uploadScreenshotToR2(dataUrl);
}

async function patchIssueBody(owner, repo, issueNumber, body, token) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({ body })
  });

  if (!response.ok) {
    const errorBody = await safeParseJson(response);
    throw new Error(errorBody?.message || `Failed to update issue body (status ${response.status})`);
  }
}

async function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null;
  }
  try {
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch (error) {
    console.warn('Unable to convert data URL to blob', error);
    return null;
  }
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function requestContextFromTab(tabId) {
  await ensureContentScript(tabId);
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'captureContext' });
  } catch (error) {
    console.error('Failed to request context from tab', error);
    throw new Error('Unable to capture context from this page.');
  }
}

