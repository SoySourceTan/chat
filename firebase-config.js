import { showError } from './utils.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase, ref } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

/**
 * Firebase設定を外部エンドポイントから取得します。
 * @returns {Promise<Object>} Firebase設定オブジェクト。
 * @throws {Error} 設定取得に失敗した場合、コンソールにエラーをログし、showErrorで通知。
 * @remarks
 *   - `https://trextacy.com/firebase-config.php`から設定を取得。
 *   - CORS対応のため`mode: 'cors'`を指定。
 *   - 認証やメッセージ処理の初期化前に呼び出される。
 */
async function loadFirebaseConfig() {
  try {
    const response = await fetch('https://trextacy.com/firebase-config.php', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      mode: 'cors'
    });
    if (!response.ok) {
      throw new Error(`HTTPエラー: ステータス ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[firebase-config.js] Firebase設定取得エラー:', error);
    showError('Firebase設定の取得に失敗しました。');
    throw error;
  }
}

/**
 * Firebaseアプリケーションを初期化し、データベースと認証の参照をセットアップします。
 * @returns {Promise<Object>} 初期化済みのFirebaseオブジェクト（app, database, auth, 各種ref）。
 * @throws {Error} 初期化に失敗した場合、コンソールにエラーをログ。
 * @remarks
 *   - 初期化は1回のみ実行（isInitializedフラグで管理）。
 *   - 認証、メッセージ、ユーザー、アクション、禁止ユーザー、オンラインユーザーの参照を返す。
 *   - `script.js`, `auth.js`, `messages.js`などでインポートして使用。
 */
let app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef;
let isInitialized = false;

async function initializeFirebase() {
  if (isInitialized) {
    return { app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef };
  }
  try {
    const firebaseConfig = await loadFirebaseConfig();
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth = getAuth(app);
    messagesRef = ref(database, 'messages');
    usersRef = ref(database, 'users');
    actionsRef = ref(database, 'actions');
    bannedUsersRef = ref(database, 'bannedUsers');
    onlineUsersRef = ref(database, 'onlineUsers');
    isInitialized = true;
    console.log('[firebase-config.js] Firebase初期化成功');
    return { app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef };
  } catch (error) {
    console.error('[firebase-config.js] 初期化エラー:', error);
    showError('Firebaseの初期化に失敗しました。ページをリロードしてください。');
    throw error;
  }
}

export { initializeFirebase, app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef };