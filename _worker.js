export default {
  async fetch(request) {
    const urlObj = new URL(request.url);
    const target = urlObj.searchParams.get("url");

    if (!target) {
      return new Response("Missing ?url", { status: 400 });
    }

    const targetUrl = decodeURIComponent(target);

    const resp = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Referer": "https://megacloud.blog/",
        "Origin": "https://megacloud.blog"
      }
    });

    let contentType = resp.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let html = await resp.text();

      html = html.replace(
        /(https?:\/\/[^\s"'<>]+)/g,
        (match) =>
          `${urlObj.origin}/?url=${encodeURIComponent(match)}`
      );

      return new Response(html, {
        headers: { "Content-Type": "text/html" }
      });
    }

    return new Response(resp.body, {
      headers: resp.headers
    });
  }
};