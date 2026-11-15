// Service worker solo para notificaciones push. Sin dependencias ni caché: se sirve desde
// la raíz, sin hash en el nombre, para controlar todo el sitio.

const ICON = '/android-chrome-192x192.png';

// La versión nueva toma el control de inmediato; es seguro porque no cachea nada.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data;
  try {
    // Un push mal formado no debe romper el handler.
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'UdelarHITS';
  const options = {
    body: data.body || 'Tenés una notificación nueva',
    icon: ICON,
    badge: ICON,
    // El tag hace que un push nuevo del mismo tipo reemplace al anterior.
    tag: data.tag || 'udelarhits',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const raw = (event.notification.data && event.notification.data.url) || '/';
  // El backend envía rutas relativas y openWindow necesita una URL absoluta.
  const target = new URL(raw, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reusa una ventana ya abierta en vez de abrir otra.
      for (const client of clientList) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if (typeof client.navigate === 'function') {
          return client.navigate(target).then((c) => (c || client).focus()).catch(() => client.focus());
        }
        return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
