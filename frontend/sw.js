// Service Worker — DG Limpiezas App
const CACHE_NAME = 'dg-limpiezas-v3.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/components/toast.js',
  '/js/components/partHeader.js',
  '/js/pages/login.js',
  '/js/pages/parte/selector.js',
  '/js/pages/parte/revision.js',
  '/js/pages/parte/inicio.js',
  '/js/pages/parte/checklist.js',
  '/js/pages/parte/fotos.js',
  '/js/pages/parte/cierre.js',
  '/js/pages/parte/exito.js',
  '/js/pages/admin/dashboard.js',
];



// Instalar: cachear recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activar: limpiar cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first para API, cache-first para estáticos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: siempre red (no cachear datos dinámicos)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión. Datos en caché no disponibles para esta operación.' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        })
      )
    );
    return;
  }

  // Estáticos: cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
