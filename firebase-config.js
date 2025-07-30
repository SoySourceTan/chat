// firebase-config.js

import { showError } from './utils.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase, ref } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

// Firebaseプロジェクトの設定を直接JavaScriptオブジェクトとして定義します。
// これはFirebase Console > プロジェクト設定 > 全般 > ウェブアプリのSDK設定 から取得できます。
const firebaseConfig = {
    apiKey: 'AIzaSyBLMySLkXyeiL2_QLCdolHTOOA6W3TSfYc',
    authDomain: 'gentle-brace-458923-k9.firebaseapp.com',
    databaseURL: 'https://gentle-brace-458923-k9-default-rtdb.firebaseio.com',
    projectId: 'gentle-brace-458923-k9',
    storageBucket: 'gentle-brace-458923-k9.firebasestorage.app',
    messagingSenderId: '426876531009',
    appId: '1:426876531009:web:021b23c449bce5d72031c0',
    measurementId: 'G-2B5KWNHYED'
};

// Firebase設定を返す関数（同期的に直接オブジェクトを返します）
function loadFirebaseConfig() {
    return firebaseConfig;
}

let app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef;
let isInitialized = false;

// Firebaseサービスを初期化する関数
async function initializeFirebase() {
    if (isInitialized) {
        return { app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef };
    }
    try {
        // loadFirebaseConfig を同期的に呼び出して設定を取得
        const config = loadFirebaseConfig();
        
        app = initializeApp(config); // 取得した設定でFirebaseアプリを初期化
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
        throw error; // エラーを再スローして呼び出し元に伝える
    }
}

export { initializeFirebase, app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef };
