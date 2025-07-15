// キャッシュ名（コード更新時に変更）
const CACHE_NAME = 'aura-chat-v3';

// キャッシュするリソース（相対 URL）
const urlsToCache = [
  '', // ルート（例: /chat/ や /learning/english-words/chat/）
  'index.html',
  'style.css',
  'script.js',
  'notify.js',
  'script-notify.js', // スペル修正を仮定
  'images/icon-192x192.png',
  'images/icon-512x512.png',
  'images/icon.png'
];

// インストールイベント
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[sw.js] キャッシュをオープン');
      return Promise.all(
        urlsToCache.map((url) => {
          return fetch(url, { cache: 'no-store' }).then((response) => {
            if (!response.ok) {
              console.error(`[sw.js] フェッチ失敗: ${url}, ステータス: ${response.status}`);
              throw new Error(`フェッチ失敗: ${url}`);
            }
            return cache.put(url, response);
          }).catch((error) => {
            console.error(`[sw.js] リソース追加エラー: ${url}, エラー: ${error}`);
            throw error;
          });
        })
      ).then(() => {
        console.log('[sw.js] すべてのリソースをキャッシュ完了');
      });
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

// フェッチイベント（ネットワーク優先）
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('firebase')) {
    event.respondWith(
      fetch(event.request).catch((error) => {
        console.error('[sw.js] Firebase フェッチエラー:', error);
        return new Response('Network error', { status: 503 });
      })
    );
    return;
  }
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(event.request).then((response) => {
        return response || caches.match('index.html');
      });
    })
  );
});