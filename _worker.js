import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors({
    origin: '*',
    allowHeaders: '*',
    allowMethods: ['GET', 'HEAD', 'OPTIONS'],
    maxAge: 600,
}));

// Helper to extract base domain from a URL (for Referer)
function getBaseDomain(urlString) {
    try {
        const url = new URL(urlString);
        return `${url.protocol}//${url.hostname}`;
    } catch {
        return '';
    }
}

// Proxy all requests
app.all('*', async (c) => {
    const targetUrl = c.req.query('url');
    if (!targetUrl) {
        return c.text('Missing target URL', 400);
    }

    // Decode if it's encoded (the user may or may not encode)
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(targetUrl);
    } catch {
        decodedUrl = targetUrl;
    }

    // Build the target URL
    let url;
    try {
        url = new URL(decodedUrl);
    } catch (e) {
        return c.text('Invalid target URL', 400);
    }

    // Prepare headers for the upstream request
    const headers = new Headers(c.req.headers);
    
    // Important: set Referer and Origin to the target's base domain
    const baseDomain = getBaseDomain(decodedUrl);
    headers.set('Referer', baseDomain);
    headers.set('Origin', baseDomain);
    
    // Set a common User-Agent
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Remove headers that might cause issues
    headers.delete('X-Forwarded-For');
    headers.delete('CF-Connecting-IP');
    headers.delete('CF-Ray');
    headers.delete('CF-Visitor');
    headers.delete('CF-Worker');

    // Build the request to the target
    const targetRequest = new Request(url, {
        method: c.req.method,
        headers: headers,
        body: (c.req.method === 'GET' || c.req.method === 'HEAD') ? null : c.req.body,
    });

    // Fetch the target
    let response;
    try {
        response = await fetch(targetRequest);
    } catch (error) {
        return c.text(`Fetch error: ${error.message}`, 502);
    }

    // Build new response headers
    const newHeaders = new Headers(response.headers);
    
    // Override or add CORS headers
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    
    // Remove headers that prevent embedding
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Content-Security-Policy');
    
    // Ensure Content-Type is preserved (important for video streams)
    // For video streaming, we need to handle range requests properly.
    // The fetch API already handles it if the upstream supports range.
    // Just forward the response as is, but ensure no compression interferes.
    
    // Return the response with modified headers
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
});

export default app;