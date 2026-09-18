// Service worker de UdelarHITS — ÚNICO propósito: recibir notificaciones push.
//
// Archivo plano a propósito: sin import, sin Workbox, sin vite-plugin-pwa y sin
// precaching. Vite copia public/ verbatim a la raíz de dist/ sin hash en el
// nombre, que es justo lo que hace falta: el scope de un service worker es la
// carpeta desde la que se sirve, así que tiene que quedar en "/" para controlar
// toda la app. El backend lo sirve con Cache-Control: no-cache (ver app.js): un
// service worker cacheado es imposible de actualizar.
//
// No cachea nada. Si en el futuro se quiere modo offline, eso es otra decisión
// y otro archivo — acá no se mete precaching por las dudas.

const ICON = '/android-chrome-192x192.png';

// skipWaiting + clients.claim: la versión nueva toma el control sin esperar a
// que el usuario cierre todas las pestañas. Es seguro porque el worker no
// cachea nada, así que no hay riesgo de mezclar assets de dos versiones.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    // El payload siempre lo arma el backend como JSON, pero un push mal formado
    // (o una prueba manual desde DevTools) no puede romper el handler: sin
    // showNotification el navegador muestra igual una notificación genérica.
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'UdelarHITS';
  const options = {
    body: data.body || 'Tenés una notificación nueva',
    icon: ICON,
    badge: ICON,
    // El tag deduplica en el SO: un push nuevo del mismo tipo reemplaza al
    // anterior en vez de apilarse.
    tag: data.tag || 'udelarhits',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const raw = (event.notification.data && event.notification.data.url) || '/';
  // Resolver contra el origen propio: el backend manda rutas relativas y
  // clients.openWindow necesita una URL absoluta.
  const target = new URL(raw, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reusar una ventana ya abierta de la app en vez de abrir otra: con la PWA
      // instalada, abrir una segunda ventana es desconcertante.
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
