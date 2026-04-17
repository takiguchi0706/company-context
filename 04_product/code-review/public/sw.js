const CACHE_NAME = 'code-review-v1';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const API_CACHE = `${CACHE_NAME}-api`;
const RUNTIME_CACHE = `${CACHE_NAME}-runtime`;

// キャッシュ対象の静的リソース
const STATIC_ASSETS = [
  '/',
  '/explain',
  '/api/preload/warmup',
  // フォント
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap',
  // 必須JavaScript/CSSは自動でキャッシュされる
];

// キャッシュ戦略
const CACHE_STRATEGIES = {
  static: 'cache-first',
  api: 'network-first',
  runtime: 'stale-while-revalidate'
};

// Service Worker インストール
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // 静的アセットをプリキャッシュ
      caches.open(STATIC_CACHE).then((cache) => 
        cache.addAll(STATIC_ASSETS)
      ),
      // 即座にアクティベート
      self.skipWaiting()
    ])
  );
});

// Service Worker アクティベート
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // 古いキャッシュを削除
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.startsWith(CACHE_NAME))
            .map((cacheName) => caches.delete(cacheName))
        )
      ),
      // 全てのクライアントを制御
      self.clients.claim()
    ])
  );
});

// フェッチイベント処理
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 同一オリジンのリクエストのみ処理
  if (url.origin !== location.origin) return;

  // API リクエストの処理
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // 静的リソースの処理
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style') {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // その他のリソース（画像等）
  event.respondWith(handleRuntimeRequest(request));
});

// API リクエスト処理（ネットワーク優先）
async function handleApiRequest(request) {
  try {
    // ネットワークを試行
    const response = await fetch(request);
    
    // 成功した場合はキャッシュに保存
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // ネットワークエラー時はキャッシュから取得
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // キャッシュもない場合はエラーレスポンス
    return new Response(
      JSON.stringify({ error: 'オフラインです。ネットワーク接続を確認してください。' }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 静的リソース処理（キャッシュ優先）
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // フォールバック：基本的なHTML
    if (request.destination === 'document') {
      return cache.match('/');
    }
    throw error;
  }
}

// ランタイムリソース処理（Stale While Revalidate）
async function handleRuntimeRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);
  
  // キャッシュがある場合は即座に返し、バックグラウンドで更新
  if (cachedResponse) {
    // バックグラウンドで更新
    fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {}); // エラーは無視
    
    return cachedResponse;
  }
  
  // キャッシュがない場合は通常フェッチ
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    throw error;
  }
}

// メッセージ処理（キャッシュ制御用）
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'CACHE_CLEAR':
      handleCacheClear(data.cacheType);
      break;
    case 'CACHE_PRELOAD':
      handleCachePreload(data.urls);
      break;
    default:
      break;
  }
});

// キャッシュクリア
async function handleCacheClear(cacheType) {
  if (cacheType === 'all') {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  } else {
    const cacheName = `${CACHE_NAME}-${cacheType}`;
    await caches.delete(cacheName);
  }
}

// プリロード
async function handleCachePreload(urls) {
  const cache = await caches.open(RUNTIME_CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn('プリロード失敗:', url, error);
      }
    })
  );
}