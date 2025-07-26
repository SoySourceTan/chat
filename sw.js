// sw.js の先頭付近にでも追加
// Version 2.0.1 (または日付など)
console.log('Service Worker is running. Version: 2.0.1');

// sw.js
// このファイルは /chat/sw.js (GitHub Pages) または /learning/english-words/chat/sw.js (localhost) に配置されます。

// Firebase Cloud Messaging Service Workerをインポート
importScripts('./firebase-messaging-sw.js'); // 修正: 相対パスを使用

const CACHE_NAME = 'chat-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './images/icon.png', // このパスはService Workerのスコープからの相対パスです。
  './favicon.ico',
  './notifysound.js', // 修正: sw.js と同じディレクトリに配置
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.4.1/purify.min.js',
   'https://unpkg.com/scrollreveal@4.0.9/dist/scrollreveal.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js'
];

self.addEventListener('install', (event) => {
  console.log('[sw.js] サービスワーカーインストール');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[sw.js] キャッシュに追加中:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) 
  );
});

self.addEventListener('activate', (event) => {
  console.log('[sw.js] サービスワーカーアクティベート');
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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Firebase SDKからのリクエスト、またはPHP設定ファイルへのリクエストはネットワーク優先で処理（FCMに必要）
  // trextacy.com のPHPファイルへのリクエストは常にネットワークから取得します。
  if (event.request.url.includes('firebasejs') || 
      event.request.url.includes('firebaseremoteconfig.googleapis.com') || 
      event.request.url.includes('fcm.googleapis.com') ||
      event.request.url.includes('trextacy.com/chat/firebase-config.php')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});