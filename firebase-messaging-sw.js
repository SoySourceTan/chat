try {
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
        const response = await fetch('https://trextacy.com/firebase-config.php', {
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

// Firebase初期化
let messaging = null;
try {
    const firebaseConfig = await loadFirebaseConfig();
    console.log('[firebase-messaging-sw.js] 設定取得成功:', firebaseConfig);
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();
    console.log('[firebase-messaging-sw.js] Messaging 初期化成功');
} catch (error) {
    console.error('[firebase-messaging-sw.js] 初期化エラー:', error);
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'ERROR', message: 'Service Worker の初期化に失敗しました: ' + error.message });
        });
    });
}

// プッシュ通知ハンドラ（トップレベル）
if (messaging) {
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] バックグラウンドメッセージ受信:', payload);
        const notificationTitle = payload.notification.title;
        
        const notificationOptions = {
            body: payload.notification.body,
            icon: '/learning/english-words/chat/images/icon.png',
            data: payload.data,
        };
        try {
            self.registration.showNotification(notificationTitle, notificationOptions);
            console.log('[firebase-messaging-sw.js] 通知表示成功:', notificationTitle);
        } catch (error) {
            console.error('[firebase-messaging-sw.js] 通知表示エラー:', error);
        }
    });
}

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
    // 必要に応じて再サブスクライブ処理を追加
});