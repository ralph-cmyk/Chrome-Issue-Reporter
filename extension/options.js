// Constants
const CLOSE_DELAY_MS = 1500; // Delay before closing the options page after successful save

async function init() {
  await loadConfig();
  await refreshAuthState();

  document.getElementById('save').addEventListener('click', handleSave);
  document.getElementById('oauth-signin').addEventListener('click', handleOAuthSignIn);
  document.getElementById('sign-out').addEventListener('click', handleSignOut);
  
  // Auto-load repos if authenticated
  await autoLoadRepos();
}

document.addEventListener('DOMContentLoaded', init);

async function handleOAuthSignIn() {
  const button = document.getElementById('oauth-signin');
  button.disabled = true;
  button.classList.add('loading');
  setStatus('🔄 Starting GitHub OAuth flow...', 'info');
  
  try {
    // Step 1: Start device flow
    const response = await chrome.runtime.sendMessage({ 
      type: 'startDeviceFlow',
      scopes: 'repo project read:org'
    });
    
    if (!response?.success) {
      setStatus('❌ Failed to start device flow\n\n' + (response?.error || 'Unknown error'), 'error');
      return;
    }
    
    const { user_code, verification_uri, device_code, interval } = response;
    
    try {
      await navigator.clipboard.writeText(user_code);
    } catch (clipboardError) {
      console.warn('Unable to copy verification code to clipboard', clipboardError);
    }
    
    // Step 2: Show the code to the user and open GitHub
    const message = `🔑 YOUR VERIFICATION CODE: ${user_code}

✅ Device flow started successfully!

📋 Instructions:
1. A new tab will open to GitHub
2. Paste the copied code: ${user_code}
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

async function autoLoadRepos() {
  // Check if user is authenticated
  const authResponse = await chrome.runtime.sendMessage({ type: 'getAuthState' });
  if (authResponse?.success && authResponse.authenticated) {
    await handleFetchRepos(true); // true = silent mode, don't show button state
  } else {
    // Show no repos message
    const noReposMessage = document.getElementById('no-repos-message');
    if (noReposMessage) {
      noReposMessage.style.display = 'block';
    }
  }
}

async function handleFetchRepos(silent = false) {
  const repoListContainer = document.getElementById('repo-list-container');
  const repoList = document.getElementById('repo-list');
  const noReposMessage = document.getElementById('no-repos-message');
  
  if (!silent) {
    setStatus('🔄 Loading your repositories from GitHub...', 'info');
  }
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'fetchRepos' });
    
    if (response?.success && response.repos) {
      // Hide no repos message
      if (noReposMessage) {
        noReposMessage.style.display = 'none';
      }
      
      // Get current config to select the right repo
      const configResponse = await chrome.runtime.sendMessage({ type: 'getConfig' });
      const currentRepo = configResponse?.success && configResponse.config 
        ? `${configResponse.config.owner}/${configResponse.config.repo}` 
        : '';
      
      // Clear existing list
      repoList.innerHTML = '';
      
      // Add repos as radio buttons
      response.repos.forEach((repo, index) => {
        const repoItem = document.createElement('div');
        repoItem.className = 'repo-item';
        if (repo.full_name === currentRepo) {
          repoItem.classList.add('selected');
        }
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'repository';
        radio.id = `repo-${index}`;
        radio.value = repo.full_name;
        radio.checked = repo.full_name === currentRepo;
        
        const label = document.createElement('label');
        label.htmlFor = `repo-${index}`;
        label.innerHTML = `
          <span>${repo.full_name}</span>
          ${repo.private ? '<span class="repo-private-badge">🔒 Private</span>' : ''}
        `;
        
        // Click handler for the entire item
        repoItem.addEventListener('click', (e) => {
          // Unselect all
          document.querySelectorAll('.repo-item').forEach(item => {
            item.classList.remove('selected');
          });
          // Select this one
          repoItem.classList.add('selected');
          radio.checked = true;
        });
        
        repoItem.appendChild(radio);
        repoItem.appendChild(label);
        repoList.appendChild(repoItem);
      });
      
      // Show the repo list
      repoListContainer.style.display = 'block';
      
      if (!silent) {
        setStatus(`✅ Loaded ${response.repos.length} repositories successfully!\n\n📚 Select a repository and click "Save Settings" below.`, 'success');
      }
    } else {
      if (noReposMessage) {
        noReposMessage.style.display = 'block';
      }
      if (!silent) {
        setStatus('❌ Failed to load repositories\n\n' + (response?.error || 'Unknown error occurred'), 'error');
      }
    }
  } catch (error) {
    if (!silent) {
      setStatus('❌ Error loading repositories\n\n' + error.message, 'error');
    }
  }
}

async function loadConfig() {
  const labelsInput = document.getElementById('labels');

  const response = await chrome.runtime.sendMessage({ type: 'getConfig' });
  if (response?.success && response.config) {
    const labelsValue = Array.isArray(response.config.labels) && response.config.labels.length > 0
      ? response.config.labels.join(', ')
      : 'created by ChromeExtension';
    labelsInput.value = labelsValue;
  } else {
    // Set default label
    labelsInput.value = 'created by ChromeExtension';
  }
}

async function handleSave() {
  // Get selected repository from radio buttons
  const selectedRadio = document.querySelector('input[name="repository"]:checked');
  
  if (!selectedRadio) {
    setStatus('⚠️ No repository selected\n\nPlease select a repository from the list above.', 'error');
    return;
  }
  
  const fullName = selectedRadio.value;
  const [owner, repo] = fullName.split('/');
  
  const labels = document
    .getElementById('labels')
    .value.split(',')
    .map((label) => label.trim())
    .filter(Boolean);

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
    setStatus(`✅ Settings saved successfully!\n\n📂 Repository: ${owner}/${repo}\n🏷️ Labels: ${labels.length > 0 ? labels.join(', ') : 'None'}`, 'success');
    // Close the options page after a brief delay to let users see the success message
    setTimeout(() => window.close(), CLOSE_DELAY_MS);
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

  const response = await chrome.runtime.sendMessage({ type: 'getAuthState' });
  if (response?.success && response.authenticated) {
    oauthSignIn.textContent = '🔄 Reconnect with GitHub';
    oauthSignIn.classList.remove('primary');
    oauthSignIn.classList.add('secondary');
    signOut.disabled = false;
    
    if (!document.getElementById('status').textContent) {
      setStatus('✅ You are authenticated with GitHub!\n\n💡 Select your repository below and save settings.', 'success');
    }
  } else {
    oauthSignIn.textContent = '🔐 Connect with GitHub';
    oauthSignIn.classList.remove('secondary');
    oauthSignIn.classList.add('primary');
    signOut.disabled = true;
    
    // Hide repo list if not authenticated
    const repoListContainer = document.getElementById('repo-list-container');
    const noReposMessage = document.getElementById('no-repos-message');
    if (repoListContainer) {
      repoListContainer.style.display = 'none';
    }
    if (noReposMessage) {
      noReposMessage.style.display = 'block';
    }
    
    if (!document.getElementById('status').textContent) {
      setStatus('⚠️ Not authenticated\n\n🔐 Please sign in with GitHub to get started.', 'info');
    }
  }
}

function setStatus(message, type = 'info') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
  if (message) {
    status.style.display = 'block';
  }
}
