import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js';
import { getDatabase, ref, set, get } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

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
        console.error('[fcmpush.js] Firebase設定取得エラー:', error);
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
        console.warn('[fcmpush.js] エラーアラート要素が見つかりません');
    }
}

let app, messaging, database, auth;
let isFCMInitialized = false;

async function initializeFCM() {
    if (isFCMInitialized) {
        console.log('[fcmpush.js] FCMは既に初期化済み、スキップ');
        return true;
    }
    try {
        console.log('[fcmpush.js] FCM初期化開始');
        const firebaseConfig = await loadFirebaseConfig();
        app = initializeApp(firebaseConfig);
        messaging = getMessaging(app);
        database = getDatabase(app);
        auth = getAuth(app);
        console.log('[fcmpush.js] FCM初期化成功:', { app, messaging, database, auth });

        const isLocalhost = window.location.hostname === 'localhost';
        const basePath = isLocalhost ? '/learning/english-words/chat' : '/chat';
        const iconPath = `${basePath}/images/icon.png`;

        onMessage(messaging, (payload) => {
            console.log('[fcmpush.js] フォアグラウンドメッセージ受信:', payload);
            notifyNewMessage();
            const notification = new Notification(payload.notification.title, {
                body: payload.notification.body,
                icon: iconPath,
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

        isFCMInitialized = true;
        return true;
    } catch (error) {
        console.error('[fcmpush.js] FCM初期化エラー:', error);
        showError('通知の初期化に失敗しました。');
        return false;
    }
}

async function requestNotificationPermission() {
    try {
        console.log('[fcmpush.js] 通知許可リクエスト開始');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('[fcmpush.js] 通知許可が拒否されました:', permission);
            showError('通知の許可が拒否されました。');
            return null;
        }
        const isLocalhost = window.location.hostname === 'localhost';
        const basePath = isLocalhost ? '/learning/english-words/chat' : '/chat';
        const serviceWorkerPath = `${basePath}/sw.js`;
        const serviceWorkerScope = basePath + '/';
        console.log('[fcmpush.js] サービスワーカースコープ:', serviceWorkerScope);

        let registration = await navigator.serviceWorker.register(serviceWorkerPath, { scope: serviceWorkerScope });
        if (!registration) {
            console.error('[fcmpush.js] サービスワーカー登録失敗');
            showError('サービスワーカーの登録に失敗しました。');
            return null;
        }
        console.log('[fcmpush.js] サービスワーカー登録成功:', registration);

        const token = await getToken(messaging, {
            vapidKey: 'BKsBnmdJMsGJqwWG6tsEYPKA5OAsesBv6JEUAuNojta_lXqw1vMRAe8f1zFCNdyr4OckeZ4RV-3AsO9gWubUYKw',
            serviceWorkerRegistration: registration,
        });
        if (!token) {
            console.warn('[fcmpush.js] 通知トークンの取得に失敗しました');
            showError('通知トークンの取得に失敗しました。');
            return null;
        }
        console.log('[fcmpush.js] 通知トークン取得成功:', token);
        return token;
    } catch (error) {
        console.error('[fcmpush.js] 通知許可エラー:', error);
        showError('通知許可の取得に失敗しました。');
        return null;
    }
}

async function saveFCMToken(userId, token) {
    try {
        if (!userId || typeof userId !== 'string' || /[.#$[\]]/.test(userId)) {
            throw new Error(`無効な userId: ${userId}`);
        }
        if (!token || typeof token !== 'string' || token.length === 0) {
            throw new Error(`無効なトークン: ${token}`);
        }

        console.log('[fcmpush.js] Saving FCM token for userId:', userId);
        console.log('[fcmpush.js] Token type:', typeof token, 'Token length:', token.length);

        const tokenRef = ref(database, `users/${userId}/fcmToken`);
        const snapshot = await get(tokenRef);
        const existingToken = snapshot.exists() ? snapshot.val() : null;
        console.log('[fcmpush.js] 既存のFCMトークン:', existingToken);

        if (existingToken === token) {
            console.log('[fcmpush.js] 同一トークンのため保存をスキップ');
            return;
        }

        await set(tokenRef, token);
        console.log('[fcmpush.js] FCMトークンを保存:', token);
    } catch (error) {
        console.error('[fcmpush.js] FCMトークン保存エラー:', {
            message: error.message,
            stack: error.stack,
            userId,
            tokenType: typeof token,
            tokenSnippet: token ? token.substring(0, 50) + '...' : 'undefined',
            databasePath: `users/${userId}/fcmToken`
        });
        showError('通知トークンの保存に失敗しました: ' + error.message);
        throw error;
    }
}

export async function sendNotification(userId, title, body, data = {}, senderUserId = null, username = '匿名') {
    try {
        const validatedUsername = (username && typeof username === 'string' && username.trim() !== '') ? username.trim() : '匿名';
        console.log('[fcmpush.js] 通知送信準備:', { userId, title, body, username: validatedUsername });
        const url = 'https://trextacy.com/chat/send-notification.php';
        const payload = {
            userId: userId || null,
            title: title || '',
            body: body || '',
            data: { ...data, url: data.url || 'https://soysourcetan.github.io/chat/' },
            senderUserId: senderUserId || null,
            username: validatedUsername
        };
        console.log('[fcmpush.js] 通知送信リクエスト:', payload);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`通知送信エラー: ステータス ${response.status}, 詳細: ${errorText}`);
        }
        const result = await response.json();
        console.log('[fcmpush.js] 通知送信成功:', result);
        return result;
    } catch (error) {
        console.error('[fcmpush.js] 通知送信エラー:', error);
        showError(`通知の送信に失敗しました: ${error.message}`);
        throw error;
    }
}

let isNotificationsInitialized = false;
export async function initNotifications() {
    if (isNotificationsInitialized) {
        console.log('[fcmpush.js] initNotifications は既に実行済み、スキップ');
        return;
    }
    isNotificationsInitialized = true;
    console.log('[fcmpush.js] initNotifications 開始');
    const initialized = await initializeFCM();
    if (!initialized) {
        console.error('[fcmpush.js] FCM初期化に失敗したため、処理を中断します。');
        return;
    }
    if (auth) {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            try {
                console.log('[fcmpush.js] 認証状態変更:', user ? user.uid : '未ログイン');
                if (user) {
                    const token = await requestNotificationPermission();
                    if (token) {
                        await saveFCMToken(user.uid, token);
                    }
                } else {
                    console.log('[fcmpush.js] ユーザーが未ログインのため、FCMトークンを取得しません。');
                }
            } catch (error) {
                console.error('[fcmpush.js] 認証状態変更エラー:', error);
                showError('認証状態の処理に失敗しました。');
            } finally {
                unsubscribe();
            }
        });
    } else {
        console.error('[fcmpush.js] authが未定義です。FCM初期化を確認してください。');
        showError('認証モジュールの初期化に失敗しました。');
    }
}