// firebase-init.js
// Firebase SDKのバージョンを11.2.0に統一
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js';
import { getMessaging } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging.js';

let firebaseApp;
let auth;
let db;
let messaging;

/**
 * Firebaseを初期化し、各種サービスインスタンスを返します。
 * この関数は一度だけ呼び出されるべきです。
 * @returns {Promise<{app: object, auth: object, db: object, messaging: object}>}
 */
export async function initializeFirebaseClient() {
    if (firebaseApp) {
        console.log('[firebase-init.js] Firebaseは既に初期化済みです。');
        return { app: firebaseApp, auth, db, messaging };
    }

    try {
        // Firebase設定をロード
        const response = await fetch('https://trextacy.com/chat/firebase-config.php');
        if (!response.ok) {
            throw new Error(`HTTPエラー: ステータス ${response.status}`);
        }
        const firebaseConfig = await response.json();

        // Firebaseアプリを初期化
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getDatabase(firebaseApp);
        messaging = getMessaging(firebaseApp); // Messagingサービスも初期化

        console.log('[firebase-init.js] Firebaseクライアント初期化成功。');
        return { app: firebaseApp, auth, db, messaging };
    } catch (error) {
        console.error('[firebase-init.js] Firebaseクライアント初期化エラー:', error);
        throw error;
    }
}
