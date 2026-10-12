// AndroBird offline support.
// App files: network first (always the latest version when online), cached copy when offline.
// Map tiles: network first, tiles seen before are kept for offline use.
const PREFIX = "androbird2-";            // each deployment of the app uses its own prefix
const VERSION = PREFIX + "shell-v4";
const TILE_CACHE = "androbird-tiles";  // shared between deployments
const MAX_TILES = 1500;
const SHELL = [
  "./", "index.html", "css/app.css", "js/app.js", "js/geo.js", "js/export.js", "js/store.js", "js/i18n.js", "js/quick.js",
  "js/heading.js", "js/wmm.js", "js/wmm2025.js", "js/examples.js",
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

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith(PREFIX + "shell-") && k !== VERSION) || /^androbird-v\d+$/.test(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const c = await caches.open(TILE_CACHE);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

function networkFirst(req, cacheName, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : null));
    const timer = timeoutMs && setTimeout(() => fromCache().then((hit) => { if (hit && !settled) { settled = true; resolve(hit); } }), timeoutMs);
    fetch(req, { cache: "no-cache" }).then((res) => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(req, copy)).then(() => cacheName === TILE_CACHE && trimTiles());
      }
      if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
    }).catch(() => fromCache().then((hit) => { if (!settled) { settled = true; clearTimeout(timer); resolve(hit || Response.error()); } }));
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return; // not ours
    e.respondWith(networkFirst(req, VERSION, 4000));
    return;
  }
  if (/tile\.openstreetmap\.org|tile\.opentopomap\.org|arcgisonline\.com/.test(url.hostname)) {
    e.respondWith(networkFirst(req, TILE_CACHE, 0));
  }
});
