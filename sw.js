/* Kampüs service worker
 * Strateji: aynı-köken GET istekleri için NETWORK-FIRST (önce ağ, her başarılı yanıt önbelleğe yazılır;
 * ağ yoksa önbellekten). Böylece kullanıcı asla eski/boş dosyaya takılmaz, çevrimdışıyken de uygulama açılır.
 * Yeni sürüm: VERSION değiştir → activate'te eski önbellekler silinir. */
const VERSION = 'kampus-v10-2026-11-10';
const CACHE = 'kampus-shell-' + VERSION;

// Uygulama kabuğu. index.html'deki css/js etiketleri kurulumda ayrıca otomatik toplanır (liste eskise bile kabuk eksiksiz olur).
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'css/style.css', 'css/mobile.css', 'css/sources.css',
  'js/content.js', 'js/data.js', 'js/core.js', 'js/a11y.js', 'js/main.js',
  'vendor/gsap.min.js', 'vendor/ScrollTrigger.min.js', 'vendor/SplitText.min.js', 'vendor/lenis.min.js', 'vendor/lenis.css', 'vendor/CustomEase.min.js'
];

async function precache() {
  const cache = await caches.open(CACHE);
  const urls = new Set(SHELL);
  try {
    const res = await fetch('index.html', { cache: 'no-store' });
    if (res.ok) {
      const html = await res.clone().text();
      await cache.put('index.html', res.clone());
      await cache.put('./', res);
      for (const m of html.matchAll(/(?:src|href)="([^"#:]+?\.(?:js|css|png|svg|webmanifest)(?:\?[^"]*)?)"/g)) urls.add(m[1]);
    }
  } catch (e) { /* çevrimdışı kurulum: statik listeyle devam */ }
  // Tek bir dosya eksik diye kurulum başarısız olmasın.
  await Promise.all([...urls].map(async (u) => {
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (res.ok) await cache.put(u, res);
    } catch (e) {}
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('kampus-') && k !== CACHE).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.disable(); } catch (e) {} }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => { if (event.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // yalnız aynı köken
  event.respondWith(networkFirst(req, url));
});

async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  try {
    // HTTP önbelleğini de atla: her zaman sunucudaki güncel dosya.
    const res = await fetch(req.url, { cache: 'no-store', credentials: 'same-origin', redirect: 'follow' });
    if (res && res.ok && res.type === 'basic') {
      cache.put(req, res.clone()).catch(() => {});
      if (req.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname)) cache.put('index.html', res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    // Ağ yok → önbellek. Sorgu dizesi (?v=7, ?as=u1) farkını yok say.
    let hit = await cache.match(req) || await cache.match(req, { ignoreSearch: true });
    if (!hit && req.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname)) hit = await cache.match('index.html') || await cache.match('./');
    if (hit) return hit;
    return new Response('Çevrimdışısın ve bu dosya önbellekte yok.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
