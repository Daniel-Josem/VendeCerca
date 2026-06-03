import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// App shell (manifest inyectado por vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Tiles del mapa: caché 7 días
registerRoute(
  ({ url }) => url.hostname.endsWith('.basemaps.cartocdn.com'),
  new CacheFirst({
    cacheName: 'map-tiles',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 604800 })],
  })
);

// Google Fonts
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts' })
);

// ── FCM: push en background (app cerrada o minimizada) ──
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    // Maneja formato directo, FCM data-only y FCM notification
    const n     = payload.notification || {};
    const d     = payload.data         || {};
    const title = n.title || d.title || payload.title || 'VendeCerca';
    const body  = n.body  || d.body  || payload.body  || '';
    const icon  = n.icon  || d.icon  || payload.icon  || '/icon.svg';
    const url   = d.url   || payload.url || '/dashboard';

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        badge: '/icon.svg',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: { url },
      })
    );
  } catch (_) {}
});

// Clic en notificación → enfocar o abrir la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => !w.closed);
      if (open) return open.navigate(url).then(() => open.focus());
      return clients.openWindow(url);
    })
  );
});
