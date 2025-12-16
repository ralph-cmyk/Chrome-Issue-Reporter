let cachedContext = null;
let defaultLabels = [];

// Constants
const MAX_TITLE_LENGTH = 100; // Maximum length for auto-generated titles (kept for older helper)

const statusEl = document.getElementById("status");
const contextPreviewEl = document.getElementById("context-preview");
const lastIssueEl = document.getElementById("last-issue");
const liveSelectButton = document.getElementById("live-select");
const openModalButton = document.getElementById("open-modal");
const openOptionsLink = document.getElementById("open-options");
const repoInfoEl = document.getElementById("repo-info");

init();

function init() {
  liveSelectButton.addEventListener("click", handleLiveSelect);
  openModalButton.addEventListener("click", handleOpenModal);
  openOptionsLink.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  refresh();
}

async function refresh() {
  await Promise.all([
    refreshAuthState(),
    loadConfig(),
    loadContext(),
    loadLastIssue(),
  ]);
}

async function refreshAuthState(preserveMessage = false) {
  const response = await chrome.runtime.sendMessage({ type: "getAuthState" });

  if (response?.success && response.authenticated) {
    // Enable live select button when authenticated
    liveSelectButton.disabled = false;
    liveSelectButton.setAttribute(
      "aria-label",
      "Live Select Element - Click to select an element on the page",
    );
    if (!preserveMessage) {
      setStatus("", "info");
    }
  } else {
    // Disable and grey out live select button when not authenticated
    liveSelectButton.disabled = true;
    liveSelectButton.setAttribute(
      "aria-label",
      "Live Select Element - Not authenticated. Please sign in from settings.",
    );
    if (!preserveMessage) {
      setStatus("", "info");
    }
  }
}

async function loadConfig() {
  const response = await chrome.runtime.sendMessage({ type: "getConfig" });
  const repoNameEl = repoInfoEl.querySelector(".repo-name");

  if (response?.success) {
    defaultLabels = Array.isArray(response.config?.labels)
      ? response.config.labels
      : [];

    if (response.config?.owner && response.config?.repo) {
      repoNameEl.textContent = `📂 ${response.config.owner}/${response.config.repo}`;
    } else {
      repoNameEl.textContent = "📂 Repository not configured";
    }
  }
}

async function loadContext() {
  const response = await chrome.runtime.sendMessage({ type: "getLastContext" });
  if (response?.success && response.context) {
    cachedContext = response.context;
    contextPreviewEl.textContent = formatContextPreview(cachedContext);
  } else {
    cachedContext = null;
    contextPreviewEl.textContent =
      'No captured context yet. Use "Live Select" to collect details from a page element.';
  }
}

async function loadLastIssue() {
  const response = await chrome.runtime.sendMessage({ type: "getLastIssue" });
  if (response?.success && response.issue) {
    lastIssueEl.innerHTML = `<a class="link" href="${response.issue.html_url}" target="_blank" rel="noreferrer">#${response.issue.number}</a>`;
  } else {
    lastIssueEl.textContent = "";
  }
}

async function handleOpenModal() {
  openModalButton.disabled = true;
  setStatus("Opening issue modal…", "info");
  try {
    const response = await chrome.runtime.sendMessage({
      type: "startPageIssueFlow",
    });
    if (!response?.success) {
      throw new Error(response?.error || "Failed to open issue modal.");
    }
    window.close();
  } catch (error) {
    setStatus(
      "❌ " + (error.message || "Failed to open issue modal."),
      "error",
    );
  } finally {
    openModalButton.disabled = false;
  }
}

async function handleLiveSelect() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "startLiveSelectFlow",
    });
    if (!response?.success) {
      throw new Error(response?.error || "Failed to start live select.");
    }
    setStatus("🎯 Click on any element on the page…", "info");
    window.close();
  } catch (error) {
    console.error("Live select error:", error);
    setStatus(
      "❌ " + (error.message || "Failed to start live select."),
      "error",
    );
  }
}

function buildDefaultTitle(context) {
  if (!context) {
    return "";
  }

  // Generate AI-suggested title based on element selection
  if (context.elementDescription) {
    const desc = context.elementDescription;

    // Parse element description to create intelligent title
    // Format: <tag#id.class> - "text content"
    const tagMatch = desc.match(/<(\w+)/);
    const textMatch = desc.match(/"([^"]+)"/);
    const idMatch = desc.match(/#([\w-]+)/);
    const classMatch = desc.match(/\.([\w-]+)/);

    // Sanitize extracted values to prevent XSS
    const tag = tagMatch ? sanitizeForTitle(tagMatch[1]) : "";
    const text = textMatch ? sanitizeForTitle(textMatch[1]) : "";
    const id = idMatch ? sanitizeForTitle(idMatch[1]) : "";
    const className = classMatch ? sanitizeForTitle(classMatch[1]) : "";

    // Build context-aware title
    let titleParts = [];

    // Determine the element type for natural language
    if (tag === "button") {
      titleParts.push("Change requested in button");
    } else if (tag === "a") {
      titleParts.push("Change requested in link");
    } else if (tag === "img") {
      titleParts.push("Change requested in image");
    } else if (tag === "input" || tag === "textarea" || tag === "select") {
      titleParts.push("Change requested in form field");
    } else if (
      tag === "h1" ||
      tag === "h2" ||
      tag === "h3" ||
      tag === "h4" ||
      tag === "h5" ||
      tag === "h6"
    ) {
      titleParts.push("Change requested in heading");
    } else if (tag === "nav") {
      titleParts.push("Change requested in navigation");
    } else if (tag === "header") {
      titleParts.push("Change requested in header");
    } else if (tag === "footer") {
      titleParts.push("Change requested in footer");
    } else if (tag === "section" || tag === "div") {
      // Try to infer from class names
      if (className) {
        if (
          className.includes("hero") ||
          className.includes("banner") ||
          className.includes("jumbotron")
        ) {
          titleParts.push("Change requested in the hero of the page");
        } else if (className.includes("nav") || className.includes("menu")) {
          titleParts.push("Change requested in navigation");
        } else if (className.includes("card")) {
          titleParts.push("Change requested in card");
        } else if (
          className.includes("modal") ||
          className.includes("dialog")
        ) {
          titleParts.push("Change requested in modal");
        } else if (className.includes("sidebar")) {
          titleParts.push("Change requested in sidebar");
        } else {
          titleParts.push(`Change requested in ${className} section`);
        }
      } else if (id) {
        if (id.includes("hero") || id.includes("banner")) {
          titleParts.push("Change requested in the hero of the page");
        } else {
          titleParts.push(`Change requested in ${id}`);
        }
      } else {
        titleParts.push("Change requested in section");
      }
    } else {
      // Generic fallback
      titleParts.push(`Change requested in ${tag || "element"}`);
    }

    // Add text context if available and short enough
    if (text && text.length < 30) {
      titleParts.push(`(${text})`);
    }

    return titleParts.join(" ");
  }

  if (context.title) {
    return `Change requested: ${sanitizeForTitle(context.title)}`;
  }

  return "Change requested on page";
}

// Sanitize values for use in title to prevent XSS
function sanitizeForTitle(value) {
  if (!value) {
    return "";
  }
  let sanitized = String(value);

  // Remove any HTML tags and script-like content (iterate to handle nested tags)
  let prevLength;
  do {
    prevLength = sanitized.length;
    sanitized = sanitized.replace(/<[^>]*>/g, "");
  } while (sanitized.length !== prevLength);

  // Remove any potential URI schemes (iterate to handle multiple occurrences)
  // Pre-compile regex for performance
  const dangerousSchemes = [
    /javascript:/gi,
    /data:/gi,
    /vbscript:/gi,
    /file:/gi,
    /about:/gi,
  ];

  dangerousSchemes.forEach((schemeRegex) => {
    do {
      prevLength = sanitized.length;
      sanitized = sanitized.replace(schemeRegex, "");
    } while (sanitized.length !== prevLength);
  });

  // Remove event handler patterns (iterate to handle multiple occurrences)
  do {
    prevLength = sanitized.length;
    sanitized = sanitized.replace(/on\w+=/gi, "");
  } while (sanitized.length !== prevLength);

  // Limit length to prevent overly long titles
  if (sanitized.length > MAX_TITLE_LENGTH) {
    sanitized = sanitized.substring(0, MAX_TITLE_LENGTH);
  }

  return sanitized.trim();
}

function formatContextPreview(context) {
  const parts = [];

  if (context.elementDescription) {
    parts.push(`Selected: ${context.elementDescription}`);
  }

  parts.push(context.url);

  if (context.selectedText) {
    parts.push("\nSelection:\n" + truncate(context.selectedText));
  }
  if (context.htmlSnippet) {
    parts.push("\nHTML snippet captured.");
  }
  if (context.scriptSnippet) {
    parts.push("\nJS snippet captured.");
  }
  if (context.jsError) {
    parts.push(`\nLast error: ${context.jsError.message}`);
  }
  if (context.consoleLogs && Array.isArray(context.consoleLogs)) {
    if (context.consoleLogs.length > 0) {
      parts.push(`\n${context.consoleLogs.length} console log(s) captured.`);
    }
  }

  return parts.join("\n");
}

function truncate(value) {
  if (!value) {
    return "";
  }
  return value.length > 200 ? `${value.slice(0, 200)}…` : value;
}

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = "status " + type;
  if (message) {
    statusEl.style.display = "block";
  }
}

// setLoading removed; popup is now a launcher.
