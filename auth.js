// This file provides functions for Firebase authentication, including sign-in with Twitter, Google, and anonymously.
// It also handles user data updates in the Realtime Database.

import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { ref, set, get, push, update, remove } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js';
import { showError, showSuccess, getClientIp, cleanUsername, cleanPhotoURL } from './utils.js';

let isLoggingIn = false;

/**
 * Signs a user in with their Twitter account.
 * On successful login, it saves or updates the user information in the Realtime Database.
 * It specifically handles Twitter's photoURL to get a higher-resolution image.
 * @param {object} auth - The Firebase Auth instance.
 * @param {object} database - The Firebase Realtime Database instance.
 * @param {function} onLoginSuccess - A callback function to execute on successful login.
 */
export async function signInWithTwitter(auth, database, onLoginSuccess) {
    if (isLoggingIn) {
        console.warn('[auth.js] ログイン処理が既に進行中です。');
        return;
    }
    isLoggingIn = true;
    try {
        const provider = new TwitterAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const displayName = user.displayName;
        let photoURL = user.photoURL;

        // TwitterのphotoURLを_normalから_400x400に置換して高解像度化
        // ただし、_normalが含まれている場合のみ置換
        if (photoURL && photoURL.includes('_normal')) {
            photoURL = photoURL.replace('_normal.jpg', '_400x400.jpg');
        }

        // ここが修正点：photoURLが取得できなかった場合はnullを保存
        // nullを保存することで、UI側で頭文字表示のロジックが正しく動くようになります。
        const cleanedPhotoURL = photoURL ? photoURL : null;

        const userId = user.uid;
        const ipAddress = await getClientIp();
        const now = Date.now();
        const username = cleanUsername(displayName || '匿名');

        const userRef = ref(database, `users/${userId}`);
        const userSnapshot = await get(userRef);

        if (userSnapshot.exists()) {
            await update(userRef, {
                username: username,
                photoURL: cleanedPhotoURL, // 修正されたphotoURLを保存
                lastLogin: now,
                lastUpdate: now,
                ipAddress: ipAddress,
            });
            console.log('[auth.js] Twitterログイン成功、既存ユーザーを更新');
        } else {
            await set(userRef, {
                username: username,
                photoURL: cleanedPhotoURL, // 修正されたphotoURLを保存
                provider: 'twitter',
                createdAt: now,
                lastLogin: now,
                lastUpdate: now,
                ipAddress: ipAddress,
            });
            console.log('[auth.js] Twitterログイン成功、新規ユーザーを作成');
        }

        if (onLoginSuccess) {
            onLoginSuccess(user);
        }

    } catch (error) {
        console.error('[auth.js] Twitterログインエラー:', error);
        showError('Twitterログインに失敗しました。', document.getElementById('login-error-alert'));
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Signs a user in with their Google account.
 * On successful login, it saves or updates the user information in the Realtime Database.
 * @param {object} auth - The Firebase Auth instance.
 * @param {object} database - The Firebase Realtime Database instance.
 * @param {function} onLoginSuccess - A callback function to execute on successful login.
 */
export async function signInWithGoogle(auth, database, onLoginSuccess) {
    if (isLoggingIn) {
        console.warn('[auth.js] ログイン処理が既に進行中です。');
        return;
    }
    isLoggingIn = true;
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const displayName = user.displayName;

        // ここが修正点：photoURLが取得できなかった場合はnullを保存
        // nullを保存することで、UI側で頭文字表示のロジックが正しく動くようになります。
        const cleanedPhotoURL = user.photoURL ? user.photoURL : null;

        const userId = user.uid;
        const ipAddress = await getClientIp();
        const now = Date.now();
        const username = cleanUsername(displayName || '匿名');

        const userRef = ref(database, `users/${userId}`);
        const userSnapshot = await get(userRef);

        if (userSnapshot.exists()) {
            await update(userRef, {
                username: username,
                photoURL: cleanedPhotoURL, // 修正されたphotoURLを保存
                lastLogin: now,
                lastUpdate: now,
                ipAddress: ipAddress,
            });
            console.log('[auth.js] Googleログイン成功、既存ユーザーを更新');
        } else {
            await set(userRef, {
                username: username,
                photoURL: cleanedPhotoURL, // 修正されたphotoURLを保存
                provider: 'google.com',
                createdAt: now,
                lastLogin: now,
                lastUpdate: now,
                ipAddress: ipAddress,
            });
            console.log('[auth.js] Googleログイン成功、新規ユーザーを作成');
        }

        if (onLoginSuccess) {
            onLoginSuccess(user);
        }

    } catch (error) {
        console.error('[auth.js] Googleログインエラー:', error);
        showError('Googleログインに失敗しました。', document.getElementById('login-error-alert'));
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Signs in a user anonymously.
 * On successful login, it saves the user information in the Realtime Database.
 * @param {object} auth - The Firebase Auth instance.
 * @param {object} database - The Firebase Realtime Database instance.
 * @param {function} onLoginSuccess - A callback function to execute on successful login.
 */
export async function signInAnonymouslyUser(auth, database, onLoginSuccess) {
    if (isLoggingIn) {
        console.warn('[auth.js] ログイン処理が既に進行中です。');
        return;
    }
    isLoggingIn = true;
    try {
        const result = await signInAnonymously(auth);
        const user = result.user;
        const userId = user.uid;
        const ipAddress = await getClientIp();
        const now = Date.now();
        const defaultUsername = `ゲスト${userId.substring(0, 4)}`;

        const userRef = ref(database, `users/${userId}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            await set(userRef, {
                username: defaultUsername,
                provider: 'anonymous',
                createdAt: now,
                lastLogin: now,
                lastUpdate: now,
                ipAddress: ipAddress,
            });
            console.log('[auth.js] 匿名ログイン成功、新規ユーザーを作成');
        } else {
            await update(userRef, {
                lastLogin: now,
                lastUpdate: now,
                ipAddress: ipAddress,
            });
            console.log('[auth.js] 匿名ログイン成功、既存ユーザーを更新');
        }

        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] 匿名ログインエラー:', error);
        showError('匿名ログインに失敗しました。', document.getElementById('login-error-alert'));
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Signs out the current user.
 * @param {object} auth - The Firebase Auth instance.
 * @returns {Promise<void>}
 */
export async function signOutUser(auth) {
    try {
        await signOut(auth);
        console.log('[auth.js] ログアウト成功');
        showSuccess('ログアウトしました。');
    } catch (error) {
        console.error('[auth.js] ログアウトエラー:', error);
        showError('ログアウトに失敗しました。');
    }
}

/**
 * Updates the user's display name and saves it to the database.
 * @param {object} auth - The Firebase Auth instance.
 * @param {object} database - The Firebase Realtime Database instance.
 * @param {string} newUsername - The new username.
 * @returns {Promise<{updatedUsername: string}>} - The updated username.
 */
export async function updateUsername(auth, database, newUsername) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('ユーザーがログインしていません。');
        }
        const userId = user.uid;
        const cleanedUsername = cleanUsername(newUsername);
        console.log('[auth.js] クリーンアップされたユーザー名:', cleanedUsername);

        await updateProfile(user, {
            displayName: cleanedUsername,
        });
        console.log('[auth.js] Firebase Auth プロフィール更新成功');

        // photoURLはここで更新しません。これは既存の有効なURLを上書きしないようにするためです。
        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            lastUpdate: Date.now(),
        });
        console.log('[auth.js] users 更新成功');

        if (!user.isAnonymous) {
            const actionData = {
                type: 'setUsername',
                userId: userId,
                oldUsername: user.displayName,
                newUsername: cleanedUsername,
                timestamp: Date.now(),
            };
            await push(ref(database, `actions`), actionData);
            console.log('[auth.js] actions 更新成功');
        }

        showSuccess('ユーザー名が更新されました！');
        return { updatedUsername: cleanedUsername };
    } catch (error) {
        console.error('[auth.js] ユーザー名更新エラー:', error);
        showError('ユーザー名の更新に失敗しました。');
        throw error;
    }
}

