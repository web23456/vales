// Versión de caché dinámica: cada vez que actualices el código, cambia este número
const CACHE_VERSION = 'v2.4.0';
const CACHE_NAME = `vales-primera-mano-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalación: descarga y almacena en caché todos los activos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Fuerza a que el nuevo Service Worker tome control de inmediato
  self.skipWaiting();
});

// Activación: elimina cachés viejas para liberar espacio y renovar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Borrando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Network-First para index.html cuando haya internet (con fallback inmediato a caché offline)
// y Cache-First con actualización de fondo para recursos pesados
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Para navegaciones o documentos (index.html), intentamos red primero si hay conexión
  // para capturar cambios al instante. Si no hay internet o falla, responde inmediatamente de la caché.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Si obtuvimos respuesta de la red, actualizamos la copia en caché silenciosamente
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Sin conexión: cargar instantáneamente desde caché offline
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Para el resto de archivos (imágenes, manifest, etc.): Caché primero, pero actualizando caché en red
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallo de red tolerado (offline)
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Escuchar mensaje para forzar actualización inmediata
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
