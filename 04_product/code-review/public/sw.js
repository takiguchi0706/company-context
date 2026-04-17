const CACHE_NAME = 'code-review-v1';
const STATIC_CACHE = 'static-v1';
const API_CACHE = 'api-v1';

const STATIC_ASSETS = [
  '/',
  '/explain',
  '/_next/static/css/',
  '/_next/static/chunks/',
  '/favicon.ico',
];

// インストール時の処理
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS.filter(url => !url.endsWith('/')));
    })
  );
  self.skipWaiting();
});

// アクティベート時の処理
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// フェッチ時の処理
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API リクエスト（Network First戦略）
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 成功時のみキャッシュ（説明は重い処理なのでキャッシュする）
          if (response.ok && url.pathname === '/api/review') {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // ネットワークエラー時はキャッシュから
          return caches.match(request);
        })
    );
    return;
  }

  // 静的アセット（Cache First戦略）
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.includes('.css') ||
    url.pathname.includes('.js') ||
    url.pathname.includes('.woff') ||
    url.pathname.includes('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((fetchResponse) => {
          const responseClone = fetchResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return fetchResponse;
        });
      })
    );
    return;
  }

  // HTML ページ（Stale While Revalidate戦略）
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then((response) => {
        const fetchPromise = fetch(request).then((fetchResponse) => {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return fetchResponse;
        });

        return response || fetchPromise;
      })
    );
    return;
  }

  // その他のリクエストはそのまま
  event.respondWith(fetch(request));
});

// バックグラウンド同期
self.addEventListener('sync', (event) => {
  if (event.tag === 'preload-routes') {
    event.waitUntil(preloadImportantRoutes());
  }
});

// 重要なルートをプリロード
async function preloadImportantRoutes() {
  const cache = await caches.open(CACHE_NAME);
  try {
    await cache.addAll(['/explain']);
  } catch (error) {
    console.warn('Failed to preload routes:', error);
  }
}