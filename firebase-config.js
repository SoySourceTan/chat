// firebase-config.js

import { showError } from './utils.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase, ref } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

// === Firebase設定を返す外部サーバーのURLを直接指定します ===
// GitHub PagesはPHPを実行できないため、PHPファイルはPHPが動作するサーバーに置く必要があります。
// ここにあなたのfirebase-config.phpがJSONを返す実際のURLを設定してください。
const FIREBASE_CONFIG_EXTERNAL_URL = 'https://trextacy.com/chat/firebase-config.php'; // ★このURLをあなたのものに置き換える

// getAppBasePath 関数と configBaseUrl 変数は、
// 外部サーバーから設定を取得する場合は不要になりますが、
// 他の用途で使われている可能性を考慮し、ここではコメントアウトせず、
// loadFirebaseConfig で直接外部URLを使用するように変更します。

/*
function getAppBasePath() {
    const appUrl = window.location.href;
    const pathParts = window.location.pathname.split('/');
    const chatIndex = pathParts.indexOf('chat');

    if (chatIndex > -1) {
        return window.location.origin + pathParts.slice(0, chatIndex + 1).join('/') + '/';
    }
    return window.location.origin + '/';
}

const configBaseUrl = getAppBasePath();
*/

async function loadFirebaseConfig() {
    try {
        // 動的に決定された configBaseUrl の代わりに、外部サーバーのURLを直接使用
        const response = await fetch(FIREBASE_CONFIG_EXTERNAL_URL, {
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
