export async function onRequest(context) {
  const url = new URL(context.request.url);
  let target = url.searchParams.get("url");

  if (!target) {
    return new Response("Missing ?url=", { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 12)",
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