const CACHE_NAME = 'chat-cache-v1';

let messaging;
let isFCMInitialized = false;

self.addEventListener('install', (event) => {
    console.log('[sw.js] サービスワーカーインストール');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('[sw.js] サービスワーカーアクティベート');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[sw.js] 古いキャッシュ削除:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

async function initializeFirebase() {
    if (isFCMInitialized) {
        console.log('[sw.js] Firebase 既に初期化済み、スキップ');
        return;
    }
    try {
        importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js');
        importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging.js');

        const firebaseConfig = await fetch('https://trextacy.com/chat/firebase-config.php')
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Firebase設定取得エラー: ステータス ${res.status}`);
                }
                return res.json();
            });

        const app = firebase.initializeApp(firebaseConfig);
        messaging = firebase.messaging.getMessaging(app);

        firebase.messaging.onBackgroundMessage(messaging, (payload) => {
            console.log('[sw.js] バックグラウンドメッセージ受信:', payload);
            const notificationTitle = payload.notification?.title || 'New Message';
            const notificationOptions = {
                body: payload.notification?.body || '新しいメッセージがあります',
                icon: self.location.hostname === 'localhost' ? '/learning/english-words/chat/images/icon.png' : '/chat/images/icon.png',
                data: payload.data || {}
            };
            self.registration.showNotification(notificationTitle, notificationOptions);
        });

        isFCMInitialized = true;
        console.log('[sw.js] Firebase初期化とバックグラウンドメッセージリスナー設定完了');
    } catch (error) {
        console.error('[sw.js] Firebase初期化エラー:', error);
    }
}

initializeFirebase();

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[sw.js] 通知クリック:', event.notification.data);
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            const url = event.notification.data.url || (self.location.hostname === 'localhost' ? 'https://localhost/learning/english-words/chat/' : 'https://soysourcetan.github.io/chat/');
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