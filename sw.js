const CACHE_NAME = 'aura-chat-v3';

const urlsToCache = [
  '', // ルート（例: /chat/ や /learning/english-words/chat/）
  'index.html',
  'style.css',
  'script.js',
  'notify.js',
  'script-notify.js',
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

// FCMの処理を追加
try {
  importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');
} catch (error) {
  console.error('[sw.js] importScriptsエラー:', error);
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'ERROR', message: 'スクリプトの読み込みに失敗しました: ' + error.message });
    });
  });
}

// Firebase設定を外部から取得
async function loadFirebaseConfig() {
  try {
    const response = await fetch('https://trextacy.com/chat/firebase-config.php', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`HTTPエラー: ステータス ${response.status}`);
    }
    const config = await response.json();
    return config;
  } catch (error) {
    console.error('[sw.js] Firebase設定取得エラー:', error);
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'ERROR', message: 'Firebase設定の取得に失敗しました: ' + error.message });
      });
    });
    throw error;
  }
}

try {
  loadFirebaseConfig().then(firebaseConfig => {
    console.log('[sw.js] 設定取得成功:', firebaseConfig);
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    console.log('[sw.js] Messaging 初期化成功');

    // バックグラウンド通知
    messaging.onBackgroundMessage((payload) => {
      console.log('[sw.js] バックグラウンドメッセージ受信:', payload);
      const notificationTitle = payload.notification.title;
      const isLocalhost = self.location.hostname === 'localhost';
      const iconPath = isLocalhost ? '/learning/english-words/chat/images/icon.png' : '/chat/images/icon.png';
      
      const notificationOptions = {
        body: payload.notification.body,
        icon: iconPath,
        badge: iconPath,
        vibrate: [200, 100, 200],
        data: payload.data,
        actions: [{ action: 'open', title: '開く' }]
      };
      
      try {
        self.registration.showNotification(notificationTitle, notificationOptions);
        console.log('[sw.js] 通知表示成功:', notificationTitle);
      } catch (error) {
        console.error('[sw.js] 通知表示エラー:', error);
      }
    });
  }).catch(error => {
    console.error('[sw.js] FCM初期化エラー:', error);
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'ERROR', message: 'Service Worker の初期化に失敗しました: ' + error.message });
      });
    });
  });
} catch (error) {
  console.error('[sw.js] 初期化エラー:', error);
}

self.addEventListener('notificationclick', (event) => {
  console.log('[sw.js] 通知クリック:', event);
  event.notification.close();
  const url = event.notification.data?.url || 'https://soysourcetan.github.io/chat/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[sw.js] プッシュサブスクリプション変更:', event);
  // 必要に応じて再サブスクライブ処理を追加
});