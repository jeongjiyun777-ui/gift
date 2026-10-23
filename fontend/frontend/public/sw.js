const OFFLINE_CACHE = "jeong-work-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.addAll(["/offline.html", "/icons/notebook-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("jeong-work-offline-") && key !== OFFLINE_CACHE).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

// 업무 데이터와 변경 요청은 캐시하지 않고 기존 서버 연결을 사용합니다.
self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).origin === self.location.origin && new URL(event.request.url).pathname === "/icons/notebook-192.png") {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    return;
  }
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(async () => {
    const offline = await caches.match("/offline.html");
    return offline || new Response("인터넷 연결을 확인해 주세요.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }));
});
