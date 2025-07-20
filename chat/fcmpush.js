// fcmpush.js

// Firebase SDKの必要なモジュールをインポート
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
// getAuthはscript.jsで初期化されるため、ここでは不要です。

// notifysound.js からのインポートはそのまま
import { initNotify, notifyNewMessage } from '../notifysound.js';

let messaging; // Firebase Messagingインスタンスを保持する変数
let db; // Firebase Databaseインスタンスを保持する変数
let isFCMInitialized = false; // FCMが初期化されたかどうかのフラグ

// Firebase設定取得関数 (現状維持)
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

// initNotifications 関数がFirebaseのappインスタンスとdatabaseインスタンス、authインスタンスを受け取るように変更
export async function initNotifications(firebaseApp, databaseInstance, authInstance) {
    console.log('[fcmpush.js] initNotifications 開始');
    if (isFCMInitialized) {
        console.log('[fcmpush.js] FCMは既に初期化済みです。');
        return;
    }

    try {
        if (!firebaseApp) {
            console.error('[fcmpush.js] Firebaseアプリが未定義です。');
            return;
        }

        console.log('[fcmpush.js] FCMサービス初期化開始');
        // 渡されたfirebaseAppインスタンスからMessagingサービスを取得
        messaging = getMessaging(firebaseApp);
        db = databaseInstance; // Databaseインスタンスを保持
        isFCMInitialized = true;
        console.log('[fcmpush.js] FCMサービス初期化成功。');

        // メッセージ受信時のハンドラを設定
        // onMessage はフォアグラウンドで動作しているアプリがメッセージを受信したときにトリガーされます。
        onMessage(messaging, (payload) => { // getMessagingから取得したmessagingインスタンスを渡す
            console.log('[fcmpush.js] フォアグラウンドプッシュメッセージ受信:', payload);
            const notificationTitle = payload.notification.title;
            const notificationOptions = {
                body: payload.notification.body,
                icon: payload.notification.icon || '/learning/english-words/chat/images/icon.png',
                data: payload.data, // カスタムデータを渡す
            };

            // 通知音を鳴らす
            notifyNewMessage(notificationOptions);

            // 通知を表示 (サービスワーカーの showNotification とは異なる)
            // この通知は、ブラウザがアクティブなタブである場合に表示されます。
            if (Notification.permission === 'granted') {
                new Notification(notificationTitle, notificationOptions);
            }
        });

        // トークン更新時のハンドラを設定
        // onTokenRefreshはFirebase SDK v9+では非推奨であり、getToken()が自動的にトークンを更新します。
        // しかし、互換レイヤーを使用しているため、念のため残しますが、getToken()の呼び出しで十分です。
        // onTokenRefresh(messaging, async () => { // getMessagingから取得したmessagingインスタンスを渡す
        //     console.log('[fcmpush.js] FCMトークンが更新されました。');
        //     try {
        //         if (authInstance.currentUser) {
        //             const refreshedToken = await getToken(messaging); // getMessagingから取得したmessagingインスタンスを渡す
        //             await saveFCMToken(authInstance.currentUser.uid, refreshedToken);
        //             console.log('[fcmpush.js] 新しいFCMトークンをFirebaseに保存しました。');
        //         }
        //     } catch (error) {
        //         console.error('[fcmpush.js] FCMトークン更新と保存エラー:', error);
        //     }
        // });

    } catch (error) {
        console.error('[fcmpush.js] FCMサービス初期化エラー:', error);
        // エラーを再スローして、呼び出し元で処理できるようにする
        throw error;
    }
}

// 通知許可をリクエストし、FCMトークンを取得する関数
export async function requestNotificationPermission(serviceWorkerRegistration) {
    console.log('[fcmpush.js] 通知許可をリクエスト中...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('[fcmpush.js] 通知許可が与えられました。');
            // FCMトークンを取得
            // VAPIDキーはFirebaseプロジェクト設定の「Cloud Messaging」タブで確認できます。

            // ★ここを修正: サービスワーカーの登録を明示的に指定
            // fcmpush.js は /learning/english-words/chat/chat/fcmpush.js
            // firebase-messaging-sw.js は /learning/english-words/chat/firebase-messaging-sw.js
            // なので、相対パスは '../firebase-messaging-sw.js' になります。
            const registration = await navigator.serviceWorker.getRegistration('../firebase-messaging-sw.js'); // 相対パスを指定

            let currentToken;
            if (registration) {
                currentToken = await getToken(messaging, {
                    vapidKey: 'BKsBnmdJMsGJqwWG6tsEYPKA5OAsesBv6JEUAuNojta_lXqw1vMRAe8f1zFCNdyr4OckeZ4RV-3AsO9gWubUYKw', // ★あなたのVAPIDキーに置き換えてください
                    serviceWorkerRegistration: registration // 登録済みのサービスワーカーを渡す
                });
            } else {
                console.warn('[fcmpush.js] サービスワーカーがまだ登録されていません。デフォルトの動作を試みます。');
                currentToken = await getToken(messaging, { vapidKey: 'BKsBnmdJMsGJqwWG6tsEYPKA5OAsesBv6JEUAuNojta_lXqw1vMRAe8f1zFCNdyr4OckeZ4RV-3AsO9gWubUYKw' }); // ★あなたのVAPIDキーに置き換えてください
            }

            if (currentToken) {
                console.log('[fcmpush.js] FCMクライアントトークン:', currentToken);
                return currentToken;
            } else {
                console.warn('[fcmpush.js] FCMトークンを取得できませんでした。');
                return null;
            }
        } else {
            console.warn('[fcmpush.js] 通知許可が拒否されました。');
            return null;
        }
    } catch (error) {
        console.error('[fcmpush.js] 通知許可リクエストまたはトークン取得エラー:', error);
        return null;
    }
}

// FCMトークンをFirebase Realtime Databaseに保存する関数
export async function saveFCMToken(userId, token) {
    if (!userId || !token) {
        console.warn('[fcmpush.js] userIdまたはトークンが無効なため、FCMトークンの保存をスキップします。');
        return;
    }
    try {
        // 渡されたdbインスタンスとref関数を使用
        const userTokenRef = ref(db, `users/${userId}/fcmToken`); 
        await set(userTokenRef, token);
        console.log(`[fcmpush.js] ユーザー ${userId} のFCMトークンを保存しました。`);
    } catch (error) {
        console.error('[fcmpush.js] FCMトークン保存エラー:', error);
        throw error;
    }
}

// 他のユーザーに通知を送信する関数 (PHPバックエンド経由)
export async function sendNotification(userId, title, body, data = {}, senderUserId = null, username = '匿名') {
    try {
        const validatedUsername = (username && typeof username === 'string' && username.trim() !== '') ? username.trim() : '匿名';
        console.log('[fcmpush.js] 通知送信準備:', { userId, title, body, username: validatedUsername });
        const url = 'https://trextacy.com/chat/send-notification.php'; // ★あなたのPHPスクリプトのURL
        const payload = {
            userId: userId || null, // 受信者のuserId
            title: title || '',
            body: body || '',
            data: { ...data, url: data.url || 'https://soysourcetan.github.io/chat/' }, // デフォルトURLを設定
            senderUserId: senderUserId || null,
            username: validatedUsername
        };
        console.log('[fcmppush.js] 通知送信リクエスト:', payload);
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
        throw error;
    }
}
