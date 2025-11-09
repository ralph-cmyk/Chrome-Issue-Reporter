// GitHub Issue Sanitization and Formatting Utility
// Implements capture-sanitization policy for consistent, safe, and size-controlled issue bodies

// Size limits (in bytes)
const LIMITS = {
  OVERALL: 40 * 1024,           // 40 KB context budget (well below GitHub's 65 KB hard cap)
  TITLE: 80,                    // 80 characters
  HEADER: 300,                  // 300 characters
  REPRO_STEPS: 2 * 1024,        // 2 KB
  EXPECTED: 2 * 1024,           // 2 KB
  ACTUAL: 2 * 1024,             // 2 KB
  JS_ERROR: 2 * 1024,           // 2 KB
  CONSOLE_LOGS: 3 * 1024,       // tighter console log cap
  CONSOLE_ENTRIES: 20,          // fewer console entries to reduce noise
  NETWORK_SAMPLE: 512,          // 512 bytes
  DOM_SNIPPET: 1 * 1024         // 1 KB
};

// Regular expressions for redaction
const REDACTION_PATTERNS = {
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  JWT: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  HEX_TOKEN: /\b[a-fA-F0-9]{32,64}\b/g,
  URL_QUERY: /(\?)[^#\s]+/g,
  AUTH_HEADER: /(Authorization:\s*)[^\r\n]+/gi
};

// Non-deterministic HTML attributes to remove
const NON_DETERMINISTIC_ATTRS = [
  'nonce',
  'integrity',
  'crossorigin'
];

// Inline event handlers pattern
const INLINE_EVENT_PATTERN = /\s+on\w+\s*=\s*["'][^"']*["']/gi;

/**
 * Sanitizes and builds a GitHub issue body according to the capture-sanitization policy
 * @param {Object} context - The captured page context
 * @param {Object} userInput - User-provided information (title, description)
 * @returns {Object} - { title, body } formatted for GitHub
 */
function buildSanitizedIssue(context = {}, userInput = {}) {
  const mandatorySections = [];
  const optionalSections = [];

  const header = buildHeader(context);
  if (header) mandatorySections.push(header);

  const elementContext = buildElementContext(context);
  if (elementContext) mandatorySections.push(elementContext);

  const description = buildDescription(userInput.description || '');
  if (description) mandatorySections.push(description);

  const consoleSummary = buildConsoleSummary(context.consoleLogs);
  if (consoleSummary) optionalSections.push(consoleSummary);

  const jsError = buildJsError(context.jsError);
  if (jsError) optionalSections.push(jsError);

  const networkSample = buildNetworkSample(context.networkRequests);
  if (networkSample) optionalSections.push(networkSample);

  const consoleLogs = buildConsoleLogs(context.consoleLogs);
  if (consoleLogs) optionalSections.push(consoleLogs);

  const domSnippet = buildDomSnippet(context.htmlSnippet);
  if (domSnippet) optionalSections.push(domSnippet);

  let body = '';
  const appendSection = (section) => {
    if (!section) return;
    body = body ? `${body}\n\n${section}` : section;
  };

  mandatorySections.forEach(appendSection);

  optionalSections.forEach((section) => {
    if (!section) return;
    const candidate = body ? `${body}\n\n${section}` : section;
    if (getByteLength(candidate) <= LIMITS.OVERALL) {
      body = candidate;
    }
  });

  if (getByteLength(body) > LIMITS.OVERALL) {
    body = truncateToBytes(body, LIMITS.OVERALL);
    body += '\n\n[…] truncated';
  }

  const contextHash = generateContextHash(context);
  body += `\n\nContext-Hash: ${contextHash}`;

  const title = sanitizeTitle(userInput.title || context.title || 'Issue Report');

  const size = getByteLength(body);

  return { title, body, size };
}

/**
 * Sanitizes title: max 80 chars, remove newlines and emojis
 */
function sanitizeTitle(title) {
  if (!title) return 'Issue Report';
  
  // Remove newlines
  let sanitized = title.replace(/[\r\n]+/g, ' ');
  
  // Remove emojis (basic emoji range + extended)
  sanitized = sanitized.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  
  // Collapse multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Truncate to 80 characters
  if (sanitized.length > LIMITS.TITLE) {
    sanitized = sanitized.substring(0, LIMITS.TITLE).trim();
  }
  
  return sanitized || 'Issue Report';
}

/**
 * Builds header section with URL, timestamp, user agent, viewport
 */
function buildHeader(context) {
  const parts = [];
  
  // URL without query/hash
  if (context.url) {
    const url = stripUrlQueryAndHash(context.url);
    parts.push(`**URL:** ${redactText(url)}`);
  }
  
  // ISO timestamp
  const timestamp = context.timestamp ? new Date(context.timestamp).toISOString() : new Date().toISOString();
  parts.push(`**Timestamp:** ${timestamp}`);
  
  // User agent
  if (context.userAgent) {
    parts.push(`**User Agent:** ${redactText(context.userAgent)}`);
  }
  
  // Viewport
  if (context.viewport) {
    parts.push(`**Viewport:** ${context.viewport}`);
  }
  
  let header = parts.join('\n');
  
  // Apply size limit
  if (header.length > LIMITS.HEADER) {
    header = header.substring(0, LIMITS.HEADER);
  }
  
  return header;
}

/**
 * Adds quick context about the selected element and page selection.
 */
function buildElementContext(context = {}) {
  const rows = [];

  if (context.elementDescription) {
    rows.push(`- **Element:** ${redactText(context.elementDescription)}`);
  }

  if (context.cssSelector) {
    rows.push(`- **Selector:** \`${redactText(context.cssSelector)}\``);
  }

  if (context.selectedText) {
    rows.push(`- **Selected Text:** ${truncateAndRedact(context.selectedText, 180)}`);
  }

  if (!rows.length) {
    return '';
  }

  return `## Element Context\n\n${rows.join('\n')}`;
}

/**
 * Builds description section (what's wrong)
 */
function buildDescription(description) {
  if (!description || !description.trim()) return '';
  
  let content = redactText(description);
  content = collapseWhitespace(content);
  
  if (new Blob([content]).size > LIMITS.REPRO_STEPS) {
    content = truncateToBytes(content, LIMITS.REPRO_STEPS);
    return wrapInDetails('Description (truncated)', content);
  }
  
  return `## Description\n\n${content}`;
}

/**
 * Builds JS error section (most recent error only)
 */
function buildJsError(jsError) {
  if (!jsError) return '';
  
  const parts = [];
  
  if (jsError.message) {
    parts.push(`**Message:** ${redactText(jsError.message)}`);
  }
  
  if (jsError.source) {
    parts.push(`**Source:** ${redactText(jsError.source)}:${jsError.line || 0}:${jsError.column || 0}`);
  }
  
  if (jsError.stack) {
    parts.push(`**Stack:**\n\`\`\`\n${redactText(jsError.stack)}\n\`\`\``);
  }
  
  let content = parts.join('\n');
  
  if (new Blob([content]).size > LIMITS.JS_ERROR) {
    content = truncateToBytes(content, LIMITS.JS_ERROR);
    return wrapInDetails('JavaScript Error (truncated)', content);
  }
  
  return `## JavaScript Error\n\n${content}`;
}

/**
 * Builds console logs section (log, info, debug, warn, error - last 50 entries or 8 KB)
 */
function buildConsoleLogs(logs) {
  if (!logs || !Array.isArray(logs)) return '';
  
  // Include all console message types for comprehensive debugging context
  const filtered = logs.filter(log => 
    log.type === 'log' || log.type === 'info' || log.type === 'debug' || 
    log.type === 'warn' || log.type === 'error'
  );
  
  if (filtered.length === 0) return '';
  
  // Take last N entries (based on LIMITS.CONSOLE_ENTRIES)
  const recent = filtered.slice(-LIMITS.CONSOLE_ENTRIES);
  
  // Deduplicate consecutive identical lines
  const deduped = deduplicateConsecutive(recent);
  
  // Format logs with color-coded type indicators
  const formatted = deduped.map(log => {
    const time = log.timestamp ? new Date(log.timestamp).toISOString() : '';
    const message = truncateAndRedact(log.message || '', 240);
    return `[${time}] [${log.type.toUpperCase()}] ${message}`;
  }).join('\n');
  
  let content = formatted;
  
  // Apply size limit
  if (new Blob([content]).size > LIMITS.CONSOLE_LOGS) {
    content = truncateToBytes(content, LIMITS.CONSOLE_LOGS);
    return wrapInDetails('Console Logs (truncated)', content);
  }
  
  return wrapInDetails('Console Logs', content);
}

function buildConsoleSummary(logs) {
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return '';
  }

  let errors = 0;
  let warns = 0;
  let infos = 0;
  let debugs = 0;
  for (const log of logs) {
    if (!log?.type) continue;
    if (log.type === 'error') errors++;
    else if (log.type === 'warn') warns++;
    else if (log.type === 'info') infos++;
    else if (log.type === 'debug') debugs++;
  }

  const latestError = logs.slice().reverse().find(log => log.type === 'error');
  const latestWarn = logs.slice().reverse().find(log => log.type === 'warn');

  const lines = [];
  lines.push(`- Errors: **${errors}** • Warnings: **${warns}** • Infos: ${infos} • Debug: ${debugs}`);

  if (latestError?.message) {
    lines.push(`- Last error: ${truncateAndRedact(latestError.message, 200)}`);
  }

  if (latestWarn?.message) {
    lines.push(`- Last warning: ${truncateAndRedact(latestWarn.message, 200)}`);
  }

  return `## Console Snapshot\n\n${lines.join('\n')}`;
}

/**
 * Builds network sample section (one failing request)
 */
function buildNetworkSample(requests) {
  if (!requests || !Array.isArray(requests)) return '';
  
  // Find first failing request (status >= 400)
  const failedRequest = requests.find(req => req.status >= 400);
  
  if (!failedRequest) return '';
  
  const parts = [];
  
  if (failedRequest.method) {
    parts.push(`**Method:** ${failedRequest.method}`);
  }
  
  if (failedRequest.url) {
    const urlPath = getOriginAndPath(failedRequest.url);
    parts.push(`**URL:** ${redactText(urlPath)}`);
  }
  
  if (failedRequest.status) {
    parts.push(`**Status:** ${failedRequest.status}`);
  }
  
  if (failedRequest.responsePreview) {
    const preview = redactText(failedRequest.responsePreview);
    parts.push(`**Response Preview:**\n\`\`\`\n${preview}\n\`\`\``);
  }
  
  let content = parts.join('\n');
  
  // Apply size limit
  if (new Blob([content]).size > LIMITS.NETWORK_SAMPLE) {
    content = truncateToBytes(content, LIMITS.NETWORK_SAMPLE);
    content += '\n[…] truncated';
  }
  
  return `## Network Sample\n\n${content}`;
}

/**
 * Builds DOM snippet section
 */
function buildDomSnippet(htmlSnippet) {
  if (!htmlSnippet || !htmlSnippet.trim()) return '';
  
  // Sanitize HTML
  let sanitized = sanitizeDomSnippet(htmlSnippet);
  sanitized = redactText(sanitized);
  
  // Apply size limit
  if (new Blob([sanitized]).size > LIMITS.DOM_SNIPPET) {
    sanitized = truncateToBytes(sanitized, LIMITS.DOM_SNIPPET);
    return wrapInDetails('DOM Snippet (truncated)', '```html\n' + sanitized + '\n```');
  }
  
  return wrapInDetails('DOM Snippet', '```html\n' + sanitized + '\n```');
}

/**
 * Sanitizes DOM snippet: removes scripts, styles, event handlers, keeps id/class/data-*
 * 
 * SECURITY NOTE: This sanitization is for DISPLAY purposes in a GitHub issue markdown
 * code block, NOT for preventing XSS in HTML execution. GitHub will apply its own
 * sanitization when rendering the issue. The purpose here is to:
 * 1. Reduce noise (remove scripts/styles that aren't useful for debugging)
 * 2. Remove non-deterministic attributes
 * 3. Keep size under control
 * 
 * The regex patterns here are intentionally simple because:
 * - The output is wrapped in markdown code blocks (```html)
 * - GitHub will sanitize it again before rendering
 * - We prioritize size reduction over perfect HTML parsing
 */
function sanitizeDomSnippet(html) {
  if (!html) return '';
  
  let sanitized = html;
  
  // Remove script tags and their content (simple regex, sufficient for code block display)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags and their content (simple regex, sufficient for code block display)
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove inline event handlers (on* attributes) - for noise reduction, not XSS prevention
  sanitized = sanitized.replace(INLINE_EVENT_PATTERN, '');
  
  // Remove non-deterministic attributes
  NON_DETERMINISTIC_ATTRS.forEach(attr => {
    const pattern = new RegExp(`\\s+${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
    sanitized = sanitized.replace(pattern, '');
  });
  
  // Collapse whitespace
  sanitized = collapseWhitespace(sanitized);
  
  return sanitized;
}

/**
 * Redacts sensitive information from text
 */
function redactText(text) {
  if (!text) return '';
  
  let redacted = text;
  
  // Redact emails
  redacted = redacted.replace(REDACTION_PATTERNS.EMAIL, '[redacted-email]');
  
  // Redact JWTs
  redacted = redacted.replace(REDACTION_PATTERNS.JWT, '[redacted-jwt]');
  
  // Redact hex tokens (32-64 chars)
  redacted = redacted.replace(REDACTION_PATTERNS.HEX_TOKEN, '[redacted-token]');
  
  // Redact URL queries
  redacted = redacted.replace(REDACTION_PATTERNS.URL_QUERY, '?[redacted-query]');
  
  // Redact Authorization headers
  redacted = redacted.replace(REDACTION_PATTERNS.AUTH_HEADER, '$1[redacted]');
  
  return redacted;
}

/**
 * Strips query parameters and hash from URL
 */
function stripUrlQueryAndHash(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    // If URL parsing fails, do basic string manipulation
    return url.split('?')[0].split('#')[0];
  }
}

/**
 * Gets origin and path from URL (no query/hash)
 */
function getOriginAndPath(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return url.split('?')[0].split('#')[0];
  }
}

/**
 * Collapses whitespace (multiple spaces, tabs, newlines to single space/newline)
 */
function collapseWhitespace(text) {
  if (!text) return '';
  
  // Collapse multiple spaces/tabs to single space
  let collapsed = text.replace(/[ \t]+/g, ' ');
  
  // Collapse multiple newlines to maximum 2 newlines
  collapsed = collapsed.replace(/\n{3,}/g, '\n\n');
  
  return collapsed.trim();
}

/**
 * Deduplicates consecutive identical log entries
 */
function deduplicateConsecutive(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return [];
  
  const deduped = [logs[0]];
  
  for (let i = 1; i < logs.length; i++) {
    const current = logs[i];
    const previous = logs[i - 1];
    
    if (current.message !== previous.message || current.type !== previous.type) {
      deduped.push(current);
    }
  }
  
  return deduped;
}

/**
 * Wraps content in a markdown details/summary block
 */
function wrapInDetails(summary, content) {
  return `<details>\n<summary>${summary}</summary>\n\n${content}\n</details>`;
}

/**
 * Truncates text to specified byte size (UTF-8 safe)
 */
function truncateToBytes(text, maxBytes) {
  if (!text) return '';
  
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  
  if (encoded.length <= maxBytes) {
    return text;
  }
  
  // Decode with option to ignore incomplete sequences at the end
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const truncated = decoder.decode(encoded.slice(0, maxBytes));
  
  // If the last character might be incomplete, remove it to be safe
  // This ensures we don't have partial multi-byte characters
  return truncated.replace(/[\uFFFD]+$/, ''); // Remove replacement characters
}

/**
 * Generates a stable hash of the context for determinism
 */
function generateContextHash(context) {
  // Create a deterministic string from key context fields
  const fields = [
    context.url || '',
    context.timestamp || '',
    context.userAgent || '',
    context.htmlSnippet || '',
    context.cssSelector || ''
  ];
  
  const combined = fields.join('|');
  
  // Simple hash function (DJB2)
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function truncateAndRedact(text, limit) {
  if (!text) return '';
  let content = redactText(text);
  if (content.length > limit) {
    content = content.slice(0, limit - 1) + '…';
  }
  return content;
}

function getByteLength(text) {
  if (!text) return 0;
  return new TextEncoder().encode(text).length;
}

// Export for use in background.js (ES module)
export { buildSanitizedIssue, sanitizeTitle, redactText };

