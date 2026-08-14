/* StudyRoom service worker */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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