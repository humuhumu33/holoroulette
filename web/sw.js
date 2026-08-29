// sw.js — instant reload: the room remembers itself (cache-first shell).
// ⚠ bump CACHE per deploy (the televoid staleness law).
const CACHE = "holoroulette2";
const SHELL = ["./", "./index.html", "./strings.mjs", "./roulette.mjs", "./session.mjs",
  "./wire.mjs", "./broker-door.mjs", "../vendor/holo-fabric.mjs"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((hit) => hit ||
    fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    })));
});
