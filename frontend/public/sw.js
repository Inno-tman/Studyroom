/* StudyRoom service worker */
const APP_SHELL_CACHE = 'studyroom-app-shell-v1';
const RUNTIME_CACHE = 'studyroom-runtime-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/theme-init.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/favicon-32x32.png',
  '/icons/apple-touch-icon.png'
];

const isApi = (url) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/hubs/');
const isSameOrigin = (url) => url.origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== APP_SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never intercept API / realtime calls: they must hit the server, and
  // offline they fail naturally so the app shows its usual error state.
  if (isApi(url)) return;

  // Navigation requests (including deep links/routes): network-first so we
  // always get fresh assets when online, falling back to the cached app shell
  // when offline so the UI still loads instead of a white screen.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches.open(APP_SHELL_CACHE)
            .then((cache) => cache.match('/index.html'))
            .then((cached) => cached || caches.match('/'))
            .then((cached) =>
              cached || new Response('<!doctype html><title>Offline</title>You are offline.', {
                headers: { 'Content-Type': 'text/html' }
              })
            )
        )
    );
    return;
  }

  // Same-origin static assets (hashed JS/CSS, images, fonts): cache-first will
  // keep the app shell usable offline; when online we refresh in the background.
  if (isSameOrigin(url) && request.destination !== '') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

const CALL_TAG_PREFIX = 'call-';

self.addEventListener('push', (event) => {
  let data = { title: 'StudyRoom', body: '', icon: '/icons/icon-192x192.png', link: '/' };
  try {
    const parsed = event.data ? event.data.json() : {};
    data = { ...data, ...parsed };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  // "call_closed" → dismiss any lingering incoming-call notification for this call.
  if (data.type === 'call_closed' && data.callId) {
    event.waitUntil(
      self.registration.getNotifications().then((notifications) => {
        notifications
          .filter((n) => n.tag === CALL_TAG_PREFIX + data.callId)
          .forEach((n) => n.close());
      })
    );
    return;
  }

  const isCall = data.type === 'incoming_call';
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/icons/icon-192x192.png',
      data: { link: data.link || '/', callId: data.callId || null, callerId: data.callerId || null },
      // Give call notifications their own tag so they replace/close cleanly, and
      // keep them on screen until the user acts on them.
      tag: isCall ? CALL_TAG_PREFIX + data.callId : 'studyroom',
      requireInteraction: isCall
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const link = event.notification?.data?.link || '/';
  const callId = event.notification?.data?.callId || null;
  event.notification.close();

  const openOrFocus = () =>
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'call-resume', callId });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    });

  event.waitUntil(openOrFocus());
});