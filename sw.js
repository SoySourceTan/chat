// キャッシュ名
const CACHE_NAME = 'aura-chat-v2'; // バージョン更新

// キャッシュするリソース
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'script.js',
  'notify.js',
  'images/icon-192x192.png',
  'images/icon-512x512.png',
  'images/icon.png'
];

// インストールイベント
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[sw.js] キャッシュをオープン');
      return cache.addAll(urlsToCache);
    }).catch((error) => {
      console.error('[sw.js] キャッシュ追加エラー:', error);
    })
  );
  self.skipWaiting();
});

// アクティベートイベント
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[sw.js] 古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[sw.js] アクティベート完了');
      return self.clients.claim();
    }).catch((error) => {
      console.error('[sw.js] アクティベートエラー:', error);
    })
  );
});

// フェッチイベント
self.addEventListener('fetch', (event) => {
  // Firebase API リクエストはキャッシュせず、常にネットワークから取得
  if (event.request.url.includes('firebase')) {
    event.respondWith(fetch(event.request).catch((error) => {
      console.error('[sw.js] Firebase フェッチエラー:', error);
      return new Response('Network error', { status: 503 });
    }));
    return;
  }

  // ネットワーク優先戦略
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      // ネットワークから取得したリソースをキャッシュ
      if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }
      return networkResponse;
    }).catch(() => {
      // ネットワークエラー時（オフライン時）にキャッシュを返す
      return caches.match(event.request).then((response) => {
        return response || caches.match('index.html');
      });
    })
  );
});