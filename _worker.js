addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response("Missing ?url=", { status: 400 });
    }

    // ✅ Validate URL
    if (!target.startsWith("http")) {
      return new Response("Invalid URL", { status: 400 });
    }

    // ✅ Fetch WITHOUT unsafe headers
    const upstream = await fetch(target);

    // ✅ Clone response safely
    const headers = new Headers(upstream.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Headers", "*");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");

    return new Response(upstream.body, {
      status: upstream.status,
      headers
    });

  } catch (e) {
    return new Response("ERROR 1101 FIXED: " + e.toString(), {
      status: 500
    });
  }
}