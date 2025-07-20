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

// Firebase設定を外部PHPから取得 (trextacy.com から取得)
async function loadFirebaseConfig() {
    try {
        const response = await fetch('https://trextacy.com/chat/firebase-config.php', { // PHPファイルはtrextacy.comから取得
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

        // Firebase初期化後に onBackgroundMessage を直接設定
        messaging.onBackgroundMessage((payload) => {
            console.log('[firebase-messaging-sw.js] バックグラウンドプッシュメッセージ受信 (onBackgroundMessage):', payload);
            const notificationTitle = payload.notification?.title || '新しいメッセージ';
            const notificationOptions = {
                body: payload.notification?.body || '新しいメッセージがあります',
                // アイコンパスはService Workerのスコープからの相対パスまたは絶対パス
                // GitHub Pagesの実行環境を考慮し、/chat/images/icon.png に対応
                icon: payload.notification?.icon || './images/icon.png', 
                data: payload.data || {}, // カスタムデータを渡す
            };
            try {
                self.registration.showNotification(notificationTitle, notificationOptions);
                console.log('[firebase-messaging-sw.js] 通知表示成功:', notificationTitle);
            } catch (error) {
                console.error('[firebase-messaging-sw.js] 通知表示エラー:', error);
            }
        });

    } catch (error) {
        console.error('[firebase-messaging-sw.js] Firebase初期化エラー:', error);
        throw error;
    }
}

// サービスワーカーのライフサイクルイベントはメインの sw.js で処理するため、ここから削除します。
// self.addEventListener('install', ...) は削除
// self.addEventListener('activate', ...) は削除

// 'message' イベントリスナーは onBackgroundMessage を直接初期化関数内で登録するため不要になります。
// self.addEventListener('message', ...) は削除

// 通知クリックハンドラ（トップレベル）
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] 通知クリック:', event);
    event.notification.close();
    // notification.data.url が存在しない場合のデフォルトURLを確実に指定
    const url = event.notification.data?.url || 'https://soysourcetan.github.io/chat/'; // 実行環境のURLを指定
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
                // 新しいサブスクリプションを再登録するロジックは、クライアントサイドの getToken() が処理するため、
                // ここでは特に特別な処理は不要です。
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