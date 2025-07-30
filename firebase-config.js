// firebase-config.js

import { showError } from './utils.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase, ref } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

// === ここから動的なパス決定ロジックを追加/変更 ===
function getAppBasePath() {
    const appUrl = window.location.href; // メインウィンドウのURLを取得

    // GitHub Pages / trextacy.com の場合 (例: https://soysourcetan.github.io/chat/)
    // またはローカルホストのサブディレクトリの場合 (例: http://localhost/learning/english-words/chat/)
    // 'chat/' というパスセグメントを基準にする
    const pathParts = window.location.pathname.split('/');
    const chatIndex = pathParts.indexOf('chat');

    if (chatIndex > -1) {
        // 'chat' が見つかった場合、その手前までをベースパスとする
        return window.location.origin + pathParts.slice(0, chatIndex + 1).join('/') + '/';
    }
    // その他の場合 (例: ルートディレクトリでホストされている場合など)
    return window.location.origin + '/';
}

const configBaseUrl = getAppBasePath(); // 動的に決定されたベースURLを使用

// === ここまで動的なパス決定ロジック ===


async function loadFirebaseConfig() {
    try {
        // 動的に決定された configBaseUrl を使用
        const response = await fetch(`${configBaseUrl}firebase-config.php`, {
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