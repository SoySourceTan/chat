// キャッシュ名
const CACHE_NAME = 'aura-chat-v1';

// キャッシュするリソース
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'script.js',
  'notify.js',
  'script-nofiti.js',
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
  // すぐにアクティブ化
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
  event.respondWith(
    caches.match(event.request).then((response) => {
      // キャッシュがあれば返す
      if (response) {
        return response;
      }
      // ネットワークから取得
      return fetch(event.request).then((networkResponse) => {
        // リクエストが成功した場合、キャッシュに保存
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch((error) => {
        console.error('[sw.js] フェッチエラー:', error);
        // オフラインページ（オプション）
        return caches.match('offline.html');
      });
    }).catch((error) => {
      console.error('[sw.js] キャッシュマッチエラー:', error);
      return caches.match('index.html');
    })
  );
});