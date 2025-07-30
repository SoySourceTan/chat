import { getDatabase, ref, get, update } from 'firebase/database';
import { cleanUsername, cleanPhotoURL } from './utils.js';

async function cleanupDatabase() {
    const database = getDatabase();
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    const users = snapshot.val() || {};

    for (const [userId, userData] of Object.entries(users)) {
        let updates = {};
        if (userData.username && typeof userData.username === 'string') {
            const cleanedUsername = cleanUsername(userData.username);
            if (cleanedUsername !== userData.username) {
                console.log(`[クリーンアップ] userId: ${userId}, 元のusername: ${userData.username}, 新しいusername: ${cleanedUsername}`);
                updates.username = cleanedUsername;
            }
        }
        if (userData.photoURL && typeof userData.photoURL === 'string') {
            const cleanedPhotoURL = cleanPhotoURL(userData.photoURL);
            if (!cleanedPhotoURL || cleanedPhotoURL !== userData.photoURL) {
                console.log(`[クリーンアップ] userId: ${userId}, 元のphotoURL: ${userData.photoURL}, 新しいphotoURL: ${cleanedPhotoURL || '/learning/english-words/chat/images/icon.png'}`);
                updates.photoURL = cleanedPhotoURL || '/learning/english-words/chat/images/icon.png';
            }
        }
        if (Object.keys(updates).length > 0) {
            await update(ref(database, `users/${userId}`), updates);
        }
    }

    const messagesRef = ref(database, 'messages');
    const messagesSnapshot = await get(messagesRef);
    const messages = messagesSnapshot.val() || {};

    for (const [messageId, messageData] of Object.entries(messages)) {
        if (messageData.username && typeof messageData.username === 'string') {
            const cleanedUsername = cleanUsername(messageData.username);
            if (cleanedUsername !== messageData.username) {
                console.log(`[クリーンアップ] messageId: ${messageId}, 元のusername: ${messageData.username}, 新しいusername: ${cleanedUsername}`);
                await update(ref(database, `messages/${messageId}`), { username: cleanedUsername });
            }
        }
    }
}

cleanupDatabase().then(() => console.log('データベースクリーンアップ完了')).catch(error => console.error('クリーンアップエラー:', error));