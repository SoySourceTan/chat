// firebase-messaging-sw.js
console.log('[firebase-messaging-sw.js] Service Worker is running. Version: 2.0.1');

// 動的にベースパスを決定するヘルパー関数
function getServiceWorkerBasePath() {
    const serviceWorkerUrl = self.location.href;

    // GitHub Pages / trextacy.com の場合
    if (serviceWorkerUrl.includes('/chat/firebase-messaging-sw.js')) {
        // 例: https://soysourcetan.github.io/chat/firebase-messaging-sw.js -> https://soysourcetan.github.io/chat/
        return serviceWorkerUrl.substring(0, serviceWorkerUrl.indexOf('/chat/') + '/chat/'.length);
    }
    // ローカルホストのサブディレクトリの場合 (例: http://localhost/learning/english-words/chat/firebase-messaging-sw.js)
    // self.location.pathname を直接解析して 'chat' ディレクトリまでをベースパスとする
    const pathParts = self.location.pathname.split('/');
    const chatIndex = pathParts.indexOf('chat');
    if (chatIndex > -1) {
        return self.location.origin + pathParts.slice(0, chatIndex + 1).join('/') + '/';
    }
    // その他の場合 (ルートディレクトリなど、または Canvas 環境)
    // Service Workerのスコープがルート('/')であると仮定
    return self.location.origin + '/';
}

const basePath = getServiceWorkerBasePath();
console.log('[firebase-messaging-sw.js] basePath:', basePath);

// Firebase SDKのインポート
// Firebase App (the core Firebase SDK) is always required and must be listed first
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
// Add the Firebase products that you want to use
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-auth-compat.js'); // 認証モジュールを追加
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-database-compat.js'); // Realtime Databaseモジュールを追加


let firebaseApp;
let messaging;
let auth; // auth変数を追加
let database; // database変数を追加

async function initializeFirebase() {
    if (firebaseApp) {
        console.log('[firebase-messaging-sw.js] Firebaseは既に初期化済みです。');
        return true;
    }

    try {
        console.log('[firebase-messaging-sw.js] Firebase設定を読み込み中...');
        const response = await fetch(`${basePath}firebase-config.php`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[firebase-messaging-sw.js] Firebase設定取得HTTPエラー: ステータス ${response.status}, レスポンス: ${errorText}`);
            throw new Error(`HTTPエラー: ステータス ${response.status}`);
        }

        const firebaseConfig = await response.json();
        console.log('[firebase-messaging-sw.js] Firebase設定取得成功:', firebaseConfig);

        firebaseApp = firebase.initializeApp(firebaseConfig);
        messaging = firebase.messaging();
        auth = firebase.auth(); // authを初期化
        database = firebase.database(); // databaseを初期化

        console.log('[firebase-messaging-sw.js] Firebase初期化完了。');
        return true;
    } catch (error) {
        console.error('[firebase-messaging-sw.js] Firebase初期化エラー:', error);
        return false;
    }
}

// Service Workerがアクティブ化されたときにFirebaseを初期化
self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker activateイベント');
    event.waitUntil(initializeFirebase());
});

// バックグラウンドでのメッセージ受信を処理
// onBackgroundMessageはService Workerスコープでのみ利用可能
self.addEventListener('install', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker installイベント');
    self.skipWaiting(); // 新しいService Workerがすぐにアクティブになるようにする
});


// Firebase Messagingのバックグラウンドメッセージハンドラ
// Service Workerがアクティブになった後に実行される
self.addEventListener('fetch', (event) => {
    // Firebase SDKからのリクエスト、またはPHP設定ファイルへのリクエストはネットワーク優先で処理（FCMに必要）
    if (event.request.url.includes('firebasejs') ||
        event.request.url.includes('firebaseremoteconfig.googleapis.com') ||
        event.request.url.includes('fcm.googleapis.com') ||
        event.request.url.includes('trextacy.com/chat/firebase-config.php')) {
        event.respondWith(fetch(event.request));
        return;
    }
    // その他のリクエストはキャッシュ優先
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});


// onBackgroundMessage を使用するには、messaging インスタンスが初期化されている必要がある
// initializeFirebase が完了した後にのみこれを設定する
initializeFirebase().then(initialized => {
    if (initialized && messaging) {
        messaging.onBackgroundMessage((payload) => {
            console.log('[firebase-messaging-sw.js] バックグラウンドメッセージ受信:', payload);

            const notificationTitle = payload.notification?.title || '新しいメッセージ';
            const notificationOptions = {
                body: payload.notification?.body || '',
                icon: payload.data?.icon || `${basePath}images/icon.png`,
                data: {
                    url: payload.data?.url || `${basePath}`,
                    ...payload.data // その他のカスタムデータをdataオブジェクトに含める
                }
            };

            self.registration.showNotification(notificationTitle, notificationOptions);
        });
    } else {
        console.error('[firebase-messaging-sw.js] Firebase Messagingが初期化されていないため、onBackgroundMessageを設定できません。');
    }
});


// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] 通知クリック:', event);
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

// プッシュサブスクリプション変更時の処理
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[firebase-messaging-sw.js] プッシュサブスクリプション変更:', event);
    event.waitUntil(
        initializeFirebase().then(() => {
            if (messaging) {
                console.log('[firebase-messaging-sw.js] FCMトークンを再取得し、サーバーに送信してください。');
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGE', message: 'FCMトークンを更新してください。' });
                    });
                });
            } else {
                console.error('[firebase-messaging-sw.js] Messagingインスタンスが利用できません。FCMトークンの更新を試みません。');
            }
        }).catch(error => {
            console.error('[firebase-messaging-sw.js] pushsubscriptionchangeでのFirebase初期化エラー:', error);
        })
    );
});
