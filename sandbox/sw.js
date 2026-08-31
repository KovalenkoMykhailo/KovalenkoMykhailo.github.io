/* Northgate Console — intercept /api/v1/* so Chrome Network shows the calls.
   The page owns localStorage and handleApi; this worker only proxies. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.includes("/api/v1/")) return;
  event.respondWith(proxyApi(event));
});

async function proxyApi(event) {
  const client = await findClient(event);
  if (!client) {
    return jsonResponse(503, { error: "No page client" });
  }
  const request = event.request;
  const body =
    request.method === "GET" || request.method === "HEAD" ? "" : await request.clone().text();
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      resolve(jsonResponse(504, { error: "API timeout" }));
    }, 5000);
    channel.port1.onmessage = (msg) => {
      clearTimeout(timer);
      const data = msg.data || {};
      if (data.status === 204) {
        resolve(new Response(null, { status: 204 }));
        return;
      }
      resolve(jsonResponse(data.status || 500, data.body));
    };
    client.postMessage(
      {
        type: "ng-api",
        url: request.url,
        method: request.method,
        headers: headers,
        body: body,
      },
      [channel.port2]
    );
  });
}

async function findClient(event) {
  if (event.clientId) {
    const client = await self.clients.get(event.clientId);
    if (client) return client;
  }
  const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  return list[0] || null;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body == null ? {} : body), {
    status: status,
    headers: { "Content-Type": "application/json" },
  });
}
