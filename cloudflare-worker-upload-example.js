/**
 * Cloudflare Worker Example for Secure R2 Screenshot Uploads
 * 
 * This Worker acts as a proxy between the extension and R2, keeping credentials server-side.
 * 
 * Setup:
 * 1. Create a new Cloudflare Worker
 * 2. Paste this code
 * 3. Add R2 bucket binding: In Worker settings, add binding name "SCREENSHOTS_BUCKET" to your R2 bucket
 * 4. Deploy the Worker
 * 5. Use the Worker URL as R2_WORKER_PROXY_URL in extension configuration
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Parse form data
      const formData = await request.formData();
      const screenshot = formData.get('screenshot');

      if (!screenshot || !(screenshot instanceof File)) {
        return new Response('No screenshot file provided', { status: 400 });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const filename = `screenshots/${timestamp}-${randomId}.jpg`;

      // Upload to R2
      await env.SCREENSHOTS_BUCKET.put(filename, screenshot, {
        httpMetadata: {
          contentType: 'image/jpeg',
          cacheControl: 'public, max-age=1209600', // 14 days
        },
      });

      // Get public URL (adjust based on your R2 public URL setup)
      // Option 1: If using R2.dev public URL
      const publicUrl = `https://pub-<your-account-id>.r2.dev/${filename}`;
      
      // Option 2: If using custom domain
      // const publicUrl = `https://screenshots.yourdomain.com/${filename}`;

      // Return JSON response with URL
      return new Response(
        JSON.stringify({
          success: true,
          url: publicUrl,
          filename: filename,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      console.error('Upload error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Upload failed',
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

