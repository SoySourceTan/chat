try {
    // Firebase SDKのバージョンを11.0.1に統一
    importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');
} catch (error) {
    console.error('[firebase-messaging-sw.js] importScriptsエラー:', error);
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'ERROR', message: 'スクリプトの読み込みに失敗しました: ' + error.message });
        });
    });
    throw error;
}

// Firebase設定を外部PHPから取得
async function loadFirebaseConfig() {
    try {
        // ★修正: URLに '/chat/' を追加
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
        console.error('[firebase-messaging-sw.js] Firebase設定取得エラー:', error);
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({ type: 'ERROR', message: 'Firebase設定の取得に失敗しました: ' + error.message });
            });
        });
        throw error;
    }
}

let firebaseApp;
let messaging;

// Firebase初期化関数
async function initializeFirebase() {
    if (firebaseApp) {
        console.log('[firebase-messaging-sw.js] Firebase 既に初期化済み、スキップ');
        return;
    }
    try {
        const firebaseConfig = await loadFirebaseConfig();
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
            throw new Error('Firebase設定が空または無効です。');
        }
        firebaseApp = firebase.initializeApp(firebaseConfig);
        messaging = firebase.messaging(); // Firebase Messagingサービスを取得
        console.log('[firebase-messaging-sw.js] Firebase初期化成功。');
    } catch (error) {
        console.error('[firebase-messaging-sw.js] Firebase初期化エラー:', error);
        throw error;
    }
}

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
                    // CACHE_NAMEはsw.jsで定義されているため、ここでは使用しません。
                    // firebase-messaging-sw.jsはメッセージング専用なので、キャッシュ管理はsw.jsに任せます。
                    // ここでは特にキャッシュを削除しない
                })
            );
        }).then(() => self.clients.claim())
    );
});


// onBackgroundMessage を使用してバックグラウンドメッセージを処理
// Firebase SDK v9+の互換レイヤーでは、`firebase.messaging().onBackgroundMessage`を使用します。
// これは、サービスワーカーがFirebase SDKを初期化した後に設定する必要があります。
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'INIT_FCM_IN_SW') {
        initializeFirebase().then(() => {
            if (messaging) {
                messaging.onBackgroundMessage((payload) => {
                    console.log('[firebase-messaging-sw.js] バックグラウンドプッシュメッセージ受信:', payload);
                    const notificationTitle = payload.notification.title;
                    const notificationOptions = {
                        body: payload.notification.body,
                        icon: payload.notification.icon || '/learning/english-words/chat/images/icon.png',
                        data: payload.data, // カスタムデータを渡す
                    };
                    try {
                        self.registration.showNotification(notificationTitle, notificationOptions);
                        console.log('[firebase-messaging-sw.js] 通知表示成功:', notificationTitle);
                    } catch (error) {
                        console.error('[firebase-messaging-sw.js] 通知表示エラー:', error);
                    }
                });
            }
        }).catch(error => {
            console.error('[firebase-messaging-sw.js] FCM初期化エラー (message event):', error);
        });
    }
});


// 通知クリックハンドラ（トップレベル）
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

// プッシュサブスクリプション変更ハンドラ（トップレベル）
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[firebase-messaging-sw.js] プッシュサブスクリプション変更:', event);
    event.waitUntil(
        initializeFirebase().then(() => {
            if (messaging) {
                // 新しいサブスクリプションを再登録するロジック
                // getToken() を呼び出すことで、新しいトークンが自動的に生成され、
                // onTokenRefresh (もし設定されていれば) または getToken() の解決によって取得できます。
                // その後、新しいトークンをサーバーに送信して更新する必要があります。
                // ここではクライアントサイドのgetToken()が処理するため、特別な処理は不要です。
                console.log('[firebase-messaging-sw.js] FCMトークンを再取得し、サーバーに送信してください。');
            }
        }).catch(error => {
            console.error('[firebase-messaging-sw.js] Firebase初期化エラー (pushsubscriptionchange event):', error);
        })
    );
});

// サービスワーカーが起動したらFirebaseを初期化
initializeFirebase().catch(error => {
    console.error('[firebase-messaging-sw.js] サービスワーカー起動時のFirebase初期化エラー:', error);
});
