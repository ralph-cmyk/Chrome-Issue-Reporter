/**
 * Cloudflare Worker for Extension Auto-Updates
 * 
 * This Worker serves:
 * 1. update.xml - Chrome extension update manifest
 * 2. Extension ZIP files - The actual extension packages
 * 
 * All files are served from Cloudflare R2 bucket.
 * 
 * Setup Instructions:
 * 1. Create a new Cloudflare Worker named "chrome-issue-reporter-updates"
 * 2. Paste this code into the Worker
 * 3. Add R2 bucket binding:
 *    - Binding name: UPDATES_BUCKET
 *    - R2 bucket: Your bucket name (e.g., chrome-issue-reporter-screenshots)
 * 4. Deploy the Worker
 * 5. Your update URL will be: https://chrome-issue-reporter-updates.YOUR-ACCOUNT.workers.dev/update.xml
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      // Route: POST /upload - secure screenshot uploads to R2
      if (url.pathname === '/upload') {
        if (request.method !== 'POST') {
          return withCors(new Response('Method not allowed', { status: 405 }));
        }
        return await handleScreenshotUpload(request, env, url);
      }

      // Route: GET /screenshots/* - serve uploaded screenshots from R2
      if (url.pathname.startsWith('/screenshots/')) {
        if (request.method !== 'GET') {
          return withCors(new Response('Method not allowed', { status: 405 }));
        }
        const name = url.pathname.replace('/screenshots/', '');
        return await serveScreenshot(env, name);
      }

      // Only allow GET requests for the remaining routes
      if (request.method !== 'GET') {
        return withCors(new Response('Method not allowed', { status: 405 }));
      }

      // Route: /update.xml - Extension update manifest
      if (url.pathname === '/update.xml') {
        return await serveUpdateXml(env);
      }

      // Route: /download - now shows landing (no auto-download)
      if (url.pathname === '/download') {
        return await renderLanding(env);
      }

      // Route: /extensions/* - Extension ZIP files
      if (url.pathname.startsWith('/extensions/')) {
        const filename = url.pathname.replace('/extensions/', '');
        return await serveExtensionZip(env, filename);
      }

      // Route: / - Landing page
      if (url.pathname === '/') {
        return await renderLanding(env);
      }

      // 404 for other routes
      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('Worker error:', error);
      return withCors(new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      ));
    }
  },
};

async function serveUpdateXml(env) {
  try {
    // Fetch update.xml from R2
    const object = await env.UPDATES_BUCKET.get('update.xml');

    if (!object) {
      return withCors(new Response('Update manifest not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
        },
      }));
    }

    // Return the XML file
    return withCors(new Response(object.body, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    }));
  } catch (error) {
    console.error('Error serving update.xml:', error);
    return withCors(new Response('Error fetching update manifest', { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    }));
  }
}

async function serveExtensionZip(env, filename) {
  try {
    // Validate filename to prevent path traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return withCors(new Response('Invalid filename', { 
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      }));
    }

    // Only allow .zip files
    if (!filename.endsWith('.zip')) {
      return withCors(new Response('Only ZIP files are allowed', { 
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      }));
    }

    // Fetch from R2
    const object = await env.UPDATES_BUCKET.get(`extensions/${filename}`);

    if (!object) {
      return withCors(new Response('Extension file not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
        },
      }));
    }

    // Return the ZIP file
    return withCors(new Response(object.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year (immutable)
      },
    }));
  } catch (error) {
    console.error('Error serving extension ZIP:', error);
    return withCors(new Response('Error fetching extension file', { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    }));
  }
}

async function serveLatestZip(env) {
  // Convenience: fetch latest ZIP from a well-known key and serve it.
  // Default key: extensions/chrome-issue-reporter-latest.zip
  const key = env.LATEST_ZIP_KEY || 'extensions/chrome-issue-reporter-latest.zip';

  if (!key.endsWith('.zip') || key.includes('..') || key.startsWith('/')) {
    return withCors(new Response('Invalid latest ZIP key', { status: 500 }));
  }

  const object = await env.UPDATES_BUCKET.get(key);
  if (!object) {
    return withCors(new Response('Latest ZIP not found', { status: 404 }));
  }

  const filename = key.split('/').pop() || 'extension.zip';

  return withCors(new Response(object.body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=600', // short cache to reflect swaps
    },
  }));
}

async function renderLanding(env) {
  const meta = await getUpdateMeta(env);
  const version = meta?.version || 'Unknown';
  const codebase = meta?.codebase || '/extensions/chrome-issue-reporter-latest.zip';
  const features = [
    'Capture console logs, HTML context, and screenshots',
    'GitHub OAuth device flow with repo picker',
    'Context menu + popup workflow for quick issue filing',
    'Automatic updates via Cloudflare Worker + R2',
  ];
  const changes = [
    'Added friendly /download latest ZIP endpoint',
    'Clarified auto-update docs and worker wiring',
    'Packaged build v21.0.1 with update_url set',
  ];

  const featureList = features.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const changeList = changes.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Chrome Issue Reporter - Download</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        :root {
          color-scheme: light dark;
          --bg: #0f172a;
          --panel: #111827;
          --text: #e5e7eb;
          --muted: #94a3b8;
          --accent: #7c3aed;
          --accent-2: #22d3ee;
          --border: #1f2937;
        }
        @media (prefers-color-scheme: light) {
          :root {
            --bg: #f8fafc;
            --panel: #ffffff;
            --text: #0f172a;
            --muted: #475569;
            --accent: #6d28d9;
            --accent-2: #0ea5e9;
            --border: #e2e8f0;
          }
        }
        body {
          margin: 0;
          background: radial-gradient(circle at 20% 20%, rgba(124, 58, 237, 0.08), transparent 25%),
                      radial-gradient(circle at 80% 0%, rgba(14, 165, 233, 0.08), transparent 22%),
                      var(--bg);
          color: var(--text);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          min-height: 100vh;
        }
        .container {
          max-width: 960px;
          margin: 48px auto;
          padding: 0 20px 64px;
        }
        .hero {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.14), rgba(34, 211, 238, 0.12));
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px;
          box-shadow: 0 20px 70px rgba(0, 0, 0, 0.25);
        }
        h1 {
          margin: 0 0 6px;
          font-size: 26px;
          letter-spacing: -0.02em;
        }
        .sub {
          margin: 0;
          color: var(--muted);
          font-size: 15px;
        }
        .meta {
          margin-top: 16px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .pill {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 13px;
          color: var(--muted);
        }
        .actions {
          margin-top: 24px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-radius: 12px;
          border: 1px solid transparent;
          text-decoration: none;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: #fff;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          box-shadow: 0 12px 30px rgba(124, 58, 237, 0.25);
          transition: transform 150ms ease, box-shadow 150ms ease;
        }
        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 34px rgba(124, 58, 237, 0.32);
        }
        .btn.secondary {
          background: transparent;
          color: var(--text);
          border-color: var(--border);
          box-shadow: none;
        }
        .grid {
          margin-top: 28px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
        }
        .card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 18px 18px 16px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
        }
        .card h3 {
          margin: 0 0 10px;
          font-size: 16px;
        }
        ul {
          margin: 0;
          padding-left: 18px;
          color: var(--muted);
          line-height: 1.55;
          font-size: 14px;
        }
        code {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 2px 6px;
          font-size: 13px;
        }
        .footer {
          margin-top: 26px;
          color: var(--muted);
          font-size: 13px;
        }
        @media (max-width: 640px) {
          .hero { padding: 22px; }
          h1 { font-size: 22px; }
          .btn { width: 100%; justify-content: center; }
          .actions { flex-direction: column; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="hero">
          <h1>Chrome Issue Reporter</h1>
          <p class="sub">Capture page context and ship GitHub issues fast.</p>
          <div class="meta">
            <span class="pill">Latest version: ${escapeHtml(version)}</span>
            <span class="pill">Auto-updates enabled</span>
            <span class="pill">Update URL: /update.xml</span>
          </div>
          <div class="actions">
            <a class="btn" href="${escapeAttr(codebase)}">⬇️ Download & Install</a>
            <a class="btn secondary" href="/update.xml">View update.xml</a>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <h3>What you get</h3>
            <ul>${featureList}</ul>
          </div>
          <div class="card">
            <h3>Recent changes</h3>
            <ul>${changeList}</ul>
          </div>
          <div class="card">
            <h3>How updates work</h3>
            <ul>
              <li>Install once via the ZIP (drag-drop in chrome://extensions).</li>
              <li>Chrome fetches <code>/update.xml</code> every few hours.</li>
              <li>New ZIPs are served from <code>/extensions/</code> (and /download).</li>
            </ul>
          </div>
        </div>

        <p class="footer">
          Served by Cloudflare Workers + R2 • Update manifest: /update.xml • Latest ZIP: /download
        </p>
      </div>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

async function getUpdateMeta(env) {
  try {
    const object = await env.UPDATES_BUCKET.get('update.xml');
    if (!object) return null;
    const xml = await new Response(object.body).text();
    return parseUpdateXml(xml);
  } catch (err) {
    console.error('Failed to read update.xml for landing:', err);
    return null;
  }
}

function parseUpdateXml(xml) {
  const versionMatch = xml.match(/version=['"]([^'"]+)['"]/);
  const codebaseMatch = xml.match(/codebase=['"]([^'"]+)['"]/);
  return {
    version: versionMatch ? versionMatch[1] : undefined,
    codebase: codebaseMatch ? codebaseMatch[1] : undefined,
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handleScreenshotUpload(request, env, url) {
  try {
    const formData = await request.formData();
    const screenshot = formData.get('screenshot');

    if (!screenshot || !(screenshot instanceof File)) {
      return withCors(new Response('No screenshot file provided', { status: 400 }));
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const name = `${timestamp}-${randomId}.jpg`;
    const key = `screenshots/${name}`;

    await env.UPDATES_BUCKET.put(key, screenshot, {
      httpMetadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=1209600' // 14 days
      }
    });

    return withCors(new Response(JSON.stringify({ success: true, url: `${url.origin}/screenshots/${name}`, key }), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    console.error('Upload error:', error);
    return withCors(new Response(JSON.stringify({ success: false, error: error.message || 'Upload failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
}

async function serveScreenshot(env, name) {
  // Prevent path traversal / weird keys. We only serve the flat names we generate.
  if (!name || name.includes('..') || name.includes('/') || !/^[a-zA-Z0-9_-]+\.jpg$/.test(name)) {
    return withCors(new Response('Invalid screenshot name', { status: 400 }));
  }

  const key = `screenshots/${name}`;
  const object = await env.UPDATES_BUCKET.get(key);
  if (!object) {
    return withCors(new Response('Not Found', { status: 404 }));
  }

  return withCors(new Response(object.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=1209600'
    }
  }));
}
