async function init() {
  await loadConfig();
  await refreshAuthState();

  document.getElementById('save').addEventListener('click', handleSave);
  document.getElementById('oauth-signin').addEventListener('click', handleOAuthSignIn);
  document.getElementById('sign-out').addEventListener('click', handleSignOut);
  document.getElementById('repo-url').addEventListener('input', handleRepoUrlChange);
  document.getElementById('fetch-repos').addEventListener('click', handleFetchRepos);
  document.getElementById('repo-select').addEventListener('change', handleRepoSelect);
}

document.addEventListener('DOMContentLoaded', init);

async function handleOAuthSignIn() {
  const button = document.getElementById('oauth-signin');
  button.disabled = true;
  button.classList.add('loading');
  setStatus('🔄 Starting GitHub Device Flow...', 'info');
  
  try {
    // Step 1: Start device flow
    const response = await chrome.runtime.sendMessage({ 
      type: 'startDeviceFlow',
      scopes: 'repo'
    });
    
    if (!response?.success) {
      setStatus('❌ Failed to start device flow\n\n' + (response?.error || 'Unknown error'), 'error');
      return;
    }
    
    const { user_code, verification_uri, device_code, interval } = response;
    
    // Step 2: Show the code to the user and open GitHub
    const message = `✅ Device flow started successfully!

🔑 Your verification code: ${user_code}

📋 Instructions:
1. A new tab will open to GitHub
2. Enter the code: ${user_code}
3. Authorize the extension
4. Return to this page

⏳ Waiting for your authorization...`;
    
    setStatus(message, 'info');
    
    // Open GitHub authorization page
    chrome.tabs.create({ url: verification_uri });
    
    // Step 3: Poll for token
    const pollResponse = await chrome.runtime.sendMessage({
      type: 'pollDeviceToken',
      deviceCode: device_code,
      interval: interval
    });
    
    if (pollResponse?.success) {
      setStatus('✅ Successfully signed in with GitHub!\n\n🎉 You can now configure your repository and start creating issues.', 'success');
      await refreshAuthState();
      // Automatically fetch repositories after successful auth
      setTimeout(() => handleFetchRepos(), 1000);
    } else {
      setStatus('❌ Authorization failed\n\n' + (pollResponse?.error || 'Unknown error occurred'), 'error');
    }
  } catch (error) {
    setStatus('❌ OAuth error\n\n' + error.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
  }
}

async function handleFetchRepos() {
  const repoSelect = document.getElementById('repo-select');
  const repoSelectHint = document.getElementById('repo-select-hint');
  const button = document.getElementById('fetch-repos');
  
  button.disabled = true;
  button.classList.add('loading');
  setStatus('🔄 Loading your repositories from GitHub...', 'info');
  
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
      
      setStatus(`✅ Loaded ${response.repos.length} repositories successfully!\n\n📚 Select a repository from the dropdown below.`, 'success');
    } else {
      setStatus('❌ Failed to load repositories\n\n' + (response?.error || 'Unknown error occurred'), 'error');
    }
  } catch (error) {
    setStatus('❌ Error loading repositories\n\n' + error.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
  }
}

async function handleRepoSelect() {
  const repoSelect = document.getElementById('repo-select');
  const selectedFullName = repoSelect.value;
  
  if (selectedFullName) {
    const [owner, repo] = selectedFullName.split('/');
    document.getElementById('owner').value = owner || '';
    document.getElementById('repo').value = repo || '';
    setStatus(`✅ Selected: ${selectedFullName}\n\n💡 Don't forget to click "Save Repository Settings" below!`, 'info');
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
    setStatus('⚠️ Missing required fields\n\nRepository owner and name are required.', 'error');
    return;
  }

  const button = document.getElementById('save');
  button.disabled = true;
  button.classList.add('loading');

  const response = await chrome.runtime.sendMessage({
    type: 'saveConfig',
    config: { owner, repo, labels }
  });

  button.disabled = false;
  button.classList.remove('loading');

  if (response?.success) {
    setStatus(`✅ Repository settings saved successfully!\n\n📂 ${owner}/${repo}\n🏷️ Labels: ${labels.length > 0 ? labels.join(', ') : 'None'}`, 'success');
  } else {
    setStatus('❌ Unable to save settings\n\n' + (response?.error || 'Unknown error occurred'), 'error');
  }
}

async function handleSignOut() {
  const button = document.getElementById('sign-out');
  button.disabled = true;
  button.classList.add('loading');
  
  await chrome.runtime.sendMessage({ type: 'signOut' });
  setStatus('✅ Signed out successfully!\n\n🔐 You can sign in again anytime using the button above.', 'success');
  await refreshAuthState();
  
  button.disabled = false;
  button.classList.remove('loading');
}

async function refreshAuthState() {
  const oauthSignIn = document.getElementById('oauth-signin');
  const signOut = document.getElementById('sign-out');
  const fetchRepos = document.getElementById('fetch-repos');

  const response = await chrome.runtime.sendMessage({ type: 'getAuthState' });
  if (response?.success && response.authenticated) {
    oauthSignIn.textContent = '🔐 Re-authenticate with GitHub';
    signOut.disabled = false;
    fetchRepos.disabled = false;
  } else {
    oauthSignIn.textContent = '🔐 Sign in with GitHub';
    signOut.disabled = true;
    fetchRepos.disabled = true;
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

function setStatus(message, type = 'info') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
  if (message) {
    status.style.display = 'block';
  }
}
