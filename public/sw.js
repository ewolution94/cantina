/**
 * The offline shell, the same pattern as Fermata's (fermata/public/sw.js).
 *
 * Installed to a home screen, Cantina should open like an app: instantly, and in the lift
 * or the canteen's basement without a signal, still showing the last menu it saw instead of
 * a browser error. The page keeps its own copy of the menu too (localStorage), so this worker
 * only has to bring up the shell, its fonts and the photos.
 *
 * The rules:
 *
 *  - **Navigations go to the network first.** The shell is only served from cache when the
 *    network actually fails, so a deploy always reaches people who keep the app installed.
 *  - **Fingerprinted files go to the cache first.** Everything under /assets/ carries a
 *    content hash, so a hit is always correct.
 *  - **Photos (/img/) go to the cache first**, in their own small cache that is trimmed as
 *    it grows: they're big, they never change under a name, and last week's aren't needed.
 *  - **Everything else of ours is network-first, cache as a fallback** — /api/menu, boot.js,
 *    the icons and the manifest keep their names across deploys.
 *
 * To retire this worker, ship one whose `install` calls `self.registration.unregister()`.
 */

/** Bump to evict everything a previous version cached. */
const VERSION = 'v1';
const SHELL = `cantina-shell-${VERSION}`;
const ASSETS = `cantina-assets-${VERSION}`;
const PHOTOS = `cantina-photos-${VERSION}`;
const MINE = [SHELL, ASSETS, PHOTOS];
const MAX_PHOTOS = 80;

/** The document every route is served from; also the offline fallback. */
const SHELL_URL = '/';

/**
 * The shell, plus the files it names, plus the fonts its stylesheet names. Reading them back
 * out of the HTML is what lets the *first* visit survive going offline: the page's own
 * requests on that visit happen before this worker controls it.
 */
async function precacheShell() {
  const shell = await caches.open(SHELL);
  const response = await fetch(SHELL_URL, { cache: 'reload' });
  if (!storable(response)) return;
  await shell.put(SHELL_URL, response.clone());

  const html = await response.text();
  const named = [...html.matchAll(/["'(](\/[A-Za-z0-9._/-]+\.(?:js|css|svg|png|webmanifest))["')]/g)].map((m) => m[1]);
  const assets = await caches.open(ASSETS);
  await Promise.all(
    [...new Set(named)].map(async (href) => {
      try {
        const file = await fetch(href, { cache: 'reload' });
        if (!storable(file)) return;
        await (href.startsWith('/assets/') ? assets : shell).put(href, file.clone());
        if (href.endsWith('.css')) await precacheFonts(await file.text(), assets);
      } catch {
        // One missing file costs that file offline, nothing more.
      }
    }),
  );
}

async function precacheFonts(css, assets) {
  const fonts = [...css.matchAll(/url\((\/assets\/[A-Za-z0-9._-]+\.woff2)\)/g)].map((m) => m[1]);
  await Promise.all([...new Set(fonts)].map((href) => assets.add(new Request(href, { cache: 'reload' })).catch(() => undefined)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheShell()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !MINE.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Only a real, own-origin 200 is worth keeping. */
function storable(response) {
  return response && response.status === 200 && response.type === 'basic';
}

async function matchIn(cacheName, request) {
  const cache = await caches.open(cacheName);
  return cache.match(request);
}

async function fromCacheFirst(request, cacheName) {
  const hit = await matchIn(cacheName, request);
  if (hit) return hit;
  const response = await fetch(request);
  if (storable(response)) {
    const copy = response.clone();
    void caches.open(cacheName).then(async (cache) => {
      await cache.put(request, copy);
      if (cacheName === PHOTOS) await trim(cache, MAX_PHOTOS);
    });
  }
  return response;
}

/** Oldest first: Cache.keys() returns entries in insertion order. */
async function trim(cache, max) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

async function fromNetworkFirst(request, cacheName) {
  try {
    // `no-store`, or "network first" quietly becomes "HTTP cache first".
    const response = await fetch(request, { cache: 'no-store' });
    if (storable(response)) {
      const copy = response.clone();
      void caches.open(cacheName).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch (error) {
    const hit = await matchIn(cacheName, request);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/healthz') return;

  if (request.mode === 'navigate') {
    // Every route (/elbe, /bonprix/2026-10-05 …) is served the same document, so one cached
    // entry answers all of them.
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request.url, { cache: 'no-store', credentials: 'same-origin' });
          if (storable(response)) {
            const copy = response.clone();
            void caches.open(SHELL).then((cache) => cache.put(SHELL_URL, copy));
          }
          return response;
        } catch {
          return (await matchIn(SHELL, SHELL_URL)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(fromCacheFirst(request, ASSETS));
    return;
  }
  if (url.pathname.startsWith('/img/')) {
    event.respondWith(fromCacheFirst(request, PHOTOS));
    return;
  }

  event.respondWith(fromNetworkFirst(request, SHELL));
});
