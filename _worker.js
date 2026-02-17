// _worker.js - Fixed URL rewriting
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    
    // Homepage
    if (!targetUrl) {
      return new Response('Proxy is running! Use ?url=https://example.com', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    try {
      const decodedUrl = decodeURIComponent(targetUrl);
      const target = new URL(decodedUrl);
      const baseDomain = `${target.protocol}//${target.hostname}`;
      const proxyBase = `${url.origin}/?url=`;

      // Prepare headers
      const headers = new Headers({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': baseDomain,
        'Origin': baseDomain,
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
      });

      const proxyRequest = new Request(target, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      });

      const response = await fetch(proxyRequest);
      const responseHeaders = new Headers(response.headers);
      
      // Add CORS headers
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.delete('X-Frame-Options');
      responseHeaders.delete('Content-Security-Policy');

      // Handle HTML content - THIS IS THE KEY FIX
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('text/html')) {
        let html = await response.text();
        
        // Fix all resource URLs to go through proxy
        html = html.replace(
          /(src|href)="(https?:\/\/[^"]+)"/g, 
          (match, attr, url) => `${attr}="${proxyBase}${encodeURIComponent(url)}"`
        );
        
        // Fix relative URLs
        html = html.replace(
          /(src|href)="\/([^"]+)"/g,
          (match, attr, path) => `${attr}="${proxyBase}${encodeURIComponent(baseDomain + '/' + path)}"`
        );
        
        // Fix inline scripts that might create URLs
        html = html.replace(
          /(fetch|XMLHttpRequest)\(['"]([^'"]+)['"]\)/g,
          (match, func, url) => {
            if (url.startsWith('http')) {
              return `${func}('${proxyBase}${encodeURIComponent(url)}')`;
            }
            return match;
          }
        );

        return new Response(html, {
          status: response.status,
          headers: responseHeaders
        });
      }

      // For non-HTML content, pass through
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
};