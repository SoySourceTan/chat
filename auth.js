import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { ref, set, get, push, update } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { showError, showSuccess, getClientIp, cleanPhotoURL, cleanUsername } from './utils.js';

let isLoggingIn = false;

// Helper to get base path dynamically
function getBasePath() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
        const pathParts = window.location.pathname.split('/');
        const chatIndex = pathParts.indexOf('chat');
        if (chatIndex > -1) {
            return pathParts.slice(0, chatIndex + 1).join('/') + '/';
        }
        return '/'; // Fallback for local dev if chat not in path
    }
    return '/chat/'; // For deployed versions
}

/**
 * Twitterでサインインします。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {function} onLoginSuccess - ログイン成功時に呼び出されるコールバック
 */
export async function signInWithTwitter(auth, database, onLoginSuccess) {
    if (isLoggingIn) {
        console.warn('[auth.js] ログイン処理が既に進行中です。');
        return;
    }
    isLoggingIn = true;
    try {
        const provider = new TwitterAuthProvider();
        provider.setCustomParameters({
            'lang': 'ja'
        });
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log('[auth.js] Twitterログイン成功:', user);
        console.log('[auth.js] Twitter user.photoURL:', user.photoURL);

        // ユーザー情報をデータベースに保存または更新
        const userId = user.uid;
        const rawUsername = user.displayName || '匿名';
        const cleanedUsername = cleanUsername(rawUsername);
        console.log('[auth.js] 元のユーザー名:', rawUsername, 'クリーンアップ後:', cleanedUsername);

        // プロフィール画像の処理
        let photoURL = cleanPhotoURL(user.photoURL);
        if (!photoURL) {
            console.warn('[auth.js] TwitterのphotoURLが無効または空:', user.photoURL);
            photoURL = `${getBasePath()}images/icon.png`; // デフォルト画像
        }
        console.log('[auth.js] 使用するphotoURL:', photoURL);
        const ipAddress = await getClientIp();

        await set(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            ipAddress: ipAddress,
            provider: 'twitter'
        });

        await push(ref(database, `actions`), {
            type: 'connect',
            userId: userId,
            timestamp: Date.now()
        });

        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
        showSuccess('Twitterでログインしました！');
    } catch (error) {
        console.error('[auth.js] Twitterログインエラー:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showError('Twitterログインがキャンセルされました。');
        } else if (error.code === 'auth/cancelled-popup-request') {
            showError('Twitterログインがキャンセルされました。');
        } else if (error.code === 'auth/auth-domain-config-required') {
            showError('Firebase認証ドメイン設定が必要です。');
        } else if (error.code === 'auth/operation-not-allowed') {
            showError('Twitterログインが有効になっていません。Firebaseコンソールで有効にしてください。');
        } else if (error.code === 'auth/unauthorized-domain') {
            showError('認証ドメインが許可されていません。Firebaseコンソールで設定を確認してください。');
        } else {
            showError(`Twitterログインエラー: ${error.message}`);
        }
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Googleでサインインします。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {function} onLoginSuccess - ログイン成功時に呼び出されるコールバック
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
        console.log('[auth.js] Googleログイン成功:', user);
        console.log('[auth.js] Google user.photoURL:', user.photoURL);

        // ユーザー情報をデータベースに保存または更新
        const userId = user.uid;
        const rawUsername = user.displayName || '匿名';
        const cleanedUsername = cleanUsername(rawUsername);
        console.log('[auth.js] 元のユーザー名:', rawUsername, 'クリーンアップ後:', cleanedUsername);

        // プロフィール画像の処理
        let photoURL = cleanPhotoURL(user.photoURL);
        if (!photoURL) {
            console.warn('[auth.js] GoogleのphotoURLが無効または空:', user.photoURL);
            photoURL = `${getBasePath()}images/icon.png`; // デフォルト画像
        }
        console.log('[auth.js] 使用するphotoURL:', photoURL);
        const ipAddress = await getClientIp();

        await set(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            ipAddress: ipAddress,
            provider: 'google'
        });

        await push(ref(database, `actions`), {
            type: 'login',
            userId: userId,
            timestamp: Date.now()
        });

        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
        showSuccess('Googleでログインしました！');
    } catch (error) {
        console.error('[auth.js] Googleログインエラー:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showError('Googleログインがキャンセルされました。');
        } else if (error.code === 'auth/cancelled-popup-request') {
            showError('Googleログインがキャンセルされました。');
        } else if (error.code === 'auth/auth-domain-config-required') {
            showError('Firebase認証ドメイン設定が必要です。');
        } else if (error.code === 'auth/operation-not-allowed') {
            showError('Googleログインが有効になっていません。Firebaseコンソールで有効にしてください。');
        } else if (error.code === 'auth/unauthorized-domain') {
            showError('認証ドメインが許可されていません。Firebaseコンソールで設定を確認してください。');
        } else {
            showError(`Googleログインエラー: ${error.message}`);
        }
    } finally {
        isLoggingIn = false;
    }
}

/**
 * 匿名でサインインします。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {function} onLoginSuccess - ログイン成功時に呼び出されるコールバック
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
        const rawUsername = `ゲスト-${userId.substring(0, 4)}`;
        const cleanedUsername = cleanUsername(rawUsername); // cleanUsername を適用
        console.log('[auth.js] 元のユーザー名:', rawUsername, 'クリーンアップ後:', cleanedUsername);
        let photoURL = `${getBasePath()}images/icon.png`; // 匿名ユーザーのデフォルトアイコン
        photoURL = cleanPhotoURL(photoURL) || photoURL; // cleanPhotoURL を適用し、無効なら元の値を保持
        console.log('[auth.js] 使用するphotoURL:', photoURL);
        const ipAddress = await getClientIp();

        await set(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            ipAddress: ipAddress,
            provider: 'anonymous'
        });

        await push(ref(database, `actions`), {
            type: 'login',
            userId: userId,
            timestamp: Date.now()
        });

        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
        showSuccess('匿名でログインしました！');
    } catch (error) {
        console.error('[auth.js] 匿名ログインエラー:', error);
        showError(`匿名ログインエラー: ${error.message}`);
    } finally {
        isLoggingIn = false;
    }
}

/**
 * サインアウトします。
 * @param {object} auth - Firebase Authインスタンス
 * @param {function} onLogoutSuccess - ログアウト成功時に呼び出されるコールバック
 */
export async function signOutUser(auth, onLogoutSuccess) {
    try {
        await signOut(auth);
        console.log('[auth.js] ログアウト成功');
        if (onLogoutSuccess) {
            onLogoutSuccess();
        }
        showSuccess('ログアウトしました。');
    } catch (error) {
        console.error('[auth.js] ログアウトエラー:', error);
        showError(`ログアウトエラー: ${error.message}`);
    }
}

/**
 * ユーザー名を更新します。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {string} username - 新しいユーザー名
 * @param {function} onNameUpdateSuccess - ユーザー名更新成功時に呼び出されるコールバック
 * @returns {Promise<void>}
 */
export async function updateUsername(auth, database, username, onNameUpdateSuccess) {
    if (typeof username !== 'string' || username.trim() === '') {
        console.error('[auth.js] 無効なユーザー名:', username);
        showError('ユーザー名は文字列でなければなりません。');
        throw new Error('ユーザー名は文字列でなければなりません。');
    }

    const user = auth.currentUser;
    if (!user) {
        console.error('[auth.js] ログインしていません。');
        showError('ログインしていません。');
        return;
    }

    const userId = user.uid;
    const cleanedUsername = cleanUsername(username);
    console.log('[auth.js] 元のユーザー名:', username, 'クリーンアップ後:', cleanedUsername);

    try {
        await updateProfile(user, {
            displayName: cleanedUsername,
        });
        console.log('[auth.js] Firebase Auth プロフィール更新成功');
    } catch (error) {
        console.error('[auth.js] Firebase Auth プロフィール更新エラー:', error);
        showError(`ユーザー名の更新に失敗しました (Auth): ${error.message}`);
        throw error;
    }

    let photoURL = user.photoURL && !user.photoURL.includes('icon.png')
        ? cleanPhotoURL(user.photoURL)
        : `${getBasePath()}images/icon.png`;
    if (!photoURL) {
        console.warn('[auth.js] photoURLが無効または空:', user.photoURL);
        photoURL = `${getBasePath()}images/icon.png`;
    }
    console.log('[auth.js] 使用するphotoURL:', photoURL);

    try {
        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastUpdate: Date.now(),
        });
        console.log('[auth.js] users 更新成功');
    } catch (error) {
        console.error('[auth.js] users 更新失敗:', error);
        showError(`ユーザー情報更新エラー: ${error.message}`);
        throw error;
    }

    try {
        const actionData = {
            type: 'setUsername',
            userId: userId,
            username: cleanedUsername,
            timestamp: Date.now(),
        };
        console.log('[auth.js] actions 書き込みデータ:', actionData);
        console.log('[auth.js] 認証UID:', auth.currentUser.uid);
        console.log('[auth.js] トークン:', await auth.currentUser.getIdToken());
        const actionLogRef = push(ref(database, `actions`));
        console.log('[auth.js] 書き込みパス:', actionLogRef.toString());
        await set(actionLogRef, actionData);
        console.log('[auth.js] actions 更新成功');
    } catch (error) {
        console.error('[auth.js] actions 更新失敗:', error);
        showError(`アクションログ更新エラー: ${error.message}`);
        throw error;
    }

    showSuccess('ユーザー名を更新しました。');
    if (onNameUpdateSuccess) {
        onNameUpdateSuccess(cleanedUsername, photoURL);
    }
}