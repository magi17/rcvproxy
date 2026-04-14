export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response("Missing ?url=", { status: 400 });
    }

    try {
      // Forward request to real stream
      const upstream = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 12)",
          "Referer": "https://example.com", // fake referer (important)
          "Origin": "*"
        }
      });

      // Clone response
      const newHeaders = new Headers(upstream.headers);

      // ✅ Fix CORS (VERY IMPORTANT)
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      newHeaders.set("Access-Control-Allow-Headers", "*");

      return new Response(upstream.body, {
        status: upstream.status,
        headers: newHeaders
      });

    } catch (err) {
      return new Response("Proxy error: " + err.message, { status: 500 });
    }
  }
};