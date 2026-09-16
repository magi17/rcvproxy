/**
 * IPTV Stream Proxy — Cloudflare Worker
 * ----------------------------------------
 * Proxies HTTP streams (Converge MPD, HLS, etc.) so they can be
 * played from an HTTPS page without mixed-content or CORS errors.
 *
 * Usage:
 *   https://your-worker.workers.dev/?url=<encoded-stream-url>
 *   https://your-worker.workers.dev/<stream-url-without-protocol>
 *
 * Example:
 *   https://your-worker.workers.dev/?url=http%3A%2F%2F136.158.97.2%3A6610%2F...
 */

// Optional: restrict which hosts your worker can proxy (security).
// Set to null to allow ALL hosts (less secure, more permissive).
const ALLOWED_HOSTS = null;
// Example allow-list:
// const ALLOWED_HOSTS = new Set([
//   '136.158.97.2',
//   '136.239.159.18',
//   '136.239.158.30',
//   '136.239.173.2',
//   '136.239.173.3',
//   '136.239.173.26',
//   '161.49.17.2',
//   '136.239.158.10',
//   '136.239.173.10',
//   '136.239.159.20'
// ]);

// CORS headers added to every response
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // Only allow GET / HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonError('Method not allowed', 405);
    }

    const reqUrl = new URL(request.url);

    // Extract target URL from ?url= query param
    let targetUrl = reqUrl.searchParams.get('url');

    // Fallback: /http://host/path form
    if (!targetUrl && reqUrl.pathname.length > 1) {
      targetUrl = decodeURIComponent(reqUrl.pathname.slice(1));
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'http://' + targetUrl;
      }
    }

    if (!targetUrl) {
      return jsonError('Missing "url" parameter. Usage: /?url=<encoded-url>', 400);
    }

    // Validate URL
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return jsonError('Invalid URL: ' + targetUrl, 400);
    }

    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return jsonError('Only http/https URLs are allowed', 400);
    }

    // Optional host allow-list
    if (ALLOWED_HOSTS && !ALLOWED_HOSTS.has(parsed.hostname)) {
      return jsonError('Host not allowed: ' + parsed.hostname, 403);
    }

    // Build upstream request
    const upstreamHeaders = new Headers();
    // Forward the User-Agent (many IPTV servers require it)
    upstreamHeaders.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');
    upstreamHeaders.set('Accept', '*/*');
    // Forward Range header (important for MPEG-DASH / HLS segment seeking)
    const range = request.headers.get('Range');
    if (range) upstreamHeaders.set('Range', range);
    // Forward Referer if present
    const referer = request.headers.get('Referer');
    if (referer) upstreamHeaders.set('Referer', referer);

    // Fetch upstream
    let upstream;
    try {
      upstream = await fetch(targetUrl, {
        method: request.method,
        headers: upstreamHeaders,
        redirect: 'follow',
        cf: {
          // Cache settings for Cloudflare's edge cache
          cacheTtl: 5,          // short cache for live manifests
          cacheEverything: false
        }
      });
    } catch (err) {
      return jsonError('Upstream fetch failed: ' + err.message, 502);
    }

    // Build response headers
    const respHeaders = new Headers();

    // Preserve content-related headers from upstream
    const passthroughHeaders = [
      'Content-Type',
      'Content-Length',
      'Content-Range',
      'Accept-Ranges',
      'Last-Modified',
      'ETag',
      'Cache-Control',
      'Expires'
    ];
    for (const h of passthroughHeaders) {
      const v = upstream.headers.get(h);
      if (v) respHeaders.set(h, v);
    }

    // CORS
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      respHeaders.set(k, v);
    }

    // Return proxied response with streaming body
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders
    });
  }
};

/* ============================================================
   HELPERS
   ============================================================ */
function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message, status }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}