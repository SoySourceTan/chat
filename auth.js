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
 * @param {object} actionsRef - Realtime Databaseのアクション参照
 * @param {object} usersRef - Realtime Databaseのユーザー参照
 * @param {function} onLoginSuccess - ログイン成功時のコールバック
 */
export async function signInWithTwitter(auth, database, actionsRef, usersRef, onLoginSuccess) {
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
        const provider = new TwitterAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Firebase Authのプロフィールを更新 (photoURLを最新に保つ)
        await updateProfile(user, {
            displayName: user.displayName || '匿名',
            photoURL: user.photoURL || null // TwitterのphotoURLをそのまま使用
        });

        const cleanedPhotoURL = cleanPhotoURL(user.photoURL, user.uid);
        console.log(`[auth.js] Twitterログイン成功: UID=${user.uid}, DisplayName=${user.displayName}, PhotoURL=${cleanedPhotoURL}`);

        const userIp = await getClientIp();
        const userRef = ref(database, `users/${user.uid}`);
        const userSnapshot = await get(userRef);

        const updates = {};
        const userData = {
            username: user.displayName || '匿名',
            photoURL: cleanedPhotoURL,
            lastLogin: Date.now(),
            ipAddress: userIp,
            providerId: user.providerData[0]?.providerId || 'twitter.com'
        };

        if (userSnapshot.exists()) {
            // 既存ユーザーの情報を更新
            updates[`users/${user.uid}`] = userData;
        } else {
            // 新規ユーザーの情報を設定
            updates[`users/${user.uid}`] = userData;
            updates[`actions/${push(actionsRef).key}`] = {
                type: 'newUser',
                userId: user.uid,
                username: user.displayName || '匿名',
                timestamp: Date.now()
            };
        }

        await update(ref(database), updates); // 一括更新

        showSuccess('Twitterでログインしました！');
        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] Twitterログインエラー:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showError('ログインがキャンセルされました。');
        } else if (error.code === 'auth/cancelled-popup-request') {
            showError('ポップアップがブロックされました。');
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            showError('このメールアドレスは既に別の方法で登録されています。');
        } else {
            showError(`Twitterログインに失敗しました: ${error.message}`);
        }
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Googleでサインインします。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {object} actionsRef - Realtime Databaseのアクション参照
 * @param {object} usersRef - Realtime Databaseのユーザー参照
 * @param {function} onLoginSuccess - ログイン成功時のコールバック
 */
export async function signInWithGoogle(auth, database, actionsRef, usersRef, onLoginSuccess) {
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Firebase Authのプロフィールを更新 (photoURLを最新に保つ)
        await updateProfile(user, {
            displayName: user.displayName || '匿名',
            photoURL: user.photoURL || null // GoogleのphotoURLをそのまま使用
        });

        const cleanedPhotoURL = cleanPhotoURL(user.photoURL, user.uid);
        console.log(`[auth.js] Googleログイン成功: UID=${user.uid}, DisplayName=${user.displayName}, PhotoURL=${cleanedPhotoURL}`);

        const userIp = await getClientIp();
        const userRef = ref(database, `users/${user.uid}`);
        const userSnapshot = await get(userRef);

        const updates = {};
        const userData = {
            username: user.displayName || '匿名',
            photoURL: cleanedPhotoURL,
            lastLogin: Date.now(),
            ipAddress: userIp,
            providerId: user.providerData[0]?.providerId || 'google.com'
        };

        if (userSnapshot.exists()) {
            // 既存ユーザーの情報を更新
            updates[`users/${user.uid}`] = userData;
        } else {
            // 新規ユーザーの情報を設定
            updates[`users/${user.uid}`] = userData;
            updates[`actions/${push(actionsRef).key}`] = {
                type: 'newUser',
                userId: user.uid,
                username: user.displayName || '匿名',
                timestamp: Date.now()
            };
        }

        await update(ref(database), updates); // 一括更新

        showSuccess('Googleでログインしました！');
        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] Googleログインエラー:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showError('ログインがキャンセルされました。');
        } else if (error.code === 'auth/cancelled-popup-request') {
            showError('ポップアップがブロックされました。');
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            showError('このメールアドレスは既に別の方法で登録されています。');
        } else {
            showError(`Googleログインに失敗しました: ${error.message}`);
        }
    } finally {
        isLoggingIn = false;
    }
}

/**
 * 匿名でサインインします。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {object} actionsRef - Realtime Databaseのアクション参照
 * @param {object} usersRef - Realtime Databaseのユーザー参照
 * @param {function} onLoginSuccess - ログイン成功時のコールバック
 */
export async function signInAnonymouslyUser(auth, database, actionsRef, usersRef, onLoginSuccess) {
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
        const result = await signInAnonymously(auth);
        const user = result.user;

        // 匿名ユーザーの場合もphotoURLをnullで更新し、displayNameを設定
        await updateProfile(user, {
            displayName: '匿名ユーザー',
            photoURL: null
        });

        const userIp = await getClientIp();
        const userRef = ref(database, `users/${user.uid}`);
        const userSnapshot = await get(userRef);

        const updates = {};
        const userData = {
            username: user.displayName || '匿名ユーザー',
            photoURL: null, // 匿名ユーザーはphotoURLを持たない
            lastLogin: Date.now(),
            ipAddress: userIp,
            providerId: 'anonymous'
        };

        if (userSnapshot.exists()) {
            updates[`users/${user.uid}`] = userData;
        } else {
            updates[`users/${user.uid}`] = userData;
            updates[`actions/${push(actionsRef).key}`] = {
                type: 'newUser',
                userId: user.uid,
                username: user.displayName || '匿名ユーザー',
                timestamp: Date.now()
            };
        }

        await update(ref(database), updates);

        showSuccess('匿名でログインしました！');
        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] 匿名ログインエラー:', error);
        showError(`匿名ログインに失敗しました: ${error.message}`);
    } finally {
        isLoggingIn = false;
    }
}

/**
 * ユーザーをログアウトさせます。
 * @param {object} auth - Firebase Authインスタンス
 * @param {function} onLogoutSuccess - ログアウト成功時のコールバック
 */
export async function signOutUser(auth, onLogoutSuccess) {
    try {
        await signOut(auth);
        showSuccess('ログアウトしました。');
        if (onLogoutSuccess) {
            onLogoutSuccess();
        }
    } catch (error) {
        console.error('[auth.js] ログアウトエラー:', error);
        showError(`ログアウトに失敗しました: ${error.message}`);
    }
}

/**
 * ユーザー名を更新します。
 * @param {object} auth - Firebase Authインスタンス
 * @param {object} database - Firebase Realtime Databaseインスタンス
 * @param {object} actionsRef - Realtime Databaseのアクション参照
 * @param {string} username - 新しいユーザー名
 * @param {function} onNameUpdateSuccess - ユーザー名更新成功時のコールバック
 */
export async function updateUsername(auth, database, actionsRef, username, onNameUpdateSuccess) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('ユーザーがログインしていません。');
        }

        // Firebase AuthのdisplayNameを更新
        await updateProfile(user, {
            displayName: username
            // photoURLはここでは更新しない。ログイン時に自動的に最新化される想定。
            // もしユーザーが手動でphotoURLを変更できるようにするなら、ここにロジックを追加。
        });

        // Realtime Databaseのユーザー情報も更新
        const userId = user.uid;
        const userRef = ref(database, `users/${userId}`);
        const currentPhotoURL = user.photoURL ? cleanPhotoURL(user.photoURL, userId) : null; // 最新のphotoURLを取得

        const updates = {};
        updates[`users/${userId}/username`] = username;
        updates[`users/${userId}/photoURL`] = currentPhotoURL; // photoURLも更新して常に最新を保つ
        updates[`users/${userId}/lastUpdate`] = Date.now(); // 最終更新日時を追加

        // アクションログにも記録
        const actionRef = push(actionsRef);
        updates[`actions/${actionRef.key}`] = {
            type: 'setUsername',
            userId: userId,
            username: username,
            timestamp: Date.now()
        };

        let retries = 3;
        let success = false;
        let lastError = null;
        while (retries > 0 && !success) {
            try {
                // ここを修正: 各パスに対して個別に update を呼び出す
                // update(ref(database), updates) で一括更新可能
                await update(ref(database), updates);
                success = true;
            } catch (error) {
                lastError = error;
                retries--;
                console.warn(`[auth.js] ユーザー名更新失敗（残りリトライ: ${retries}）:`, error);
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        if (!success) {
            throw lastError || new Error('ユーザー名の保存に失敗しました');
        }

        showSuccess('ユーザー名を更新しました。');
        if (onNameUpdateSuccess) {
            onNameUpdateSuccess(username);
        }
    } catch (error) {
        console.error('[auth.js] ユーザー名更新エラー:', error);
        showError(`ユーザー名の更新に失敗しました: ${error.message}`);
    }
}
