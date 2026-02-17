export default {
  async fetch(request, env, ctx) {
    const urlParam = new URL(request.url).searchParams.get("url");
    if (!urlParam) {
      return new Response("Missing url param", { status: 400 });
    }

    const targetUrl = decodeURIComponent(urlParam);

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Referer": "https://megacloud.blog/",
        "Origin": "https://megacloud.blog",
        "Accept": "*/*"
      }
    });

    const response = await fetch(modifiedRequest);

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Headers", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

    // Stream response directly (important for .ts)
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });
  }
};