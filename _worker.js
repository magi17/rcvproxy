addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return new Response("Missing ?url=", { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": target
      }
    });

    const headers = new Headers(upstream.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Headers", "*");

    return new Response(upstream.body, {
      status: upstream.status,
      headers
    });

  } catch (e) {
    return new Response("Proxy error: " + e.message, { status: 500 });
  }
}