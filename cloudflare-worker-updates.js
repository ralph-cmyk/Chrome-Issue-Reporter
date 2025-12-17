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

      // Route: /download - Friendly latest ZIP download
      if (url.pathname === '/download') {
        return await serveLatestZip(env);
      }

      // Route: /extensions/* - Extension ZIP files
      if (url.pathname.startsWith('/extensions/')) {
        const filename = url.pathname.replace('/extensions/', '');
        return await serveExtensionZip(env, filename);
      }

      // Route: / - Info page
      if (url.pathname === '/') {
        return new Response(
          `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Chrome Extension Updates</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 800px;
                margin: 40px auto;
                padding: 0 20px;
                line-height: 1.6;
              }
              h1 { color: #667eea; }
              .endpoint { 
                background: #f5f5f5; 
                padding: 10px; 
                border-radius: 5px;
                margin: 10px 0;
                font-family: monospace;
              }
              .status { color: #28a745; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>🚀 Chrome Extension Update Server</h1>
            <p class="status">✅ Server is running</p>
            
            <h2>Available Endpoints:</h2>
            <div class="endpoint">GET /update.xml - Extension update manifest</div>
            <div class="endpoint">GET /extensions/[filename].zip - Extension packages</div>
            <div class="endpoint">POST /upload - Screenshot upload (multipart/form-data, field: screenshot)</div>
            <div class="endpoint">GET /screenshots/[name].jpg - Serve uploaded screenshots</div>
            
            <h2>How It Works:</h2>
            <p>This server provides automatic updates for the Chrome extension.</p>
            <ul>
              <li>Chrome checks <code>/update.xml</code> periodically</li>
              <li>If a new version is available, Chrome downloads it from <code>/extensions/</code></li>
              <li>Updates are installed automatically in the background</li>
            </ul>
            <p>It can also accept screenshot uploads and serve them back without making your R2 bucket public.</p>
            
            <p><small>Powered by Cloudflare Workers + R2</small></p>
          </body>
          </html>
          `,
          {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache',
            },
          }
        );
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
