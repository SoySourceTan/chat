// This file provides functions for Firebase authentication, including sign-in with Twitter, Google, and anonymously.
// It also handles user data updates in the Realtime Database.

import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { ref, set, get, push, update, remove } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js';
// cleanPhotoURL はauth.js内でphotoURLをDBに保存する際には不要になったため、インポートリストから削除します。
// UI側でDBから取得したphotoURLを処理する際にcleanPhotoURLを使用します。
import { showError, showSuccess, getClientIp, cleanUsername } from './utils.js'; // getBasePathはここで使用しないため削除

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
        // Firebase AuthのdisplayNameを優先し、存在しない場合はメール、それでもない場合はゲスト名とする
        const cleanedUsername = cleanUsername(user.displayName || user.email || `ゲスト-${userId.substring(0, 4)}`);
        
        let photoURL = null; // デフォルトはnullとする
        const twitterProvider = user.providerData.find(p => p.providerId === 'twitter.com');
        
        if (twitterProvider && twitterProvider.photoURL) {
            // Twitterのプロフィール画像URLの末尾にある "_normal" を "_400x400" に置き換える
            photoURL = twitterProvider.photoURL.replace('_normal', '_400x400');
            console.log('[auth.js] Twitter photoURLを整形しました:', photoURL);
        } else if (user.photoURL) {
            // providerDataから取得できなかったが、userオブジェクト自体にphotoURLがある場合
            photoURL = user.photoURL;
            console.log('[auth.js] user.photoURLを使用します:', photoURL);
        }
        // photoURLがnullのままであれば、UI側で頭文字表示のフォールバックが適用されます。

        console.log('[auth.js] データベースに保存するphotoURL:', photoURL);

        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL, // nullまたはTwitterからのURLが保存される
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
        // Firebase AuthのdisplayNameを優先し、存在しない場合はメール、それでもない場合はゲスト名とする
        const cleanedUsername = cleanUsername(user.displayName || user.email || `ゲスト-${userId.substring(0, 4)}`);
        
        // GoogleのphotoURLは通常、そのまま利用します。存在しない場合はnullを保存し、UI側でフォールバックに任せます。
        const photoURL = user.photoURL || null; 
        console.log('[auth.js] データベースに保存するphotoURL:', photoURL);

        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL, // nullまたはGoogleからのURLが保存される
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
        // 匿名ユーザーの場合、photoURLは明示的にnullまたはundefinedとします。
        // UI側で頭文字表示のフォールバックが適用されるため、デフォルト画像へのパスはデータベースに保存しません。
        const photoURL = null;

        console.log('[auth.js] データベースに保存するphotoURL (匿名):', photoURL);

        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL, // nullが保存される
            lastLogin: Date.now(),
            provider: 'anonymous',
            ipAddress: await getClientIp(),
            lastUpdate: Date.now(),
        });
        console.log('[auth.js] users DB更新成功');

        // 匿名ユーザーのログインはactionsログには記録しません。
        // これは、匿名ユーザーの出入りが頻繁である可能性があり、ログが膨大になるのを避けるためです。
        console.log('[auth.js] 匿名ユーザーのためactionsへのログイン記録をスキップしました。');

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
            // onlineUsersから自分自身のエントリを削除
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
        showError('ユーザー名の更新に失敗しました。' + error.message);
        throw error;
    }
}