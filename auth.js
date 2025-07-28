// auth.js
import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { ref, set, get, push, remove, update } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { showError, showSuccess, getClientIp, cleanPhotoURL } from './utils.js';

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

        // ユーザー情報をデータベースに保存または更新
        const userId = user.uid;
        const username = user.displayName || '匿名';
        const photoURL = cleanPhotoURL(user.photoURL);
        const ipAddress = await getClientIp();

        await set(ref(database, `users/${userId}`), {
            username: username,
            photoURL: photoURL,
            lastLogin: Date.now(),
            ipAddress: ipAddress,
            provider: 'twitter'
        });

        // アクションログに記録
        await push(ref(database, `actions`), {
            type: 'login',
            userId: userId,
            provider: 'twitter',
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

        // ユーザー情報をデータベースに保存または更新
        const userId = user.uid;
        const username = user.displayName || '匿名';
        const photoURL = cleanPhotoURL(user.photoURL);
        const ipAddress = await getClientIp();

        await set(ref(database, `users/${userId}`), {
            username: username,
            photoURL: photoURL,
            lastLogin: Date.now(),
            ipAddress: ipAddress,
            provider: 'google'
        });

        // アクションログに記録
        await push(ref(database, `actions`), {
            type: 'login',
            userId: userId,
            provider: 'google',
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
        const defaultUsername = `ゲスト-${userId.substring(0, 4)}`;
        const photoURL = `${getBasePath()}images/icon.png`; // 匿名ユーザーのデフォルトアイコン

        const ipAddress = await getClientIp();

        // データベースにユーザー情報を保存または更新
        await set(ref(database, `users/${userId}`), {
            username: defaultUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            ipAddress: ipAddress,
            provider: 'anonymous'
        });

        // アクションログに記録
        await push(ref(database, `actions`), {
            type: 'login',
            userId: userId,
            provider: 'anonymous',
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
// auth.js (updateUsername 関数の修正版)
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
    console.log('[auth.js] 認証ユーザー情報:', {
        uid: userId,
        displayName: user.displayName,
        email: user.email,
    });

    try {
        await updateProfile(user, {
            displayName: username,
        });
        console.log('[auth.js] Firebase Auth プロフィール更新成功');
    } catch (error) {
        console.error('[auth.js] Firebase Auth プロフィール更新エラー:', error);
        showError(`ユーザー名の更新に失敗しました (Auth): ${error.message}`);
        throw error;
    }

    const currentPhotoURL =
        user.photoURL && !user.photoURL.includes('icon.png')
            ? cleanPhotoURL(user.photoURL)
            : '/learning/english-words/chat/images/icon.png';

    try {
        await update(ref(database, `users/${userId}`), {
            username: String(username),
            photoURL: currentPhotoURL,
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
            username: String(username),
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
        onNameUpdateSuccess(username, currentPhotoURL);
    }
}