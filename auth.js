// This file provides functions for Firebase authentication, including sign-in with Twitter, Google, and anonymously.
// It also handles user data updates in the Realtime Database.

import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { ref, set, get, push, update, remove } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js';
import { showError, showSuccess, getClientIp, cleanPhotoURL, cleanUsername, getBasePath } from './utils.js';

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
    const provider = new TwitterAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log('[auth.js] Twitterログイン成功:', user);

        const userId = user.uid;
        const cleanedUsername = cleanUsername(user.displayName || user.email || `ゲスト-${userId.substring(0, 4)}`);
        
        let photoURL = '';
        const twitterProvider = user.providerData.find(p => p.providerId === 'twitter.com');
        if (twitterProvider && twitterProvider.photoURL) {
            // Twitterのプロフィール画像URLの末尾にある "_normal" を "_400x400" に置き換える
            photoURL = twitterProvider.photoURL.replace('_normal', '_400x400');
            console.log('[auth.js] Twitter photoURLを整形しました:', photoURL);
        } else if (user.photoURL) {
            photoURL = user.photoURL;
        } else {
            photoURL = `${getBasePath()}/images/icon.png`; // Fallback to a local default image
        }

        console.log('[auth.js] 使用するphotoURL:', photoURL);

        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            provider: 'twitter',
            ipAddress: await getClientIp(),
            lastUpdate: Date.now(),
        });
        console.log('[auth.js] users DB更新成功');

        const actionData = {
            type: 'login',
            userId: userId,
            username: cleanedUsername,
            provider: 'twitter',
            timestamp: Date.now(),
        };
        await push(ref(database, `actions`), actionData);
        console.log('[auth.js] actions DBにログインを記録しました。');

        showSuccess('Twitterでログインしました！');
        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] Twitterログインエラー:', error);
        showError(`Twitterログインエラー: ${error.message}`);
        throw error;
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Signs a user in with their Google account.
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
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log('[auth.js] Googleログイン成功:', user);

        const userId = user.uid;
        const cleanedUsername = cleanUsername(user.displayName || user.email || `ゲスト-${userId.substring(0, 4)}`);
        
        // Use user.photoURL directly, as it's typically the correct URL for Google.
        const photoURL = user.photoURL || `${getBasePath()}/images/icon.png`;
        console.log('[auth.js] 使用するphotoURL:', photoURL);

        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            provider: 'google',
            ipAddress: await getClientIp(),
            lastUpdate: Date.now(),
        });
        console.log('[auth.js] users DB更新成功');

        const actionData = {
            type: 'login',
            userId: userId,
            username: cleanedUsername,
            provider: 'google',
            timestamp: Date.now(),
        };
        await push(ref(database, `actions`), actionData);
        console.log('[auth.js] actions DBにログインを記録しました。');

        showSuccess('Googleでログインしました！');
        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] Googleログインエラー:', error);
        showError(`Googleログインエラー: ${error.message}`);
        throw error;
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Signs a user in anonymously.
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
        console.log('[auth.js] 匿名ログイン成功:', user);

        const userId = user.uid;
        const cleanedUsername = cleanUsername(`ゲスト-${userId.substring(0, 4)}`);
        // Anonymous users do not have a photoURL, so we explicitly set the default.
        const photoURL = `${getBasePath()}/images/icon.png`;

        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            provider: 'anonymous',
            ipAddress: await getClientIp(),
            lastUpdate: Date.now(),
        });
        console.log('[auth.js] users DB更新成功');

        console.log('[auth.js] 匿名ユーザーのためactionsへの書き込みをスキップしました。');

        showSuccess('匿名でログインしました！');
        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] 匿名ログインエラー:', error);
        showError(`匿名ログインエラー: ${error.message}`);
        throw error;
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Signs the current user out.
 * @param {object} auth - The Firebase Auth instance.
 * @param {object} database - The Firebase Realtime Database instance.
 * @param {string} userId - The ID of the user to sign out.
 */
export async function signOutUser(auth, database, userId) {
    try {
        if (userId) {
            await remove(ref(database, `onlineUsers/${userId}`));
            console.log('[auth.js] onlineUsers から自分を削除しました。');

            const actionData = {
                type: 'logout',
                userId: userId,
                timestamp: Date.now(),
            };
            await push(ref(database, `actions`), actionData);
            console.log('[auth.js] actions DBにログアウトを記録しました。');
        }

        await signOut(auth);
        console.log('[auth.js] ログアウト成功');
        showSuccess('ログアウトしました。');
    } catch (error) {
        console.error('[auth.js] ログアウトエラー:', error);
        showError(`ログアウトエラー: ${error.message}`);
    }
}

/**
 * Updates the user's display name.
 * This function is corrected to only update the username and not the photoURL
 * to prevent accidental overwrites.
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

        // Do not update photoURL here to prevent overwriting existing valid URLs.
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
        showError('ユーザー名の更新に失敗しました。' + error.message);
        throw error;
    }
}
