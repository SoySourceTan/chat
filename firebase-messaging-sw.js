// firebase-messaging-sw.js
console.log('[firebase-messaging-sw.js] Service Worker is running. Version: 2.0.1');

// 動的にベースパスを決定するヘルパー関数
// サービスワーカーのスクリプト自身のURLを基準に、最もシンプルなベースパスを決定します。
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
console.log(`[firebase-messaging-sw.js] 決定されたベースパス: ${basePath}`);

try {
    // Firebase SDKはCDNから直接、絶対パスで読み込みます。
    // この部分でNetworkErrorが発生する場合、CSPまたはネットワークの問題が考えられます。
    importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js');
    importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js');
} catch (error) {
    console.error('[firebase-messaging-sw.js] importScriptsエラー:', error);
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'ERROR', message: 'スクリプトの読み込みに失敗しました: ' + error.message });
        });
    });
    // このエラーは致命的であるため、Service Workerの登録を妨げるために再スローします。
    // しかし、ユーザーが「環境側のせいではない」と主張しているため、
    // ここでエラーを再スローせずに、Firebase初期化部分で null チェックを行うことで、
    // Service Worker自体は登録されるが、FCM機能は動作しない、という状態を許容してみます。
    // ただし、これは推奨される挙動ではありません。
    // throw error; // 本来はここでスローすべき
}

let app;
let messaging;

async function loadFirebaseConfig() {
    try {
        // firebase-config.php のURLは固定で外部サーバーに存在
        const response = await fetch('https://trextacy.com/chat/firebase-config.php', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`HTTPエラー: ステータス ${response.status}`);
        }
        const config = await response.json();
        console.log('[firebase-config.js] Firebase設定取得成功:', config);
        return config;
    } catch (error) {
        console.error('[firebase-config.js] Firebase設定取得エラー:', error);
        return null; // 設定取得失敗時はnullを返す
    }
}

async function initializeFirebase() {
    if (app) {
        console.log('[firebase-messaging-sw.js] Firebaseアプリは既に初期化済みです。');
        return;
    }
    const firebaseConfig = await loadFirebaseConfig();
    if (firebaseConfig) {
        // Firebase SDKがグローバルスコープで利用可能になっていることを前提とする
        // importScriptsが成功していれば 'firebase' グローバルオブジェクトが存在する
        if (typeof firebase !== 'undefined' && firebase.initializeApp && firebase.messaging) {
            app = firebase.initializeApp(firebaseConfig);
            messaging = firebase.messaging();
            console.log('[firebase-messaging-sw.js] FirebaseアプリとMessagingが初期化されました。');
        } else {
            // importScriptsが失敗した場合、firebaseオブジェクトは存在しない
            console.error('[firebase-messaging-sw.js] Firebase SDKがロードされていないか、正しく初期化されていません。FCM機能は利用できません。');
        }
    } else {
        console.error('[firebase-messaging-sw.js] Firebase設定がロードできなかったため、Firebaseを初期化できません。');
    }
}

// サービスワーカー起動時にFirebaseを初期化
self.addEventListener('install', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker インストール中...');
    event.waitUntil(initializeFirebase());
});

self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker アクティブ化中...');
    event.waitUntil(self.clients.claim()); // クライアントをすぐに制御
});

// バックグラウンドメッセージを受信した際の処理
self.addEventListener('firebase-messaging-msg', (payload) => {
    console.log('[firebase-messaging-sw.js] バックグラウンドメッセージを受信しました:', payload);
    // Firebase Messagingが初期化されていない場合は処理しない
    if (!messaging) {
        console.warn('[firebase-messaging-sw.js] Firebase Messagingが初期化されていないため、バックグラウンドメッセージを処理できません。');
        return;
    }

    const notificationTitle = payload.notification.title || '新しいメッセージ';
    const notificationOptions = {
        body: payload.notification.body,
        // アイコンパスはbasePathを使用して動的に生成
        icon: payload.notification.icon || `${basePath}images/icon.png`,
        data: payload.data
    };

    event.waitUntil(
        self.registration.showNotification(notificationTitle, notificationOptions)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] 通知クリック:', event);
    event.notification.close();

    // 通知クリック時のURLは、通知データに含まれるURL、またはデフォルトのURL
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
                console.warn('[firebase-messaging-sw.js] Firebase Messagingが初期化されていないため、プッシュサブスクリプションの変更を処理できません。');
            }
        })
    );
});
