export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight (OPTIONS) immediately
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const urlParam = new URL(request.url).searchParams.get('url');
    if (!urlParam) {
      return new Response('Missing url parameter', { status: 400 });
    }

    const targetUrl = decodeURIComponent(urlParam);

    // Build headers for the upstream request
    const headers = new Headers(request.headers);

    // Set required referer/origin – adjust these to match the site you are proxying for
    headers.set('Referer', 'https://hianime.to/');
    headers.set('Origin', 'https://hianime.to');
    headers.set('User-Agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
    headers.set('Accept', '*/*');

    // Preserve the Range header for video streaming (byte ranges)
    // (Cloudflare Workers automatically forward the Range header if present,
    // but we explicitly keep it for clarity)
    if (request.headers.has('range')) {
      headers.set('range', request.headers.get('range'));
    }

    // Forward the request body for non-GET/HEAD methods
    const fetchOptions = {
      method: request.method,
      headers: headers,
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      // For POST/PUT etc., forward the body as a blob
      fetchOptions.body = await request.blob();
    }

    // Perform the upstream fetch
    let response;
    try {
      response = await fetch(targetUrl, fetchOptions);
    } catch (err) {
      return new Response(`Upstream fetch failed: ${err.message}`, { status: 502 });
    }

    // Prepare new response headers (with CORS)
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    // Optional: Modify manifest files (HLS / DASH) to rewrite URLs so that
    // all segments also go through this proxy.
    // This is useful if the client does not already use the proxy for every segment.
    const contentType = response.headers.get('content-type') || '';
    const isManifest = /application\/vnd\.apple\.mpegurl|application\/x-mpegURL|application\/dash\+xml|text\/plain/.test(contentType);

    if (isManifest && response.body) {
      // Read the full manifest (usually small) as text
      const manifestText = await response.text();

      // Get the base URL of the manifest to resolve relative paths
      const manifestBaseUrl = new URL(targetUrl);

      // Replace all absolute or relative URLs with proxied versions
      const proxyBase = new URL(request.url).origin;
      const rewrittenManifest = manifestText.replace(/(https?:\/\/[^\s"']+)|([^#"'\s]+\.(ts|m3u8|mpd|key|webvtt|vtt))/gi, (match) => {
        try {
          // Resolve relative URLs against the manifest's base URL
          const absoluteUrl = new URL(match, manifestBaseUrl).href;
          // Encode the absolute URL and return a proxy URL
          return `${proxyBase}/?url=${encodeURIComponent(absoluteUrl)}`;
        } catch {
          // If URL parsing fails, return the original match
          return match;
        }
      });

      // Return the modified manifest with the original status and updated headers
      return new Response(rewrittenManifest, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // For non‑manifest responses (segments, etc.), stream the body directly
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};