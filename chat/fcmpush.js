import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

async function loadFirebaseConfig() {
    try {
        const response = await fetch('https://trextacy.com/chat/firebase-config.php', {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`HTTPエラー: ステータス ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Firebase設定取得エラー:', error);
        throw error;
    }
}

function showError(message) {
    const errorAlert = document.getElementById('error-alert');
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.classList.remove('d-none');
        errorAlert.setAttribute('role', 'alert');
        setTimeout(() => {
            errorAlert.classList.add('d-none');
            errorAlert.removeAttribute('role');
        }, 6000);
    } else {
        console.warn('エラーアラート要素が見つかりません');
    }
}

let app, messaging, database, auth;
async function initializeFCM() {
    try {
        const firebaseConfig = await loadFirebaseConfig();
        app = initializeApp(firebaseConfig);
        messaging = getMessaging(app);
        database = getDatabase(app);
        auth = getAuth(app);
        console.log('FCM初期化成功:', { app, messaging, database, auth });

        const isLocalhost = window.location.hostname === 'localhost';
// fcmpush.js
const serviceWorkerPath = isLocalhost
    ? '/learning/english-words/chat/firebase-messaging-sw.js'
    : '/chat/firebase-messaging-sw.js';
const serviceWorkerScope = isLocalhost
    ? '/learning/english-words/chat/'
    : '/chat/';

        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register(serviceWorkerPath, {
                scope: serviceWorkerScope,
            });
            console.log('サービスワーカー登録成功:', registration);
        } else {
            console.warn('サービスワーカーがサポートされていません');
            showError('このブラウザはプッシュ通知をサポートしていません。');
        }

        onMessage(messaging, (payload) => {
            console.log('フォアグラウンドメッセージ受信:', payload);
            const notification = new Notification(payload.notification.title, {
                body: payload.notification.body,
                icon: payload.data?.icon || '/chat/images/icon.png',
                data: payload.data
            });
            notification.onclick = () => {
                window.focus();
                if (payload.data?.url) {
                    window.location.href = payload.data.url;
                }
                notification.close();
            };
        });
        return true;
    } catch (error) {
        console.error('FCM初期化エラー:', error);
        showError('通知の初期化に失敗しました。');
        return false;
    }
}

async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showError('通知の許可が拒否されました。');
            return null;
        }
        const isLocalhost = window.location.hostname === 'localhost';
        const serviceWorkerScope = isLocalhost
            ? '/learning/english-words/chat/firebase-cloud-messaging-push-scope'
            : '/chat/firebase-cloud-messaging-push-scope';
        const token = await getToken(messaging, {
            vapidKey: 'BKsBnmdJMsGJqwWG6tsEYPKA5OAsesBv6JEUAuNojta_lXqw1vMRAe8f1zFCNdyr4OckeZ4RV-3AsO9gWubUYKw',
            serviceWorkerRegistration: await navigator.serviceWorker.getRegistration(serviceWorkerScope),
        });
        if (!token) {
            showError('通知トークンの取得に失敗しました。');
            return null;
        }
        return token;
    } catch (error) {
        console.error('通知許可エラー:', error);
        showError('通知許可の取得に失敗しました。');
        return null;
    }
}

async function saveFCMToken(userId, token) {
    try {
        console.log('Saving FCM token for userId:', userId);
        await set(ref(database, `users/${userId}/fcmToken`), token);
        console.log('FCMトークンを保存:', token);
    } catch (error) {
        console.error('FCMトークン保存エラー:', error);
        showError('通知トークンの保存に失敗しました: ' + error.message);
    }
}

export async function sendNotification(userId, title, body, data = {}, senderUserId = null) {
    try {
        const url = 'https://trextacy.com/chat/send-notification.php';
        const payload = {
            userId: userId || null,
            title: title || '',
            body: body || '',
            data: { ...data, url: data.url || 'https://trextacy.com/chat' },
            senderUserId: senderUserId || null
        };
        console.log('通知送信リクエスト:', payload);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8', // UTF-8を明示
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`通知送信エラー: ステータス ${response.status}, 詳細: ${errorText}`);
        }
        const result = await response.json();
        console.log('通知送信成功:', result);
        return result;
    } catch (error) {
        console.error('通知送信エラー:', error);
        showError(`通知の送信に失敗しました: ${error.message}`);
        throw error;
    }
}

async function initNotifications() {
    const initialized = await initializeFCM();
    if (!initialized) {
        console.error('FCM初期化に失敗したため、処理を中断します。');
        return;
    }
    if (auth) {
        auth.onAuthStateChanged(async (user) => {
            try {
                if (user) {
                    const token = await requestNotificationPermission();
                    if (token) {
                        await saveFCMToken(user.uid, token);
                    }
                } else {
                    console.log('ユーザーが未ログインのため、FCMトークンを取得しません。');
                }
            } catch (error) {
                console.error('認証状態変更エラー:', error);
                showError('認証状態の処理に失敗しました。');
            }
        });
    } else {
        console.error('authが未定義です。FCM初期化を確認してください。');
        showError('認証モジュールの初期化に失敗しました。');
    }
}

export { initNotifications };