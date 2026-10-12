// AndroBird offline support: app shell cache-first, map tiles and fonts cached as they are used.
const VERSION = "androbird-v2";
const SHELL = [
  "./", "index.html", "css/app.css", "js/app.js", "js/geo.js", "js/export.js", "js/store.js",
  "data/species.json", "manifest.webmanifest",
  "img/compass.png", "img/compass-night.png", "img/icon-32.png", "img/icon-180.png", "img/icon-192.png", "img/icon-512.png",
  "fonts/fonts.css",
  "fonts/bricolage-grotesque-latin-500-normal.woff2",
  "fonts/bricolage-grotesque-latin-700-normal.woff2",
  "fonts/bricolage-grotesque-latin-ext-500-normal.woff2",
  "fonts/bricolage-grotesque-latin-ext-700-normal.woff2",
  "fonts/ibm-plex-mono-latin-400-normal.woff2",
  "fonts/ibm-plex-mono-latin-500-normal.woff2",
  "fonts/ibm-plex-mono-latin-ext-400-normal.woff2",
  "fonts/ibm-plex-mono-latin-ext-500-normal.woff2",
  "fonts/ibm-plex-sans-latin-400-italic.woff2",
  "fonts/ibm-plex-sans-latin-400-normal.woff2",
  "fonts/ibm-plex-sans-latin-500-normal.woff2",
  "fonts/ibm-plex-sans-latin-600-normal.woff2",
  "fonts/ibm-plex-sans-latin-ext-400-italic.woff2",
  "fonts/ibm-plex-sans-latin-ext-400-normal.woff2",
  "fonts/ibm-plex-sans-latin-ext-500-normal.woff2",
  "fonts/ibm-plex-sans-latin-ext-600-normal.woff2",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/leaflet/images/layers.png", "vendor/leaflet/images/layers-2x.png",
];
const TILE_CACHE = "androbird-tiles";
const MAX_TILES = 1500;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== TILE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const c = await caches.open(TILE_CACHE);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Same-origin app files: cache first, refresh in the background.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        }).catch(() => hit || caches.match("index.html"));
        return hit || net;
      })
    );
    return;
  }

  // Map tiles: network first, fall back to tiles seen before.
  const isTile = /tile\.openstreetmap\.org|tile\.opentopomap\.org|arcgisonline\.com/.test(url.hostname);
  if (isTile) {
    const cacheName = TILE_CACHE;
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(cacheName).then((c) => c.put(req, copy)).then(trimTiles);
        }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || Response.error()))
    );
  }
});
