// firebase/firebase-service.js
import { initializeFirebase } from './firebase-config.js'; // 既存のfirebase-config.js
import { getDatabase, ref } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';

let firebaseApp, firebaseAuth, firebaseDatabase;
let messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef;

export async function initFirebaseServices() {
    if (!firebaseApp) {
        const { app, auth, database } = await initializeFirebase();
        firebaseApp = app;
        firebaseAuth = auth;
        firebaseDatabase = database;

        messagesRef = ref(database, 'messages');
        usersRef = ref(database, 'users');
        actionsRef = ref(database, 'actions');
        bannedUsersRef = ref(database, 'bannedUsers');
        onlineUsersRef = ref(database, 'onlineUsers');
    }
    return {
        app: firebaseApp,
        auth: firebaseAuth,
        database: firebaseDatabase,
        messagesRef,
        usersRef,
        actionsRef,
        bannedUsersRef,
        onlineUsersRef
    };
}