// fcmpush.js
// Firebase SDKのバージョンを11.2.0に統一し、モジュール版を使用
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js'; // 11.2.0のモジュール版に統一
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js'; // 11.2.0のモジュール版に統一
import { initNotify, notifyNewMessage } from '../notifysound.js';
import { showError } from '../utils.js';

const VAPID_KEY = 'BKsBnmdJMsGJqwWG6tsEYPKA5OAsesBv6JEUAuNojta_lXqw1vMRAe8f1zFCNdyr4OckeZ4RV-3AsO9gWubUYKw';

let messaging = null;
let db = null;
let auth = null;
let isFCMInitialized = false;
let serviceWorkerRegistrationInstance = null;
let firebaseAppInstance = null; // Firebase App インスタンスを保持する変数

/**
 * FCMサービスを初期化します。
 * この関数はFirebaseアプリとデータベースインスタンスが既に初期化されていることを前提とします。
 * @param {object} appInstance - Firebaseアプリインスタンス
 * @param {object} databaseInstance - Firebase Realtime Databaseインスタンス
 * @param {ServiceWorkerRegistration} swRegistration - サービスワーカー登録インスタンス
 */
export async function initNotifications(appInstance, databaseInstance, swRegistration) {
    console.log('[fcmpush.js] initNotifications 開始。初期化済み:', isFCMInitialized, 'firebaseApp:', appInstance, 'databaseInstance:', databaseInstance, 'swRegistration:', swRegistration);
    if (isFCMInitialized) {
        console.log('[fcmpush.js] FCMは既に初期化済みです。');
        return;
    }

    // インスタンスをグローバル変数に設定
    firebaseAppInstance = appInstance;
    db = databaseInstance;
    auth = getAuth(firebaseAppInstance);
    serviceWorkerRegistrationInstance = swRegistration;

    const waitForServiceWorkerActive = (reg) => {
        return new Promise(resolve => {
            if (reg.active) {
                console.log('[fcmpush.js] Service Workerは既にアクティブです。');
                return resolve(reg.active);
            }

            const worker = reg.installing || reg.waiting;
            if (worker) {
                worker.addEventListener('statechange', () => {
                    if (worker.state === 'activated') {
                        console.log('[fcmpush.js] Service Workerがアクティブになりました。');
                        resolve(reg.active);
                    }
                });
            } else {
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                console.log('[fcmpush.js] Service Workerが新しくアクティブになりました。');
                                resolve(reg.active);
                            }
                        });
                    }
                });
            }
        });
    };

    try {
        if (serviceWorkerRegistrationInstance) {
            console.log('[fcmpush.js] Service Workerアクティブ化を待機中...');
            await waitForServiceWorkerActive(serviceWorkerRegistrationInstance);
            console.log('[fcmpush.js] Service Workerアクティブ化完了。');
        } else {
            console.warn('[fcmpush.js] serviceWorkerRegistrationInstance がnullのため、Service Workerの準備を待てません。FCM初期化をスキップする可能性があります。');
            throw new Error('Service Worker registration is not available.');
        }

        try {
            messaging = getMessaging(firebaseAppInstance);
            console.log('[fcmpush.js] FCMサービスインスタンス取得成功。');

            if (Notification.permission === 'granted') {
                console.log('[fcmpush.js] 通知許可済みのため、FCMトークンの先行取得を試みます。');
                const tempToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: serviceWorkerRegistrationInstance
                });
                if (tempToken) {
                    console.log('[fcmpush.js] FCMトークンの先行取得に成功:', tempToken.substring(0, 10) + '...');
                } else {
                    console.warn('[fcmpush.js] FCMトークンの先行取得はできませんでした。');
                }
            } else {
                console.log('[fcmpush.js] 通知が許可されていないため、FCMトークンの先行取得はスキップします。');
            }

            isFCMInitialized = true; // FCM初期化成功フラグをここでセット

            onMessage(messaging, (payload) => {
                console.log('[fcmpush.js] フォアグラウンドメッセージを受信しました:', payload);
                if (payload.notification) {
                    notifyNewMessage({
                        title: payload.notification.title || '新しいメッセージ',
                        body: payload.notification.body || 'チャットに新着メッセージがあります。',
                        iconUrl: './images/icon.png'
                    });
                } else {
                    console.warn('[fcmpush.js] 受信したペイロードに通知データがありません。', payload);
                }
            });
        } catch (innerError) {
            console.error('[fcmpush.js] getMessaging()またはonMessage設定エラー:', innerError);
            showError('通知サービスの初期化に失敗しました。');
            throw innerError;
        }

    } catch (error) {
        console.error('[fcmpush.js] FCM通知サービス初期化の全体的なエラー:', error);
        showError('通知サービスの初期化に失敗しました: ' + error.message);
    }

    if (auth) {
        auth.onAuthStateChanged(async (user) => {
            console.log('[fcmpush.js] 認証状態変更:', user ? user.uid : '未ログイン');
            if (user) {
                if (messaging && serviceWorkerRegistrationInstance) {
                    console.log('[fcmpush.js] 認証済みユーザー、Service Worker登録済み。FCMトークン取得を試みます。');
                    const token = await requestNotificationPermission();
                    if (token) {
                        await saveFCMToken(user.uid, token);
                    } else {
                        console.warn('[fcmpush.js] FCMトークンが取得できませんでした (権限拒否またはSW未登録)。');
                    }
                } else {
                    console.log('[fcmpush.js] MessagingインスタンスまたはService Workerが利用できないため、FCMトークンを取得しません。');
                }
            } else {
                console.log('[fcmpush.js] ユーザーが未ログインのため、FCMトークンを取得しません。');
            }
        });
    } else {
        console.error('[fcmpush.js] Firebase Authインスタンスが利用できません。認証状態の監視ができません。');
        showError('認証サービスの初期化に失敗しました。');
    }
}

/**
 * 通知権限を要求し、FCMトークンを取得します。
 * @returns {Promise<string|null>} FCMトークン、または許可が拒否された場合はnull
 */
export async function requestNotificationPermission() {
    console.log('[fcmpush.js] requestNotificationPermission 開始。Messagingインスタンス:', messaging, 'swRegistration:', serviceWorkerRegistrationInstance);
    if (!messaging) {
        console.error('[fcmpush.js] Messagingインスタンスが初期化されていません。initNotificationsが呼び出されていることを確認してください。');
        showError('通知サービスが利用できません。');
        return null;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('[fcmpush.js] 通知許可が与えられました。');

            if (serviceWorkerRegistrationInstance) {
                const getTokenOptions = {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: serviceWorkerRegistrationInstance
                };
                const currentToken = await getToken(messaging, getTokenOptions);
                if (currentToken) {
                    console.log('[fcmpush.js] FCMクライアントトークン:', currentToken);
                    return currentToken;
                } else {
                    console.warn('[fcmpush.js] FCMトークンを取得できませんでした (権限拒否またはSW未登録)。');
                    showError('通知トークンが取得できませんでした。');
                    return null;
                }
            } else {
                console.warn('[fcmpush.js] サービスワーカー登録インスタンスが提供されていません。トークン取得スキップ。');
                showError('サービスワーカーが登録されていないため、通知トークンを取得できません。');
                return null;
            }
        } else {
            console.warn('[fcmpush.js] 通知許可が拒否されました。');
            showError('通知権限が拒否されたため、プッシュ通知は受信できません。');
            return null;
        }
    } catch (error) {
        console.error('[fcmpush.js] 通知許可リクエストまたはトークン取得エラー:', error);

        if (error.code === 'messaging/permission-blocked') {
            console.warn('[fcmpush.js] 通知はブラウザによってブロックされています。');
            showError('通知がブラウザによってブロックされています。設定を確認してください。');
        } else {
            showError(`通知の許可中にエラーが発生しました: ${error.message}`);
        }
        return null;
    }
}

/**
 * FCMトークンをデータベースに保存します。
 * @param {string} userId - ユーザーID
 * @param {string} token - FCMトークン
 * @returns {Promise<string|null>} 保存されたトークン、またはエラーの場合はnull
 */
export async function saveFCMToken(userId, token) {
    console.log('[fcmpush.js] saveFCMToken 開始。ユーザーID:', userId, 'トークン:', token);
    try {
        if (!userId || !token) {
            throw new Error('ユーザーIDまたはトークンが指定されていません。');
        }
        if (!db) {
            throw new Error('データベースインスタンスが初期化されていません。');
        }

        // ユーザーごとに複数のトークンを保存できるように、トークン自体をキーとする
        const tokenRef = ref(db, `fcmTokens/${userId}/${token}`);
        await set(tokenRef, {
            token,
            timestamp: Date.now(),
            userId
        });
        console.log('[fcmpush.js] FCMトークンをデータベースに保存:', token);
        return token;
    } catch (error) {
        console.error('[fcmpush.js] FCMトークン保存エラー:', error);
        showError(`FCMトークンの保存に失敗しました: ${error.message}`);
        return null;
    }
}

/**
 * 通知を送信します。
 * @param {string} userId - 通知を送信するユーザーのID
 * @param {string} title - 通知のタイトル
 * @param {string} body - 通知の本文
 * @param {object} [data={}] - 通知に含める追加データ
 * @param {string|null} [senderUserId=null] - 送信者のユーザーID
 * @param {string} [username='匿名'] - 送信者のユーザー名
 * @returns {Promise<object>} 通知送信APIからのレスポンス
 */
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
