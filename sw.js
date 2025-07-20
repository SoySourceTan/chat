const CACHE_NAME = 'chat-cache-v1';

let messaging;
let isFCMInitialized = false;

// サービスワーカーのイベントリスナーはトップレベルに配置
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

// Firebaseの初期化関数
async function initializeFirebase() {
    if (isFCMInitialized) {
        console.log('[sw.js] Firebase 既に初期化済み、スキップ');
        return;
    }
    try {
        // Firebase SDKの互換バージョンをインポート
        importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
        importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');

        const firebaseConfig = await fetch('https://trextacy.com/chat/firebase-config.php')
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Firebase設定取得エラー: ステータス ${res.status}`);
                }
                return res.json();
            });

        const app = firebase.initializeApp(firebaseConfig);
        messaging = app.messaging(); // 互換バージョンでのmessagingサービスの取得方法
        
        // バックグラウンドメッセージハンドラの登録（initializeFirebase内で実行）
        // 互換バージョンでは firebase.messaging().onBackgroundMessage を使用
        firebase.messaging().onBackgroundMessage((payload) => {
            console.log('[sw.js] バックグラウンドメッセージ受信 (onBackgroundMessage):', payload);
            const notificationTitle = payload.notification?.title || 'New Message';
            const notificationOptions = {
                body: payload.notification?.body || '新しいメッセージがあります',
                icon: '/chat/images/icon.png', // 通知アイコンのパス
                data: payload.data || {}
            };
            self.registration.showNotification(notificationTitle, notificationOptions);
        });

        isFCMInitialized = true;
        console.log('[sw.js] Firebase初期化とバックグラウンドメッセージリスナー設定完了');
        
    } catch (error) {
        console.error('[sw.js] Firebase初期化エラー:', error);
        isFCMInitialized = false; 
    }
}

// fetchイベントリスナーはそのまま
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// notificationclickイベントリスナーはトップレベルに配置
self.addEventListener('notificationclick', (event) => {
    console.log('[sw.js] 通知クリック:', event.notification.data);
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            const url = event.notification.data.url || 'https://soysourcetan.github.io/chat/';
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

// pushイベントリスナーもトップレベルに配置
// onBackgroundMessage を使用するため、このpushイベントハンドラは通常不要ですが、
// 念のため残しておきます。FCMからのメッセージはonBackgroundMessageで処理されます。
self.addEventListener('push', (event) => {
    console.log('[sw.js] プッシュメッセージ受信 (push event):', event.data.json());
    // onBackgroundMessage が処理するので、ここでは特に何もしないことが多い
    // もしonBackgroundMessageが動作しない場合のフォールバックとして使用することも可能
});

// pushsubscriptionchangeイベントリスナーもトップレベルに配置
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[sw.js] プッシュサブスクリプション変更:', event);
    event.waitUntil(
        initializeFirebase().then(() => {
            if (isFCMInitialized && messaging) {
                // ここで新しいサブスクリプションを再登録するロジックを追加する必要があります。
                // messaging.getToken() を呼び出し、新しいトークンをサーバーに保存します。
                console.log('[sw.js] 新しいプッシュサブスクリプションの取得と更新が必要です。');
            }
        })
    );
});

// サービスワーカーの初期化をトリガー
// initializeFirebase(); // この行は削除し、各イベントハンドラ内で必要に応じて呼び出す
