// sw.js — FRESH-FIRST: the network is the truth, the cache is the airplane.
// Two staleness layers were learned live: (1) a cache-first shell hid a fresh
// control for a whole visit; (2) even fetching "fresh", the browser HTTP cache
// (Pages max-age=600) handed the new SW a stale module to bake into its new
// cache — mixed versions on one page. So every fetch here REVALIDATES with the
// server ({cache:"no-cache"} → a cheap 304 when nothing changed). Online:
// always current. Offline: the room still boots from the last good copy.
// ⚠ bump CACHE per deploy anyway — activate sweeps the old airplane copies.
const CACHE = "holoroulette6";
const SHELL = ["./", "./index.html", "./strings.mjs", "./roulette.mjs", "./session.mjs",
  "./wire.mjs", "./broker-door.mjs", "../vendor/holo-fabric.mjs"];
const fresh = (req) => fetch(req, { cache: "no-cache" });
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(SHELL.map((u) => fresh(u).then((r) => { if (r.ok) return c.put(u, r); })))
  ).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fresh(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
