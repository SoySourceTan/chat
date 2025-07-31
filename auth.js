import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js'; // ★修正点: []と()を削除
import { ref, set, get, push, update, remove } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js'; // ★修正点: []と()を削除
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
    const provider = new TwitterAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log('[auth.js] Twitterログイン成功:', user);

        // ユーザーデータをRealtime Databaseに保存または更新
        const userId = user.uid;
        const cleanedUsername = cleanUsername(user.displayName || user.email || `ゲスト-${userId.substring(0, 4)}`);
        // cleanPhotoURL を使用して photoURL をクリーンアップ
        let photoURL = user.photoURL ? cleanPhotoURL(user.photoURL) : `${getBasePath()}images/icon.png`;
        if (!photoURL || photoURL.trim() === '') {
            console.warn('[auth.js] photoURLが無効または空:', user.photoURL);
            photoURL = `${getBasePath()}images/icon.png`;
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

        // actions ログ
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
        if (error.code === 'auth/popup-closed-by-user') {
            showError('ログインがキャンセルされました。');
        } else if (error.code === 'auth/cancelled-popup-request') {
            showError('ポップアップがブロックされたか、既に開いています。');
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            showError('このメールアドレスは既に別の方法で登録されています。');
        } else if (error.code === 'auth/auth-domain-config-error') {
            showError('Firebase認証ドメインの設定エラーです。Firebase Consoleを確認してください。');
        } else if (error.code === 'auth/operation-not-allowed') {
            showError('TwitterログインがFirebaseで有効になっていません。');
        } else if (error.code === 'auth/network-request-failed') {
            showError('ネットワークエラーです。インターネット接続を確認してください。');
        } else if (error.code === 'permission_denied') { // Realtime DatabaseのPERMISSION_DENIEDエラーをキャッチ
            showError('データベースへのアクセス権限がありません。Firebaseセキュリティルールを確認してください。');
        } else {
            showError(`Twitterログインエラー: ${error.message}`);
        }
        throw error; // エラーを再スローして呼び出し元に伝える
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
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log('[auth.js] Googleログイン成功:', user);

        const userId = user.uid;
        const cleanedUsername = cleanUsername(user.displayName || user.email || `ゲスト-${userId.substring(0, 4)}`);
        let photoURL = user.photoURL ? cleanPhotoURL(user.photoURL) : `${getBasePath()}images/icon.png`;
        if (!photoURL || photoURL.trim() === '') {
            console.warn('[auth.js] photoURLが無効または空:', user.photoURL);
            photoURL = `${getBasePath()}images/icon.png`;
        }
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
        if (error.code === 'auth/popup-closed-by-user') {
            showError('ログインがキャンセルされました。');
        } else if (error.code === 'auth/cancelled-popup-request') {
            showError('ポップアップがブロックされたか、既に開いています。');
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            showError('このメールアドレスは既に別の方法で登録されています。');
        } else if (error.code === 'auth/auth-domain-config-error') {
            showError('Firebase認証ドメインの設定エラーです。Firebase Consoleを確認してください。');
        } else if (error.code === 'auth/operation-not-allowed') {
            showError('GoogleログインがFirebaseで有効になっていません。');
        } else if (error.code === 'auth/network-request-failed') {
            showError('ネットワークエラーです。インターネット接続を確認してください。');
        } else if (error.code === 'permission_denied') { // Realtime DatabaseのPERMISSION_DENIEDエラーをキャッチ
            showError('データベースへのアクセス権限がありません。Firebaseセキュリティルールを確認してください。');
        } else {
            showError(`Googleログインエラー: ${error.message}`);
        }
        throw error;
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
        const cleanedUsername = cleanUsername(`ゲスト-${userId.substring(0, 4)}`);
        let photoURL = `${getBasePath()}images/icon.png`; // 匿名ユーザーはデフォルトアイコン

        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            provider: 'anonymous',
            ipAddress: await getClientIp(),
            lastUpdate: Date.now(),
        });
        console.log('[auth.js] users DB更新成功');

        // 匿名ユーザーの場合、actionsへの書き込みはスキップ
        console.log('[auth.js] 匿名ユーザーのためactionsへの書き込みをスキップしました。');
        // const actionData = {
        //     type: 'login',
        //     userId: userId,
        //     username: cleanedUsername,
        //     provider: 'anonymous',
        //     timestamp: Date.now(),
        // };
        // await push(ref(database, `actions`), actionData);
        // console.log('[auth.js] actions DBに匿名ログインを記録しました。');

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
 * ログアウトします。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {string} userId - ログアウトするユーザーのID
 */
export async function signOutUser(auth, database, userId) {
    try {
        if (userId) {
            // onlineUsersから自分自身を削除
            await remove(ref(database, `onlineUsers/${userId}`));
            console.log('[auth.js] onlineUsers から自分を削除しました。');

            // actions ログ
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
 * ユーザー名を更新します。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {string} newUsername - 新しいユーザー名
 * @param {string} userId - 更新するユーザーのID
 */
export async function updateUsername(auth, database, newUsername, userId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('ユーザーがログインしていません。');
        }

        const cleanedUsername = cleanUsername(newUsername);
        console.log('[auth.js] クリーンアップされたユーザー名:', cleanedUsername);

        // photoURLは既存のものを維持するか、デフォルトに設定
        let photoURL = user.photoURL ? cleanPhotoURL(user.photoURL) : `${getBasePath()}images/icon.png`;
        if (!photoURL || photoURL.trim() === '') {
            console.warn('[auth.js] photoURLが無効または空:', user.photoURL);
            photoURL = `${getBasePath()}images/icon.png`;
        }
        console.log('[auth.js] 使用するphotoURL:', photoURL);

        // Realtime Databaseのユーザー情報を更新
        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastUpdate: Date.now(),
        });
        console.log('[auth.js] users 更新成功');

        // actions ログ
        // 匿名ユーザーの場合はactionsへの書き込みをスキップ
        if (user.isAnonymous) {
            console.log('[auth.js] 匿名ユーザーのためactionsへの書き込みをスキップしました。');
        } else {
            const actionData = {
                type: 'setUsername',
                userId: userId,
                username: cleanedUsername,
                timestamp: Date.now(),
            };
            await push(ref(database, `actions`), actionData);
            console.log('[auth.js] actions 更新成功');
        }

        showSuccess('ユーザー名が更新されました！');
        return true;
    } catch (error) {
        console.error('[auth.js] ユーザー名更新エラー:', error);
        showError(`ユーザー名更新エラー: ${error.message}`);
        throw error;
    }
}
