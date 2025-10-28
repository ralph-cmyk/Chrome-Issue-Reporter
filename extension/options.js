async function init() {
  await loadConfig();
  await refreshAuthState();

  document.getElementById('save').addEventListener('click', handleSave);
  document.getElementById('sign-in').addEventListener('click', handleSignIn);
  document.getElementById('sign-out').addEventListener('click', handleSignOut);
  document.getElementById('repo-url').addEventListener('input', handleRepoUrlChange);
}

document.addEventListener('DOMContentLoaded', init);

async function loadConfig() {
  const ownerInput = document.getElementById('owner');
  const repoInput = document.getElementById('repo');
  const labelsInput = document.getElementById('labels');

  const response = await chrome.runtime.sendMessage({ type: 'getConfig' });
  if (response?.success && response.config) {
    ownerInput.value = response.config.owner || '';
    repoInput.value = response.config.repo || '';
    labelsInput.value = Array.isArray(response.config.labels)
      ? response.config.labels.join(', ')
      : '';
  }
}

async function handleSave() {
  const owner = document.getElementById('owner').value.trim();
  const repo = document.getElementById('repo').value.trim();
  const labels = document
    .getElementById('labels')
    .value.split(',')
    .map((label) => label.trim())
    .filter(Boolean);

  if (!owner || !repo) {
    setStatus('⚠️ Repository owner and name are required.');
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: 'saveConfig',
    config: { owner, repo, labels }
  });

  if (response?.success) {
    setStatus('✅ Repository settings saved.');
  } else {
    setStatus('❌ ' + (response?.error || 'Unable to save settings.'));
  }
}

async function handleSignIn() {
  const tokenInput = document.getElementById('token');
  const token = tokenInput.value.trim();
  
  if (!token) {
    setStatus('⚠️ Please enter a Personal Access Token.');
    return;
  }

  setStatus('🔄 Validating token...');
  const response = await chrome.runtime.sendMessage({ 
    type: 'signIn',
    token: token 
  });
  
  if (response?.success) {
    setStatus('✅ Token validated and saved successfully!');
    tokenInput.value = '';
  } else {
    setStatus('❌ ' + (response?.error || 'Sign-in failed.'));
  }
  await refreshAuthState();
}

async function handleSignOut() {
  await chrome.runtime.sendMessage({ type: 'signOut' });
  setStatus('✅ Signed out successfully.');
  await refreshAuthState();
}

async function refreshAuthState() {
  const signIn = document.getElementById('sign-in');
  const signOut = document.getElementById('sign-out');
  const tokenInput = document.getElementById('token');

  const response = await chrome.runtime.sendMessage({ type: 'getAuthState' });
  if (response?.success && response.authenticated) {
    signIn.textContent = 'Update Token';
    signOut.disabled = false;
    tokenInput.placeholder = 'Enter new token to update...';
  } else {
    signIn.textContent = 'Save & Validate Token';
    signOut.disabled = true;
    tokenInput.placeholder = 'ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_xxxxxxxxxxxxxxxxxxxx';
  }
}

function handleRepoUrlChange() {
  const repoUrl = document.getElementById('repo-url').value.trim();
  const parsed = parseGitHubUrl(repoUrl);
  
  if (parsed) {
    document.getElementById('owner').value = parsed.owner;
    document.getElementById('repo').value = parsed.repo;
  }
}

function parseGitHubUrl(url) {
  if (!url) return null;
  
  // Remove trailing slashes and whitespace
  url = url.trim().replace(/\/+$/, '');
  
  // Pattern 1: owner/repo
  let match = url.match(/^([^\/\s]+)\/([^\/\s]+)$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  // Pattern 2: https://github.com/owner/repo or http://github.com/owner/repo
  match = url.match(/^https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  // Pattern 3: github.com/owner/repo
  match = url.match(/^github\.com\/([^\/\s]+)\/([^\/\s]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  // Pattern 4: git@github.com:owner/repo.git
  match = url.match(/^git@github\.com:([^\/\s]+)\/([^\/\s]+?)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  return null;
}

function setStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
}
