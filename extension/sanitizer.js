// GitHub Issue Sanitization and Formatting Utility
// Implements capture-sanitization policy for consistent, safe, and size-controlled issue bodies

// Size limits (in bytes)
const LIMITS = {
  OVERALL: 15 * 1024,           // 15 KB total
  TITLE: 80,                    // 80 characters
  HEADER: 300,                  // 300 characters
  REPRO_STEPS: 2 * 1024,        // 2 KB
  EXPECTED: 2 * 1024,           // 2 KB
  ACTUAL: 2 * 1024,             // 2 KB
  JS_ERROR: 2 * 1024,           // 2 KB
  CONSOLE_LOGS: 8 * 1024,       // 8 KB
  CONSOLE_ENTRIES: 30,          // max 30 entries
  NETWORK_SAMPLE: 512,          // 512 bytes
  DOM_SNIPPET: 3 * 1024         // 3 KB
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
 * @param {Object} userInput - User-provided information (title, steps, expected, actual)
 * @returns {Object} - { title, body } formatted for GitHub
 */
function buildSanitizedIssue(context = {}, userInput = {}) {
  const sections = [];
  
  // Build each section
  const header = buildHeader(context);
  const reproSteps = buildReproSteps(userInput.reproSteps || '');
  const expected = buildExpected(userInput.expected || '');
  const actual = buildActual(userInput.actual || '');
  const jsError = buildJsError(context.jsError);
  const consoleLogs = buildConsoleLogs(context.consoleLogs);
  const networkSample = buildNetworkSample(context.networkRequests);
  const domSnippet = buildDomSnippet(context.htmlSnippet);
  
  // Add sections in order (omit empty ones)
  if (header) sections.push(header);
  if (reproSteps) sections.push(reproSteps);
  if (expected) sections.push(expected);
  if (actual) sections.push(actual);
  if (jsError) sections.push(jsError);
  if (consoleLogs) sections.push(consoleLogs);
  if (networkSample) sections.push(networkSample);
  if (domSnippet) sections.push(domSnippet);
  
  // Join sections with double newline
  let body = sections.join('\n\n');
  
  // Apply overall size limit
  const bodySizeBytes = new Blob([body]).size;
  if (bodySizeBytes > LIMITS.OVERALL) {
    body = truncateToBytes(body, LIMITS.OVERALL);
    body += '\n\n[…] truncated';
  }
  
  // Add context hash for determinism
  const contextHash = generateContextHash(context);
  body += `\n\nContext-Hash: ${contextHash}`;
  
  // Sanitize and format title
  const title = sanitizeTitle(userInput.title || context.title || 'Issue Report');
  
  return { title, body };
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
 * Builds reproduction steps section
 */
function buildReproSteps(steps) {
  if (!steps || !steps.trim()) return '';
  
  let content = redactText(steps);
  content = collapseWhitespace(content);
  
  if (new Blob([content]).size > LIMITS.REPRO_STEPS) {
    content = truncateToBytes(content, LIMITS.REPRO_STEPS);
    return wrapInDetails('Reproduction Steps (truncated)', content);
  }
  
  return `## Reproduction Steps\n\n${content}`;
}

/**
 * Builds expected behavior section
 */
function buildExpected(expected) {
  if (!expected || !expected.trim()) return '';
  
  let content = redactText(expected);
  content = collapseWhitespace(content);
  
  if (new Blob([content]).size > LIMITS.EXPECTED) {
    content = truncateToBytes(content, LIMITS.EXPECTED);
    return wrapInDetails('Expected Behavior (truncated)', content);
  }
  
  return `## Expected Behavior\n\n${content}`;
}

/**
 * Builds actual behavior section
 */
function buildActual(actual) {
  if (!actual || !actual.trim()) return '';
  
  let content = redactText(actual);
  content = collapseWhitespace(content);
  
  if (new Blob([content]).size > LIMITS.ACTUAL) {
    content = truncateToBytes(content, LIMITS.ACTUAL);
    return wrapInDetails('Actual Behavior (truncated)', content);
  }
  
  return `## Actual Behavior\n\n${content}`;
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
 * Builds console logs section (WARN/ERROR only, last 30 entries or 8 KB)
 */
function buildConsoleLogs(logs) {
  if (!logs || !Array.isArray(logs)) return '';
  
  // Filter to WARN and ERROR only
  const filtered = logs.filter(log => 
    log.type === 'warn' || log.type === 'error'
  );
  
  if (filtered.length === 0) return '';
  
  // Take last 30 entries
  const recent = filtered.slice(-LIMITS.CONSOLE_ENTRIES);
  
  // Deduplicate consecutive identical lines
  const deduped = deduplicateConsecutive(recent);
  
  // Format logs
  const formatted = deduped.map(log => {
    const time = log.timestamp ? new Date(log.timestamp).toISOString() : '';
    const message = redactText(log.message || '');
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
 */
function sanitizeDomSnippet(html) {
  if (!html) return '';
  
  let sanitized = html;
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove inline event handlers (on* attributes)
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

// Export for use in background.js (ES module)
export { buildSanitizedIssue, sanitizeTitle, redactText };

