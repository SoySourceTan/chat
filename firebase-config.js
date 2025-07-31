import { showError } from './utils.js';
       import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js';
       import { getDatabase, ref } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js';
       import { getAuth } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';

       async function loadFirebaseConfig() {
           try {
               const response = await fetch('https://trextacy.com/chat/firebase-config.php', {
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