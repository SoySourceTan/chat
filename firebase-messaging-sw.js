// firebase-messaging-sw.js
console.log('[firebase-messaging-sw.js] Service Worker is running. Version: 2.0.1');

// 動的にベースパスを決定するヘルパー関数
function getServiceWorkerBasePath() {
    const serviceWorkerUrl = self.location.href;
    const lastSlashIndex = serviceWorkerUrl.lastIndexOf('/');
    if (lastSlashIndex > -1) {
        return serviceWorkerUrl.substring(0, lastSlashIndex + 1);
    }
    return self.location.origin + '/';
}
const basePath = getServiceWorkerBasePath();
console.log('[firebase-messaging-sw.js] basePath for SW:', basePath);

// Firebase SDKのインポート
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');
// AuthやDatabaseはService Workerで直接使う場面が少ないため、
// バックグラウンドメッセージ処理に不要であればコメントアウトしても良いかもしれません
// importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-auth-compat.js');
// importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-database-compat.js');

// --- Firebase設定をService Workerに直接記述 ---
const firebaseConfig = {
    apiKey: "AIzaSyBLMySLkXyeiL2_QLCdolHTOOA6W3TSfYc",
    authDomain: "gentle-brace-458923-k9.firebaseapp.com",
    databaseURL: "https://gentle-brace-458923-k9-default-rtdb.firebaseio.com",
    projectId: "gentle-brace-458923-k9",
    storageBucket: "gentle-brace-458923-k9.firebasestorage.app",
    messagingSenderId: "426876531009",
    appId: "1:426876531009:web:021b23c449bce5d72031c0",
    measurementId: "G-2B5KWNHYED"
};

// Firebaseアプリを初期化
// これはService Workerスクリプトのトップレベルで同期的に実行される
try {
    firebase.initializeApp(firebaseConfig);
    console.log('[firebase-messaging-sw.js] Firebaseアプリ初期化完了 (Service Worker)。');
} catch (e) {
    console.error('[firebase-messaging-sw.js] Firebaseアプリ初期化エラー (Service Worker):', e);
}


// Firebase Messagingインスタンスを取得
let messagingInstance;
try {
    messagingInstance = firebase.messaging();
    console.log('[firebase-messaging-sw.js] Firebase Messagingインスタンス取得成功。');
} catch (e) {
    console.error('[firebase-messaging-sw.js] Firebase Messagingインスタンス取得エラー:', e);
}


// --- FCMイベントハンドラの設定（トップレベルで同期的に） ---
if (messagingInstance) {
    messagingInstance.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] バックグラウンドメッセージ受信:', payload);

        const notificationTitle = payload.notification?.title || '新しいメッセージ';
        const notificationOptions = {
            body: payload.notification?.body || '',
            icon: `${basePath}images/icon.png`,
            image: `${basePath}images/icon.png`, // 通知内の大きな画像もデフォルトに強制
            badge: `${basePath}images/icon.png`, // バッジアイコンもデフォルトに強制
            data: {
                url: payload.data?.url || `${basePath}`,
                ...payload.data
            }
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} else {
    console.error('[firebase-messaging-sw.js] Messagingインスタンスが利用できないため、onBackgroundMessageを設定できません。');
}

// 通知クリック時の処理 (トップレベルで設定)
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] 通知クリック:', event);
    event.notification.close();

    // デフォルトのURLを修正 (GitHub Pages用)
    const defaultUrl = 'https://soysourcetan.github.io/chat/';
    const url = event.notification.data?.url || defaultUrl;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                // 既に開いているタブがあれば、そこにフォーカス
                if (client.url.includes(url) && 'focus' in client) { // includes で部分一致を見る
                    return client.focus();
                }
            }
            // なければ新しいタブで開く
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

// プッシュサブスクリプション変更時の処理 (トップレベルで設定)
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[firebase-messaging-sw.js] プッシュサブスクリプション変更:', event);
    event.waitUntil((async () => {
        if (messagingInstance) {
            console.log('[firebase-messaging-sw.js] FCMトークンを再取得し、サーバーに送信してください。');
            try {
                const vapidKey = 'BKsBnmdJMsGJqwWG6tsEYPKA5OAsesBv6JEUAuNojta_lXqw1vMRAe8f1zFCNdyr4OckeZ4RV-3AsO9gWubUYKw';
                const refreshedToken = await messagingInstance.getToken({
                    vapidKey: vapidKey,
                    serviceWorkerRegistration: self.registration
                });
                console.log('[firebase-messaging-sw.js] 新しいFCMトークン:', refreshedToken);

                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'FCM_TOKEN_REFRESHED',
                            token: refreshedToken
                        });
                    });
                });
            } catch (tokenError) {
                console.error('[firebase-messaging-sw.js] FCMトークンの再取得エラー:', tokenError);
            }
        } else {
            console.error('[firebase-messaging-sw.js] Messagingインスタンスが利用できません。FCMトークンの更新を試みません。');
        }
    })());
});



// Service Workerのインストールイベント
self.addEventListener('install', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker installイベント');
    self.skipWaiting(); // 新しいService Workerがすぐにアクティブになるようにする
    // installイベントでFirebaseアプリの初期化はもう不要（トップレベルで済んでいるため）
});

// Service Workerのアクティベートイベント
self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker activateイベント');
    event.waitUntil(async () => {
        return self.clients.claim();
    });
});


// fetchイベントハンドラ
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('firebasejs') ||
        event.request.url.includes('firebaseremoteconfig.googleapis.com') ||
        event.request.url.includes('fcm.googleapis.com') ||
        event.request.url.includes('firebase-config.php')) {
        event.respondWith(fetch(event.request));
        return;
    }
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});