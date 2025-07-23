import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { ref, set, get, push, remove, update } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { showError, showSuccess, getClientIp } from './utils.js';

let isLoggingIn = false;

export async function signInWithTwitter(auth, database, actionsRef, usersRef, onLoginSuccess) {
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
        const provider = new TwitterAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const twitterProfile = result._tokenResponse || {};

        // Twitterの最新プロフィール画像を優先
        const photoURL = twitterProfile.photoUrl || user.photoURL || '/chat/images/default-avatar.png';
        
        // Firebase Authenticationのプロフィールを更新
        await updateProfile(user, { photoURL });

        // 認証状態の安定を待つ
        await new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((currentUser) => {
                if (currentUser && currentUser.uid === user.uid) {
                    unsubscribe();
                    resolve();
                }
            });
        });

        const providerId = result.providerId || 'twitter.com';
        const existingUserData = (await get(ref(database, `users/${user.uid}`))).val() || {};
        let username = existingUserData.username || user.displayName || `user${Date.now()}`;
        if (/[.#$/\[\]]/.test(username) || username.length > 50) {
            username = `user${Date.now()}`.slice(0, 50);
        }
        const ipAddress = await getClientIp();
        const userData = {
            username,
            provider: providerId,
            ipAddress,
            photoURL,
            email: user.email || null,
            emailVerified: user.emailVerified || false
        };

        let retries = 3;
        let success = false;
        let lastError = null;
        while (retries > 0 && !success) {
            try {
                await set(ref(database, `users/${user.uid}`), userData);
                success = true;
            } catch (error) {
                lastError = error;
                retries--;
                console.warn(`[auth.js] Twitterログイン - ユーザーデータ書き込み失敗（残りリトライ: ${retries}）:`, error);
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        if (!success) {
            throw lastError || new Error('ユーザーデータの保存に失敗しました');
        }

        await push(actionsRef, {
            type: 'connect',
            userId: user.uid,
            username,
            timestamp: Date.now()
        });
        showSuccess('Twitterでログインしました。');

        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] Twitterログインエラー:', error.code, error.message);
        showError(`Twitterログインに失敗しました: ${error.message}`);
        throw error;
    } finally {
        isLoggingIn = false;
    }
}

export async function signInWithGoogle(auth, database, actionsRef, usersRef, onLoginSuccess) {
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const photoURL = user.photoURL || '/chat/images/default-avatar.png';

        // Firebase Authenticationのプロフィールを更新
        await updateProfile(user, { photoURL });

        const providerId = result.providerId || 'google.com';
        const existingUserData = (await get(ref(database, `users/${user.uid}`))).val() || {};
        let username = existingUserData.username || user.displayName || `user${Date.now()}`;
        if (!username || typeof username !== 'string' || username.length === 0 || username.length > 50 || /[.#$/\[\]]/.test(username)) {
            username = `user${Date.now()}`.slice(0, 50);
        }
        const ipAddress = await getClientIp();
        const userData = {
            username,
            provider: providerId,
            ipAddress,
            photoURL,
            email: user.email || null,
            emailVerified: user.emailVerified || false,
            providerData: user.providerData.map(data => ({
                providerId: data.providerId,
                uid: data.uid,
                displayName: data.displayName,
                photoURL: data.photoURL,
                email: data.email
            }))
        };

        let retries = 3;
        let success = false;
        let lastError = null;
        while (retries > 0 && !success) {
            try {
                await set(ref(database, `users/${user.uid}`), userData);
                success = true;
            } catch (error) {
                lastError = error;
                retries--;
                console.warn(`[auth.js] Googleログイン - ユーザーデータ書き込み失敗（残りリトライ: ${retries}）:`, error);
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        if (!success) {
            throw lastError || new Error('ユーザーデータの保存に失敗しました');
        }

        await push(actionsRef, {
            type: 'connect',
            userId: user.uid,
            username,
            timestamp: Date.now()
        });
        showSuccess('Googleでログインしました。');

        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] Googleログインエラー:', error.code, error.message);
        showError(`Googleログインに失敗しました: ${error.message}`);
        throw error;
    } finally {
        isLoggingIn = false;
    }
}

export async function signInAnonymouslyUser(auth, database, actionsRef, usersRef, onLoginSuccess) {
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
        const result = await signInAnonymously(auth);
        const user = result.user;
        const photoURL = '/chat/images/default-avatar.png';

        // Firebase Authenticationのプロフィールを更新
        await updateProfile(user, { photoURL });

        const uniqueUsername = `anon${Date.now()}`;
        const ipAddress = await getClientIp();
        const userData = {
            username: uniqueUsername,
            provider: 'anonymous',
            ipAddress,
            photoURL,
            email: null,
            emailVerified: false,
            providerData: []
        };

        let retries = 3;
        let success = false;
        let lastError = null;
        while (retries > 0 && !success) {
            try {
                await set(ref(database, `users/${user.uid}`), userData);
                success = true;
            } catch (error) {
                lastError = error;
                retries--;
                console.warn(`[auth.js] 匿名ログイン - ユーザーデータ書き込み失敗（残りリトライ: ${retries}）:`, error);
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        if (!success) {
            throw lastError || new Error('ユーザーデータの保存に失敗しました');
        }

        await push(actionsRef, {
            type: 'connect',
            userId: user.uid,
            username: uniqueUsername,
            timestamp: Date.now()
        });
        showSuccess('匿名でログインしました。');

        if (onLoginSuccess) {
            onLoginSuccess(user);
        }
    } catch (error) {
        console.error('[auth.js] 匿名ログインエラー:', error.code, error.message);
        showError(`匿名ログインに失敗しました: ${error.message}`);
        throw error;
    } finally {
        isLoggingIn = false;
    }
}

export async function signOutUser(auth, database, actionsRef, onlineUsersRef, currentUsername, onLogoutSuccess) {
    try {
        if (!auth.currentUser) {
            console.warn('[auth.js] ログアウト処理: ユーザーがログインしていません。');
            return;
        }

        await push(actionsRef, {
            type: 'logout',
            userId: auth.currentUser.uid,
            username: currentUsername,
            timestamp: Date.now()
        });
        await remove(ref(database, `onlineUsers/${auth.currentUser.uid}`));
        await signOut(auth);
        showSuccess('ログアウトしました。');

        if (onLogoutSuccess) {
            onLogoutSuccess();
        }
    } catch (error) {
        console.error('[auth.js] ログアウトエラー:', error);
        showError('ログアウトに失敗しました: ' + error.message);
    }
}

export async function updateUsername(auth, database, actionsRef, onlineUsersRef, username, onNameUpdateSuccess) {
    try {
        if (!auth.currentUser) {
            showError('ログインしてください。');
            return;
        }
        if (!username || username.length === 0) {
            throw new Error('ユーザー名を入力してください。');
        }
        if (username.length > 20) {
            throw new Error('ユーザー名は20文字以内にしてください。');
        }
        if (/[.#$/\[\]]/.test(username)) {
            throw new Error('ユーザー名に使用できない文字（. # $ / [ ]）が含まれています。');
        }

        const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
        const updates = {};
        updates[`users/${auth.currentUser.uid}`] = {
            username,
            provider: userData.provider || 'anonymous',
            ipAddress: userData.ipAddress || 'unknown',
            photoURL: userData.photoURL || '/chat/images/default-avatar.png',
            email: userData.email || null,
            emailVerified: userData.emailVerified || false,
            providerData: userData.providerData || []
        };
        updates[`onlineUsers/${auth.currentUser.uid}`] = {
            username,
            timestamp: Date.now(),
            userId: auth.currentUser.uid
        };
        const actionRef = push(actionsRef);
        updates[`actions/${actionRef.key}`] = {
            type: 'setUsername',
            userId: auth.currentUser.uid,
            username,
            timestamp: Date.now()
        };

        let retries = 3;
        let success = false;
        let lastError = null;
        while (retries > 0 && !success) {
            try {
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
        console.error('[auth.js] ユーザー名設定エラー:', error);
        showError(`ユーザー名の保存に失敗しました: ${error.message}`);
        throw error;
    }
}