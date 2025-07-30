// auth.js

import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { ref, set, get, push, update, remove } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { showError, showSuccess, getClientIp, cleanPhotoURL, cleanUsername } from './utils.js';

const isDebug = true; // auth.js 内でのデバッグフラグ

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
        if (isDebug) console.log('[auth.js] ログイン処理中...');
        return;
    }
    isLoggingIn = true;
    try {
        const provider = new TwitterAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        if (isDebug) console.log('[auth.js] Twitterログイン成功:', user);

        const ipAddress = await getClientIp();
        const cleanedUsername = cleanUsername(user.displayName || user.email || '匿名ユーザー');
        const photoURL = cleanPhotoURL(user.photoURL);

        await set(ref(database, `users/${user.uid}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            provider: 'twitter',
            ipAddress: ipAddress,
        });
        if (isDebug) console.log('[auth.js] users DB更新成功');

        await push(ref(database, 'actions'), {
            type: 'login',
            userId: user.uid,
            username: cleanedUsername,
            provider: 'twitter',
            timestamp: Date.now(),
            ipAddress: ipAddress
        });
        if (isDebug) console.log('[auth.js] actions DB更新成功');

        showSuccess('Twitterでログインしました！');
        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] Twitterログインエラー:', error);
        showError(`Twitterログインエラー: ${error.message}`);
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
        if (isDebug) console.log('[auth.js] ログイン処理中...');
        return;
    }
    isLoggingIn = true;
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        if (isDebug) console.log('[auth.js] Googleログイン成功:', user);

        const ipAddress = await getClientIp();
        const cleanedUsername = cleanUsername(user.displayName || user.email || '匿名ユーザー');
        const photoURL = cleanPhotoURL(user.photoURL);

        await set(ref(database, `users/${user.uid}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            provider: 'google',
            ipAddress: ipAddress,
        });
        if (isDebug) console.log('[auth.js] users DB更新成功');

        await push(ref(database, 'actions'), {
            type: 'login',
            userId: user.uid,
            username: cleanedUsername,
            provider: 'google',
            timestamp: Date.now(),
            ipAddress: ipAddress
        });
        if (isDebug) console.log('[auth.js] actions DB更新成功');

        showSuccess('Googleでログインしました！');
        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] Googleログインエラー:', error);
        showError(`Googleログインエラー: ${error.message}`);
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
        if (isDebug) console.log('[auth.js] ログイン処理中...');
        return;
    }
    isLoggingIn = true;
    try {
        const result = await signInAnonymously(auth);
        const user = result.user;
        if (isDebug) console.log('[auth.js] 匿名ログイン成功:', user);

        const ipAddress = await getClientIp();
        const initialUsername = `ゲスト-${user.uid.substring(0, 4)}`;
        const cleanedUsername = cleanUsername(initialUsername);
        if (isDebug) console.log('[auth.js] 元のユーザー名:', initialUsername, 'クリーンアップ後:', cleanedUsername);

        // 匿名ユーザーのphotoURLはデフォルトのアイコン画像を使用
        const defaultPhotoURL = `${getBasePath()}images/icon.png`;
        if (isDebug) console.log('[auth.js] 使用するphotoURL:', defaultPhotoURL);

        await set(ref(database, `users/${user.uid}`), {
            username: cleanedUsername,
            photoURL: defaultPhotoURL, // デフォルトのアイコン画像を設定
            lastLogin: Date.now(),
            provider: 'anonymous',
            ipAddress: ipAddress,
        });
        if (isDebug) console.log('[auth.js] users DB更新成功');

        // ★修正: permissions_deniedエラーを避けるため、actionsRefへの書き込みは一時的にコメントアウト
        // または、Firebase Realtime Databaseのセキュリティルールを更新して、匿名ユーザーが/actionsパスに書き込めるようにする
        // 現状、匿名ユーザーは/actionsに書き込めないため、エラーが発生します。
        // await push(ref(database, 'actions'), {
        //     type: 'login',
        //     userId: user.uid,
        //     username: cleanedUsername,
        //     provider: 'anonymous',
        //     timestamp: Date.now(),
        //     ipAddress: ipAddress
        // });
        // if (isDebug) console.log('[auth.js] actions DB更新成功');

        showSuccess('匿名でログインしました！');
        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] 匿名ログインエラー:', error);
        showError(`匿名ログインエラー: ${error.message}`);
    } finally {
        isLoggingIn = false;
    }
}

/**
 * ログアウトします。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {object} actionsRef - Firebase Realtime Databaseのactions参照
 * @param {object} onlineUsersRef - Firebase Realtime DatabaseのonlineUsers参照
 * @param {string} username - ログアウトするユーザーの現在の表示名
 * @param {function} onLogoutSuccess - ログアウト成功時に呼び出されるコールバック
 */
export async function signOutUser(auth, database, actionsRef, onlineUsersRef, username, onLogoutSuccess) {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            if (isDebug) console.log('[auth.js] 既にログアウト済みです。');
            return;
        }

        const userId = currentUser.uid;

        // onlineUsers から自分を削除
        await remove(ref(database, `onlineUsers/${userId}`));
        if (isDebug) console.log('[auth.js] onlineUsers から自分を削除しました。');

        // アクションを記録
        await push(actionsRef, {
            type: 'logout',
            userId: userId,
            username: cleanUsername(username),
            timestamp: Date.now(),
        });
        if (isDebug) console.log('[auth.js] actions DBにログアウトを記録しました。');

        await signOut(auth);
        if (isDebug) console.log('[auth.js] ログアウト成功');
        showSuccess('ログアウトしました。');

        // ★修正: onLogoutSuccess が関数であることを確認してから呼び出す
        if (typeof onLogoutSuccess === 'function') {
            onLogoutSuccess();
        }

    } catch (error) {
        console.error('[auth.js] ログアウトエラー:', error);
        showError(`ログアウトエラー: ${error.message}`);
    }
}

/**
 * ユーザー名を更新します。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {string} newUsername - 新しいユーザー名
 * @param {function} onSuccess - 更新成功時に呼び出されるコールバック (updatedUsername, updatedPhotoURLを引数に取る)
 */
export async function updateUsername(auth, database, newUsername, onSuccess) {
    const user = auth.currentUser;
    if (!user) {
        showError('ログインしていません。');
        return;
    }

    const userId = user.uid;
    const cleanedUsername = cleanUsername(newUsername);
    if (isDebug) console.log('[auth.js] クリーンアップされたユーザー名:', cleanedUsername);

    let photoURL = user.photoURL;
    // 既存のphotoURLが汎用的なものであれば、デフォルトアイコンを使用
    const isAuthPhotoGeneric = !photoURL || photoURL === '' || photoURL.includes('s96-c/photo.jpg');
    if (user.isAnonymous || isAuthPhotoGeneric) {
        photoURL = `${getBasePath()}images/icon.png`;
    }
    if (isDebug) console.log('[auth.js] 使用するphotoURL:', photoURL);

    try {
        // Realtime Databaseの /users/{userId} パスを更新
        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastUpdate: Date.now(),
        });
        if (isDebug) console.log('[auth.js] users 更新成功');
    } catch (error) {
        console.error('[auth.js] users 更新失敗:', error);
        showError(`ユーザー情報更新エラー: ${error.message}`);
        throw error; // usersへの更新失敗は致命的なので、エラーを再スロー
    }

    // ★★★ ここから修正箇所 ★★★
    try {
        // 匿名ユーザーの場合、actionsへの書き込みはセキュリティルールで拒否される可能性があるためスキップする
        // または、エラーが発生しても処理を中断しないようにする
        if (!user.isAnonymous) { // 匿名ユーザーでない場合のみactionsに書き込む
            const actionData = {
                type: 'setUsername',
                userId: userId,
                username: cleanedUsername,
                timestamp: Date.now(),
            };
            if (isDebug) console.log('[auth.js] actions 書き込みデータ:', actionData);
            const actionLogRef = push(ref(database, `actions`));
            if (isDebug) console.log('[auth.js] 書き込みパス:', actionLogRef.toString());
            await set(actionLogRef, actionData);
            if (isDebug) console.log('[auth.js] actions 更新成功');
        } else {
            if (isDebug) console.log('[auth.js] 匿名ユーザーのためactionsへの書き込みをスキップしました。');
        }
    } catch (error) {
        // actionsへの書き込みエラーは、ユーザー名更新自体をブロックしないようにする
        // 特にPERMISSION_DENIEDエラーは、匿名ユーザーのルール設定によるものなので、警告に留める
        if (error.message && error.message.includes('PERMISSION_DENIED')) {
            console.warn('[auth.js] 匿名ユーザーのactions書き込みで権限エラーが発生しましたが、処理を続行します:', error);
        } else {
            console.error('[auth.js] actions 更新失敗:', error);
            // その他のactions書き込みエラーは、必要に応じてここで再スローすることも検討
            // throw error; // 今回は再スローしないことで、モーダルが閉じるようにする
        }
    }
    // ★★★ ここまで修正箇所 ★★★

    if (onSuccess) {
        onSuccess(cleanedUsername, photoURL);
    }
}

