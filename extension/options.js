async function init() {
  await loadConfig();
  await refreshAuthState();

  document.getElementById('config-form').addEventListener('submit', handleSave);
  document.getElementById('sign-in').addEventListener('click', handleSignIn);
  document.getElementById('sign-out').addEventListener('click', handleSignOut);
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

async function handleSave(event) {
  event.preventDefault();
  const owner = document.getElementById('owner').value.trim();
  const repo = document.getElementById('repo').value.trim();
  const labels = document
    .getElementById('labels')
    .value.split(',')
    .map((label) => label.trim())
    .filter(Boolean);

  const response = await chrome.runtime.sendMessage({
    type: 'saveConfig',
    config: { owner, repo, labels }
  });

  const status = document.getElementById('status');
  if (response?.success) {
    status.textContent = 'Defaults saved.';
  } else {
    status.textContent = response?.error || 'Unable to save settings.';
  }
}

async function handleSignIn() {
  setStatus('Signing in…');
  const response = await chrome.runtime.sendMessage({ type: 'signIn' });
  if (response?.success) {
    setStatus('Signed in successfully.');
  } else {
    setStatus(response?.error || 'Sign-in failed.');
  }
  await refreshAuthState();
}

async function handleSignOut() {
  await chrome.runtime.sendMessage({ type: 'signOut' });
  setStatus('Signed out.');
  await refreshAuthState();
}

async function refreshAuthState() {
  const signIn = document.getElementById('sign-in');
  const signOut = document.getElementById('sign-out');
  const status = document.getElementById('status');

  const response = await chrome.runtime.sendMessage({ type: 'getAuthState' });
  if (response?.success && response.authenticated) {
    signIn.disabled = true;
    signOut.disabled = false;
    const scope = response.token?.scope || 'N/A';
    status.textContent = `Signed in (scope: ${scope}).`;
  } else {
    signIn.disabled = false;
    signOut.disabled = true;
    status.textContent = 'Not signed in.';
  }
}

function setStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
}
