// firebase-messaging-sw.js
console.log('[firebase-messaging-sw.js] Service Worker is running. Version: 2.0.2 (Merged)');

// 動的にベースパスを決定するヘルパー関数
// Service Workerのスコープがルートではない場合に、アイコンなどのパスを正しく解決するために重要です。
function getServiceWorkerBasePath() {
    const serviceWorkerUrl = self.location.href;
    const lastSlashIndex = serviceWorkerUrl.lastIndexOf('/');
    if (lastSlashIndex > -1) {
        // 例: https://localhost/learning/english-words/chat/firebase-messaging-sw.js から
        // https://localhost/learning/english-words/chat/ を取得
        return serviceWorkerUrl.substring(0, lastSlashIndex + 1);
    }
    // フォールバック（通常は発生しないはず）
    return self.location.origin + '/';
}
const basePath = getServiceWorkerBasePath();
console.log('[firebase-messaging-sw.js] basePath for SW:', basePath);


// Firebase SDKのインポート
// ★重要: ここで読み込むSDKのバージョンは、メインスレッドのJSファイル（script.js, fcmpush.jsなど）と一致させることを強く推奨します。
// compat版と通常版が混在すると問題が起きる可能性があるため、メインスレッド側も確認してください。
// 今回は元のコードに合わせてcompat版を使用します。
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');
// AuthやDatabaseはService Workerで直接使う場面が少ないため、
// バックグラウンドメッセージ処理に不要であればコメントアウトしても良いかもしれません
// importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-auth-compat.js');
// importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-database-compat.js');

// --- Firebase設定をService Workerに直接記述 ---
// ★重要: firebase-config.js に記述した firebaseConfig と全く同じ内容をここに記述してください。
const firebaseConfig = {
    apiKey: 'AIzaSyBLMySLkXyeiL2_QLCdolHTOOA6W3TSfYc',
    authDomain: 'gentle-brace-458923-k9.firebaseapp.com',
    databaseURL: 'https://gentle-brace-458923-k9-default-rtdb.firebaseio.com',
    projectId: 'gentle-brace-458923-k9',
    storageBucket: 'gentle-brace-458923-k9.firebasestorage.app',
    messagingSenderId: '426876531009', // ★特に重要: これが正しいか再確認
    appId: '1:426876531009:web:021b23c449bce5d72031c0',
    measurementId: 'G-2B5KWNHYED'
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
            // ★修正点: アイコンパスを basePath を使って絶対パスに変換
            icon: `${basePath}images/icon.png`,
            image: `${basePath}images/icon.png`, // 通知内の大きな画像もデフォルトに強制
            badge: `${basePath}images/icon.png`, // バッジアイコンもデフォルトに強制
            data: {
                url: payload.data?.url || `${basePath}`, // 通知クリック時のURL
                ...payload.data // その他のカスタムデータ
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
    event.notification.close(); // 通知を閉じる

    // デフォルトのURLを修正 (GitHub Pages用)
    // ユーザーの元のコードのロジックを保持
    const defaultUrl = 'https://soysourcetan.github.io/chat/';
    const url = event.notification.data?.url || defaultUrl;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                // 既に開いているタブがあれば、そこにフォーカス
                // includes で部分一致を見ることで、URLの末尾のスラッシュの有無などに対応
                if (client.url.includes(url) && 'focus' in client) {
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
// FCMトークンが自動的に更新された際に、クライアントに通知したり、サーバーに新しいトークンを送信したりするために重要です。
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[firebase-messaging-sw.js] プッシュサブスクリプション変更:', event);
    event.waitUntil((async () => {
        if (messagingInstance) {
            console.log('[firebase-messaging-sw.js] FCMトークンを再取得し、サーバーに送信してください。');
            try {
                // VAPIDキーはfcmpush.jsからコピーしてきています。
                const vapidKey = 'BKsBnmdJMsGJqwWG6tsEYPKA5OAsesBv6JEUAuNojta_lXqw1vMRAe8f1zFCNdyr4OckeZ4RV-3AsO9gWubUYKw';
                const refreshedToken = await messagingInstance.getToken({
                    vapidKey: vapidKey,
                    serviceWorkerRegistration: self.registration // Service Worker自身を登録として渡す
                });
                console.log('[firebase-messaging-sw.js] 新しいFCMトークン:', refreshedToken);

                // メインスレッドに新しいトークンを送信し、データベースに保存するよう促す
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
});

// Service Workerのアクティベートイベント
self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker activateイベント');
    event.waitUntil(async () => {
        return self.clients.claim(); // クライアントがService Workerを制御できるようにする
    });
});


// fetchイベントハンドラ
// オフライン対応やキャッシュ戦略のために重要です。
self.addEventListener('fetch', (event) => {
    // Firebase関連のURLはキャッシュせず、常にネットワークから取得する
    if (event.request.url.includes('firebasejs') ||
        event.request.url.includes('firebaseremoteconfig.googleapis.com') ||
        event.request.url.includes('fcm.googleapis.com') ||
        // firebase-config.php はもう使わない想定ですが、念のため残しておきます。
        // もし完全に不要なら削除しても構いません。
        event.request.url.includes('firebase-config.php')) {
        event.respondWith(fetch(event.request));
        return;
    }
    // その他のリソースはキャッシュファーストで提供
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
