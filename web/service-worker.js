/**
 * Service Worker for Overstand PWA
 *
 * Implements intelligent caching strategies for offline functionality:
 * - App Shell: Cache-first for HTML, CSS, JS, fonts
 * - Pyodide Runtime: Cache-first for large Python runtime (~20-30MB)
 * - CDN Libraries: Stale-while-revalidate for external dependencies
 * - Presets: Network-first with cache fallback
 *
 * Build script replaces __BUILD_ID__ and __ENVIRONMENT__ at build time
 */

const CACHE_NAME = 'overstand-v__BUILD_ID__';
const PYODIDE_CACHE = 'pyodide-runtime-v2';
const CDN_CACHE = 'cdn-libraries-v2';
const ENVIRONMENT = '__ENVIRONMENT__';

// Get the base path (works both locally and on GitHub Pages)
const BASE_PATH = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);

// App shell - critical files needed for offline operation
const APP_SHELL = [
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}styles.css`,
  `${BASE_PATH}app.js`,
  `${BASE_PATH}ui.js`,
  `${BASE_PATH}state.js`,
  `${BASE_PATH}pdf_export.js`,
  `${BASE_PATH}pwa_manager.js`,
  `${BASE_PATH}constants.js`,
  `${BASE_PATH}version.json`,
  `${BASE_PATH}fonts/AllertaStencil-Regular.ttf`,
  `${BASE_PATH}manifest.json`
];

// Python modules
const PYTHON_MODULES = [
  `${BASE_PATH}constants.py`,
  `${BASE_PATH}buildprimitives.py`,
  `${BASE_PATH}dimension_helpers.py`,
  `${BASE_PATH}parameter_registry.py`,
  `${BASE_PATH}ui_metadata.py`,
  `${BASE_PATH}preset_loader.py`,
  `${BASE_PATH}radius_template.py`,
  `${BASE_PATH}instrument_geometry.py`,
  `${BASE_PATH}instrument_generator.py`,
  `${BASE_PATH}geometry_engine.py`,
  `${BASE_PATH}svg_renderer.py`,
  `${BASE_PATH}view_generator.py`
];

// Pyodide runtime (large, cache separately)
const PYODIDE_URLS = [
  'https://cdn.jsdelivr.net/pyodide/v0.29.1/full/pyodide.js',
  'https://cdn.jsdelivr.net/pyodide/v0.29.1/full/pyodide.asm.js',
  'https://cdn.jsdelivr.net/pyodide/v0.29.1/full/pyodide.asm.wasm'
];

// CDN libraries
const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/@svgdotjs/svg.js@3.2/dist/svg.min.js',
  'https://cdn.jsdelivr.net/npm/@svgdotjs/svg.panzoom.js@2.1/dist/svg.panzoom.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.7.0/dist/svg2pdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'
];

/**
 * Install event - cache app shell and Python modules immediately
 */
self.addEventListener('install', (event) => {
  console.log(`[ServiceWorker] Installing... (${ENVIRONMENT}, ${CACHE_NAME})`);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell and Python modules');
        return cache.addAll([...APP_SHELL, ...PYTHON_MODULES]);
      })
      .then(() => {
        console.log('[ServiceWorker] Installation complete');
        // In preview environments, skip waiting immediately for faster updates
        // In production, let the PWA manager control the update
        if (ENVIRONMENT === 'preview' || ENVIRONMENT === 'development') {
          console.log('[ServiceWorker] Preview/dev mode - skipping waiting immediately');
          return self.skipWaiting();
        }
        // Production waits for user confirmation via PWA manager
        return Promise.resolve();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log(`[ServiceWorker] Activating... (${ENVIRONMENT}, ${CACHE_NAME})`);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete caches that don't match current version
            if (cacheName !== CACHE_NAME &&
              cacheName !== PYODIDE_CACHE &&
              cacheName !== CDN_CACHE) {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log(`[ServiceWorker] Activation complete - Cache: ${CACHE_NAME}`);
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Strategy 1: App Shell & Python Modules - Cache First
  // These files are essential and rarely change, so serve from cache for speed
  if (APP_SHELL.includes(url.pathname) || PYTHON_MODULES.includes(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          // Not in cache, fetch from network and cache it
          return fetch(request).then((fetchResponse) => {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, fetchResponse.clone());
              return fetchResponse;
            });
          });
        })
        .catch((error) => {
          console.error('[ServiceWorker] Cache-first strategy failed:', error);
          throw error;
        })
    );
    return;
  }

  // Strategy 2: Pyodide Runtime - Cache First (large files)
  // Cache these large files permanently to avoid re-downloading
  if (PYODIDE_URLS.some(pyUrl => request.url.startsWith(pyUrl))) {
    event.respondWith(
      caches.open(PYODIDE_CACHE)
        .then((cache) => {
          return cache.match(request).then((response) => {
            if (response) {
              console.log('[ServiceWorker] Serving Pyodide from cache');
              return response;
            }
            // Not cached yet, fetch and cache
            console.log('[ServiceWorker] Downloading Pyodide runtime...');
            return fetch(request).then((fetchResponse) => {
              // Only cache successful responses
              if (fetchResponse.ok) {
                cache.put(request, fetchResponse.clone());
              }
              return fetchResponse;
            });
          });
        })
    );
    return;
  }

  // Strategy 3: CDN Libraries - Stale While Revalidate
  // Return cached version immediately, but update cache in background
  if (CDN_URLS.some(cdnUrl => request.url.startsWith(cdnUrl))) {
    event.respondWith(
      caches.open(CDN_CACHE)
        .then((cache) => {
          return cache.match(request).then((response) => {
            // Fetch in background to update cache
            const fetchPromise = fetch(request).then((fetchResponse) => {
              if (fetchResponse.ok) {
                cache.put(request, fetchResponse.clone());
              }
              return fetchResponse;
            });

            // Return cached response if available, otherwise wait for network
            return response || fetchPromise;
          });
        })
    );
    return;
  }

  // Strategy 4: Presets - Network First, fallback to cache
  // Presets may update, so try network first but have offline fallback
  if (url.pathname.includes('/presets/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh response
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((response) => {
            if (response) {
              console.log('[ServiceWorker] Serving preset from cache (offline)');
              return response;
            }
            throw new Error('Preset not available offline');
          });
        })
    );
    return;
  }

  // Default: Network only for everything else (API calls, etc.)
  event.respondWith(fetch(request));
});

/**
 * Message event - handle messages from the client
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
