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
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Route: /update.xml - Extension update manifest
      if (url.pathname === '/update.xml') {
        return await serveUpdateXml(env);
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
            
            <h2>How It Works:</h2>
            <p>This server provides automatic updates for the Chrome extension.</p>
            <ul>
              <li>Chrome checks <code>/update.xml</code> periodically</li>
              <li>If a new version is available, Chrome downloads it from <code>/extensions/</code></li>
              <li>Updates are installed automatically in the background</li>
            </ul>
            
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
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};

async function serveUpdateXml(env) {
  try {
    // Fetch update.xml from R2
    const object = await env.UPDATES_BUCKET.get('update.xml');

    if (!object) {
      return new Response('Update manifest not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Return the XML file
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error serving update.xml:', error);
    return new Response('Error fetching update manifest', { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

async function serveExtensionZip(env, filename) {
  try {
    // Validate filename to prevent path traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return new Response('Invalid filename', { 
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Only allow .zip files
    if (!filename.endsWith('.zip')) {
      return new Response('Only ZIP files are allowed', { 
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Fetch from R2
    const object = await env.UPDATES_BUCKET.get(`extensions/${filename}`);

    if (!object) {
      return new Response('Extension file not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Return the ZIP file
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year (immutable)
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error serving extension ZIP:', error);
    return new Response('Error fetching extension file', { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
