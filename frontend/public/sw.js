// Terp Service Worker — handles push notifications

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch {}

  const title   = data.title || '🌬️ Terp';
  const options = {
    body:    data.body  || 'Someone just dabbed!',
    icon:    data.icon  || '/icon-192.png',
    badge:   data.badge || '/badge.png',
    data:    data.data  || {},
    vibrate: [100, 50, 100],
    tag:     'terp-dab',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if (win.url.includes(self.location.origin) && 'focus' in win) {
          win.focus();
          win.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
