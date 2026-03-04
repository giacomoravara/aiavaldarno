// ============================================================
// sw.js — Service Worker AIA Sezione Valdarno
// Deve stare nella root per scope globale
// ============================================================

const CACHE_NAME = 'aia-valdarno-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/calendario.html',
  '/css/main.css',
  '/css/admin.css',
];

// ---- Install ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ---- Activate ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ---- Fetch (network-first per API, cache-first per assets) ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Bypass per richieste Supabase e CDN
  if (url.hostname.includes('supabase.co') || url.hostname.includes('jsdelivr.net')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// ---- Push Notification ----
self.addEventListener('push', event => {
  let data = { titolo: 'AIA Valdarno', body: 'Hai una nuova notifica.', url: '/' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.messaggio,
    icon: '/assets/icon-192.png',
    badge: '/assets/badge-72.png',
    tag: 'aia-notifica',
    renotify: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'apri', title: 'Apri' },
      { action: 'chiudi', title: 'Chiudi' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.titolo, options)
  );
});

// ---- Notification Click ----
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'chiudi') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
