// _worker.js - Enhanced proxy with proper headers and cookie handling
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    
    // Homepage response
    if (!targetUrl) {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Proxy Server</title>
          <style>
            body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>🔄 Proxy Worker Active</h1>
          <p>Usage: <code>${url.origin}/?url=https://example.com</code></p>
          <h3>Test Links:</h3>
          <ul>
            <li><a href="${url.origin}/?url=${encodeURIComponent('https://example.com')}">Example.com</a></li>
            <li><a href="${url.origin}/?url=${encodeURIComponent('https://httpbin.org/headers')}">httpbin (see headers)</a></li>
          </ul>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    try {
      // Decode the target URL
      const decodedUrl = decodeURIComponent(targetUrl);
      const target = new URL(decodedUrl);
      
      // Get the base domain for referer
      const baseDomain = `${target.protocol}//${target.hostname}`;
      
      // Prepare headers that mimic a real browser
      const headers = new Headers({
        // Essential headers
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': baseDomain,
        'Origin': baseDomain,
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive'
      });

      // Copy over any cookies from the original request
      const cookie = request.headers.get('Cookie');
      if (cookie) {
        headers.set('Cookie', cookie);
      }

      // Forward the request
      const proxyRequest = new Request(target, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'follow'
      });

      // Fetch with longer timeout
      const response = await fetch(proxyRequest, {
        timeout: 30000 // 30 seconds
      });

      // Create new response with modified headers
      const responseHeaders = new Headers(response.headers);
      
      // Add CORS headers
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      
      // Remove blocking headers
      responseHeaders.delete('X-Frame-Options');
      responseHeaders.delete('Content-Security-Policy');
      responseHeaders.delete('Frame-Options');
      
      // Handle redirects properly
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (location) {
          // Make sure redirects go through the proxy too
          const redirectUrl = new URL(location, target);
          const proxyRedirect = `${url.origin}/?url=${encodeURIComponent(redirectUrl.toString())}`;
          responseHeaders.set('Location', proxyRedirect);
        }
      }

      // Process HTML content to rewrite URLs
      if (response.headers.get('Content-Type')?.includes('text/html')) {
        const text = await response.text();
        
        // Rewrite relative URLs to absolute
        const modified = text
          .replace(/src="\/(?!\/)/g, `src="${baseDomain}/`)
          .replace(/href="\/(?!\/)/g, `href="${baseDomain}/`)
          .replace(/src='\/(?!\/)/g, `src='${baseDomain}/`)
          .replace(/href='\/(?!\/)/g, `href='${baseDomain}/`)
          // Also rewrite any URLs that might be absolute but need to go through proxy
          .replace(/(src|href)="(https?:\/\/[^"]+)"/g, (match, attr, url) => {
            // Don't proxy data URLs or same-domain URLs
            if (url.includes(target.hostname) || url.startsWith('data:')) {
              return match;
            }
            // Proxy external resources
            return `${attr}="${url.origin}/?url=${encodeURIComponent(url)}"`;
          });

        return new Response(modified, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }

      // For non-HTML content (videos, etc), just pass through
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      return new Response(`Proxy Error: ${error.message}`, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};