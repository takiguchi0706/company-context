// Service Worker for code-review app
// Version: 1.2.0

const CACHE_NAME = 'code-review-v1.2.0';
const STATIC_CACHE_NAME = 'code-review-static-v1.2.0';

// 静的リソース（積極的にキャッシュ）
const STATIC_ASSETS = [
  '/',
  '/explain',
  '/_next/static/css/app/layout.css',
  '/_next/static/css/app/page.css',
  '/_next/static/css/app/globals.css'
];

// キャッシュ可能なリソースパターン
const CACHEABLE_PATTERNS = [
  /\/_next\/static\//,
  /\/api\/github/,
  /\.(?:js|css|woff2?|png|jpg|jpeg|svg)$/
];

// キャッシュしないパターン
const NO_CACHE_PATTERNS = [
  /\/api\/review/,
  /\/api\/chat/,
  /chrome-extension:/
];

// インストール時の処理
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => url));
      })
      .then(() => {
        // 新しいSWを即座にアクティブ化
        return self.skipWaiting();
      })
      .catch(error => {
        console.warn('[SW] Failed to cache static assets:', error);
      })
  );
});

// アクティベート時の処理
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    Promise.all([
      // 古いキャッシュを削除
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 即座にすべてのクライアントをコントロール
      self.clients.claim()
    ])
  );
});

// フェッチイベントの処理
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Chrome拡張のリクエストは無視
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // キャッシュ不要なAPIリクエスト
  if (NO_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return handleAPIRequest(event);
  }

  // 静的リソースの場合
  if (STATIC_ASSETS.some(asset => url.pathname === asset) || 
      CACHEABLE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return handleStaticRequest(event);
  }

  // デフォルト処理（Network First）
  event.respondWith(
    fetch(request)
      .then(response => {
        // 成功レスポンスをキャッシュ
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // ネットワークエラー時はキャッシュから返す
        return caches.match(request);
      })
  );
});

// 静的リソースの処理（Cache First）
function handleStaticRequest(event) {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // バックグラウンドで更新を確認
          fetch(event.request).then(response => {
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
          }).catch(() => {
            // ネットワークエラーは無視
          });
          
          return cachedResponse;
        }

        // キャッシュにない場合はネットワークから取得
        return fetch(event.request).then(response => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
  );
}

// APIリクエストの処理（Network Only）
function handleAPIRequest(event) {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // GitHub APIの結果は短時間キャッシュ
        if (event.request.url.includes('/api/github') && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            // 5分でキャッシュを削除するヘッダーを追加
            const headers = new Headers(responseClone.headers);
            headers.set('sw-cached-at', Date.now().toString());
            headers.set('sw-ttl', '300000'); // 5分
            
            const cachedResponse = new Response(responseClone.body, {
              status: responseClone.status,
              statusText: responseClone.statusText,
              headers
            });
            
            cache.put(event.request, cachedResponse);
          });
        }
        return response;
      })
      .catch(error => {
        console.warn('[SW] API request failed:', error);
        throw error;
      })
  );
}

// メッセージ処理（キャッシュクリア等）
self.addEventListener('message', event => {
  const { data } = event;
  
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      caches.keys().then(async cacheNames => {
        let totalSize = 0;
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
              const text = await response.text();
              totalSize += text.length;
            }
          }
        }
        event.ports[0].postMessage({ size: totalSize });
      })
    );
  }
});

// プリフェッチ処理
self.addEventListener('message', event => {
  if (event.data.type === 'PREFETCH') {
    const { urls } = event.data;
    urls.forEach(url => {
      fetch(url).then(response => {
        if (response.status === 200) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(url, response);
          });
        }
      }).catch(() => {
        // プリフェッチの失敗は無視
      });
    });
  }
});