async function init() {
  await loadConfig();
  await refreshAuthState();

  document.getElementById('save').addEventListener('click', handleSave);
  document.getElementById('oauth-signin').addEventListener('click', handleOAuthSignIn);
  document.getElementById('sign-in').addEventListener('click', handleSignIn);
  document.getElementById('sign-out').addEventListener('click', handleSignOut);
  document.getElementById('repo-url').addEventListener('input', handleRepoUrlChange);
  document.getElementById('fetch-repos').addEventListener('click', handleFetchRepos);
  document.getElementById('repo-select').addEventListener('change', handleRepoSelect);
}

document.addEventListener('DOMContentLoaded', init);

async function handleOAuthSignIn() {
  setStatus('🔄 Starting OAuth flow...');
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      type: 'startOAuth',
      scopes: 'repo'
    });
    
    if (response?.success) {
      setStatus('✅ Successfully signed in with GitHub OAuth!');
      await refreshAuthState();
      // Automatically fetch repositories after successful OAuth
      setTimeout(() => handleFetchRepos(), 500);
    } else {
      setStatus('❌ ' + (response?.error || 'OAuth sign-in failed.'));
    }
  } catch (error) {
    setStatus('❌ OAuth error: ' + error.message);
  }
}

async function handleFetchRepos() {
  const repoSelect = document.getElementById('repo-select');
  const repoSelectHint = document.getElementById('repo-select-hint');
  
  setStatus('🔄 Loading repositories...');
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'fetchRepos' });
    
    if (response?.success && response.repos) {
      // Clear existing options except the first one
      repoSelect.innerHTML = '<option value="">-- Choose a repository --</option>';
      
      // Add repos to dropdown
      response.repos.forEach(repo => {
        const option = document.createElement('option');
        option.value = repo.full_name;
        option.textContent = `${repo.full_name}${repo.private ? ' 🔒' : ''}`;
        repoSelect.appendChild(option);
      });
      
      // Show the dropdown
      repoSelect.style.display = 'block';
      repoSelectHint.style.display = 'block';
      
      setStatus(`✅ Loaded ${response.repos.length} repositories.`);
    } else {
      setStatus('❌ ' + (response?.error || 'Failed to load repositories.'));
    }
  } catch (error) {
    setStatus('❌ Error loading repositories: ' + error.message);
  }
}

async function handleRepoSelect() {
  const repoSelect = document.getElementById('repo-select');
  const selectedFullName = repoSelect.value;
  
  if (selectedFullName) {
    const [owner, repo] = selectedFullName.split('/');
    document.getElementById('owner').value = owner || '';
    document.getElementById('repo').value = repo || '';
    setStatus(`Selected: ${selectedFullName}`);
  }
}

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
  const oauthSignIn = document.getElementById('oauth-signin');
  const signIn = document.getElementById('sign-in');
  const signOut = document.getElementById('sign-out');
  const tokenInput = document.getElementById('token');
  const fetchRepos = document.getElementById('fetch-repos');

  const response = await chrome.runtime.sendMessage({ type: 'getAuthState' });
  if (response?.success && response.authenticated) {
    oauthSignIn.textContent = '🔐 Re-authenticate with OAuth';
    signIn.textContent = 'Update Token';
    signOut.disabled = false;
    fetchRepos.disabled = false;
    tokenInput.placeholder = 'Enter new token to update...';
  } else {
    oauthSignIn.textContent = '🔐 Sign in with GitHub OAuth';
    signIn.textContent = 'Save & Validate Token';
    signOut.disabled = true;
    fetchRepos.disabled = true;
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
