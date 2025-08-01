import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { ref, set, get, push, update, remove } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js';
import { showError, showSuccess, getClientIp, cleanPhotoURL, cleanUsername, getBasePath } from './utils.js';

let isLoggingIn = false;

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
        console.log('[auth.js] Firebaseから受け取ったTwitter photoURL:', user.photoURL); // デバッグ用ログを追加

        // ユーザーデータをRealtime Databaseに保存または更新
        const userId = user.uid;
        const cleanedUsername = cleanUsername(user.displayName || user.email || `ゲスト-${userId.substring(0, 4)}`);
        
        let photoURL = user.photoURL;
        // photoURLが取得できなかった場合のデフォルト画像を設定
        if (!photoURL) {
            photoURL = `${getBasePath()}/images/icon.png`;
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
        let photoURL = cleanPhotoURL(user.photoURL);
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
        } else if (error.code === 'permission_denied') {
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
        
        let photoURL = cleanPhotoURL(user.photoURL);
        console.log('[auth.js] 使用するphotoURL:', photoURL);

        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: photoURL,
            lastLogin: Date.now(),
            provider: 'anonymous',
            ipAddress: await getClientIp(),
            lastUpdate: Date.now(),
        });
        console.log('[auth.js] users DB更新成功');

        showSuccess('ゲストとしてログインしました！');
        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] 匿名ログインエラー:', error);
        if (error.code === 'auth/operation-not-allowed') {
            showError('匿名ログインがFirebaseで有効になっていません。');
        } else if (error.code === 'auth/network-request-failed') {
            showError('ネットワークエラーです。インターネット接続を確認してください。');
        } else if (error.code === 'permission_denied') {
            showError('データベースへのアクセス権限がありません。Firebaseセキュリティルールを確認してください。');
        } else {
            showError(`匿名ログインエラー: ${error.message}`);
        }
        throw error;
    } finally {
        isLoggingIn = false;
    }
}

/**
 * サインアウトします。
 * @param {object} auth - Firebase Authインスタンス
 * @param {function} onLogoutSuccess - サインアウト成功時に呼び出されるコールバック
 */
export async function signOutUser(auth, onLogoutSuccess) {
    try {
        await signOut(auth);
        console.log('[auth.js] サインアウト成功');
        showSuccess('ログアウトしました。');
        if (onLogoutSuccess) {
            onLogoutSuccess();
        }
    } catch (error) {
        console.error('[auth.js] サインアウトエラー:', error);
        showError(`ログアウトエラー: ${error.message}`);
    }
}

/**
 * ユーザー名を更新します。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {string} newUsername - 新しいユーザー名
 * @returns {Promise<{updatedUsername: string, updatedPhotoURL: string}|null>} 更新されたユーザー名とphotoURL、またはエラーの場合はnull
 */
export async function updateUsername(auth, database, newUsername) {
    const user = auth.currentUser;
    if (!user) {
        showError('ユーザーがログインしていません。');
        return null;
    }

    const userId = user.uid;
    const cleanedUsername = cleanUsername(newUsername);

    if (cleanedUsername.length === 0) {
        showError('ユーザー名が空です。');
        return null;
    }

    // updateProfileを使用してFirebase Authの表示名を更新
    await updateProfile(user, {
        displayName: cleanedUsername,
    });
    console.log('[auth.js] Firebase Auth プロフィール更新成功');

    // photoURLは既存のものを維持するか、デフォルトに設定
    let photoURL = user.photoURL;
    if (!photoURL) {
        photoURL = `${getBasePath()}/images/icon.png`;
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
    if (user.isAnonymous) {
        console.log('[auth.js] 匿名ユーザーのためactionsへの書き込みをスキップしました。');
    } else {
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
    return { updatedUsername: cleanedUsername, updatedPhotoURL: photoURL };
}

/**
 * ユーザー名とプロフィール画像を更新します。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {string} newUsername - 新しいユーザー名
 * @param {string} newPhotoURL - 新しいプロフィール画像URL
 * @returns {Promise<{updatedUsername: string, updatedPhotoURL: string}>} - 更新されたユーザー名とphotoURL
 */
export async function updateUsernameAndPhoto(auth, database, newUsername, newPhotoURL) {
    const user = auth.currentUser;
    if (!user) {
        showError('ユーザーがログインしていません。');
        return;
    }

    const userId = user.uid;
    const cleanedUsername = cleanUsername(newUsername);
    const cleanedPhotoURL = cleanPhotoURL(newPhotoURL);

    // Firebase Authのプロフィールを更新
    try {
        await updateProfile(user, {
            displayName: cleanedUsername,
            photoURL: cleanedPhotoURL,
        });
        console.log('[auth.js] Firebase Auth プロフィール更新成功');
    } catch (error) {
        console.error('[auth.js] Firebase Auth プロフィール更新エラー:', error);
        showError('ユーザープロフィールの更新に失敗しました。');
        throw error;
    }

    // Realtime Databaseのユーザー情報を更新
    try {
        await update(ref(database, `users/${userId}`), {
            username: cleanedUsername,
            photoURL: cleanedPhotoURL,
            lastUpdate: Date.now(),
        });
        console.log('[auth.js] users 更新成功');

        // actions ログ
        if (user.isAnonymous) {
            console.log('[auth.js] 匿名ユーザーのためactionsへの書き込みをスキップしました。');
        } else {
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

        showSuccess('ユーザー名とプロフィール画像が更新されました！');
        return { updatedUsername: cleanedUsername, updatedPhotoURL: cleanedPhotoURL };
    } catch (error) {
        console.error('[auth.js] Realtime Database更新エラー:', error);
        showError('データベースの更新に失敗しました。');
        throw error;
    }
}
