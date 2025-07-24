import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { ref, set, get, push, remove, update } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { showError, showSuccess, getClientIp, cleanPhotoURL } from './utils.js'; // ★修正点: cleanPhotoURL をインポート

let isLoggingIn = false;

export async function signInWithTwitter(auth, database, actionsRef, usersRef, onLoginSuccess) {
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
        const provider = new TwitterAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const twitterProfile = result._tokenResponse || {};

        // Twitterの最新プロフィール画像（高解像度）を取得し、クエリパラメータを削除
        // ★修正点: '_normal' を削除し、'?t=' の追加を削除して cleanPhotoURL を適用
        const photoURLFromTwitter = twitterProfile.photoURL ? cleanPhotoURL(twitterProfile.photoURL.replace('_normal', '')) : './images/icon.png';

        // Firebase Authenticationのプロフィールを更新
        await updateProfile(user, { photoURL: photoURLFromTwitter }); // ★修正点: クリーンアップされたURLを使用

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
        let username = existingUserData.username || twitterProfile.displayName || user.displayName || `user${Date.now()}`;
        if (/[.#$/\[\]]/.test(username) || username.length > 50) {
            username = `user${Date.now()}`.slice(0, 50);
        }
        const ipAddress = await getClientIp();

        const updates = {};
        updates[`users/${user.uid}`] = {
            username,
            provider: providerId,
            ipAddress,
            photoURL: photoURLFromTwitter, // ★修正点: クリーンアップされたURLを保存
            email: user.email || null,
            emailVerified: user.emailVerified || false,
            createdAt: existingUserData.createdAt || Date.now(), // 初回ログイン時のみ設定
            providerData: user.providerData.map(p => ({
                uid: p.uid,
                displayName: p.displayName,
                email: p.email,
                phoneNumber: p.phoneNumber,
                photoURL: p.photoURL ? cleanPhotoURL(p.photoURL) : null, // ★修正点: providerData内のphotoURLもクリーンアップ
                providerId: p.providerId
            }))
        };

        // onlineUsersにもphotoURLを追加
        updates[`onlineUsers/${user.uid}`] = {
            username,
            timestamp: Date.now(),
            userId: user.uid,
            photoURL: photoURLFromTwitter // ★修正点: クリーンアップされたURLを保存
        };

        const actionRef = push(actionsRef);
        updates[`actions/${actionRef.key}`] = {
            type: 'connect',
            userId: user.uid,
            username,
            timestamp: Date.now()
        };

        let retries = 3;
        let success = false;
        let lastError = null;
        while (retries > 0 && !success) {
            try {
                // ここを修正: 各パスに対して個別に update を呼び出す
                for (const path in updates) {
                    if (updates.hasOwnProperty(path)) {
                        await update(ref(database, path), updates[path]);
                    }
                }
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

        // GoogleのphotoURLもクリーンアップ
        const cleanedPhotoURL = user.photoURL ? cleanPhotoURL(user.photoURL) : '/chat/images/default-avatar.png'; // ★修正点: クリーンアップを適用

        // Firebase Authenticationのプロフィールを更新
        await updateProfile(user, { photoURL: cleanedPhotoURL }); // ★修正点: クリーンアップされたURLを使用

        // 認証状態の安定を待つ
        await new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((currentUser) => {
                if (currentUser && currentUser.uid === user.uid) {
                    unsubscribe();
                    resolve();
                }
            });
        });

        const providerId = result.providerId || 'google.com';
        const existingUserData = (await get(ref(database, `users/${user.uid}`))).val() || {};
        let username = existingUserData.username || user.displayName || `user${Date.now()}`;
        if (!username || typeof username !== 'string' || username.length === 0 || username.length > 50 || /[.#$/\[\]]/.test(username)) {
            username = `user${Date.now()}`.slice(0, 50);
        }
        const ipAddress = await getClientIp();

        const updates = {};
        updates[`users/${user.uid}`] = {
            username,
            provider: providerId,
            ipAddress,
            photoURL: cleanedPhotoURL, // ★修正点: クリーンアップされたURLを保存
            email: user.email || null,
            emailVerified: user.emailVerified || false,
            createdAt: existingUserData.createdAt || Date.now(),
            providerData: user.providerData.map(data => ({
                providerId: data.providerId,
                uid: data.uid,
                displayName: data.displayName,
                photoURL: data.photoURL ? cleanPhotoURL(data.photoURL) : null, // ★修正点: providerData内のphotoURLもクリーンアップ
                email: data.email
            }))
        };

        // onlineUsersにもphotoURLを追加
        updates[`onlineUsers/${user.uid}`] = {
            username,
            timestamp: Date.now(),
            userId: user.uid,
            photoURL: cleanedPhotoURL // ★修正点: クリーンアップされたURLを保存
        };

        const actionRef = push(actionsRef);
        updates[`actions/${actionRef.key}`] = {
            type: 'connect',
            userId: user.uid,
            username,
            timestamp: Date.now()
        };

        let retries = 3;
        let success = false;
        let lastError = null;
        while (retries > 0 && !success) {
            try {
                // ここを修正: 各パスに対して個別に update を呼び出す
                for (const path in updates) {
                    if (updates.hasOwnProperty(path)) {
                        await update(ref(database, path), updates[path]);
                    }
                }
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
        const photoURL = '/chat/images/default-avatar.png'; // 匿名ユーザーのデフォルト画像

        // Firebase Authenticationのプロフィールを更新
        await updateProfile(user, { photoURL: cleanPhotoURL(photoURL) }); // ★修正点: クリーンアップを適用

        // 認証状態の安定を待つ
        await new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((currentUser) => {
                if (currentUser && currentUser.uid === user.uid) {
                    unsubscribe();
                    resolve();
                }
            });
        });

        const uniqueUsername = `anon${Date.now()}`;
        const ipAddress = await getClientIp();

        const updates = {};
        updates[`users/${user.uid}`] = {
            username: uniqueUsername,
            provider: 'anonymous',
            ipAddress,
            photoURL: cleanPhotoURL(photoURL), // ★修正点: クリーンアップを適用して保存
            email: null,
            emailVerified: false,
            createdAt: Date.now(),
            providerData: []
        };

        updates[`onlineUsers/${user.uid}`] = {
            username: uniqueUsername,
            timestamp: Date.now(),
            userId: user.uid,
            photoURL: cleanPhotoURL(photoURL) // ★修正点: クリーンアップを適用して保存
        };

        const actionRef = push(actionsRef);
        updates[`actions/${actionRef.key}`] = {
            type: 'connect',
            userId: user.uid,
            username: uniqueUsername,
            timestamp: Date.now()
        };

        let retries = 3;
        let success = false;
        let lastError = null;
        while (retries > 0 && !success) {
            try {
                // ここを修正: 各パスに対して個別に update を呼び出す
                for (const path in updates) {
                    if (updates.hasOwnProperty(path)) {
                        await update(ref(database, path), updates[path]);
                    }
                }
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

        const userId = auth.currentUser.uid;
        const userRef = ref(database, `users/${userId}`);
        const userDataSnapshot = await get(userRef);
        const userData = userDataSnapshot.exists() ? userDataSnapshot.val() : {};

        const updates = {};
        updates[`users/${userId}`] = {
            ...userData, // 既存のデータを保持
            username: username,
            // photoURLは既存のものを利用しつつクリーンアップ
            photoURL: userData.photoURL ? cleanPhotoURL(userData.photoURL) : '/chat/images/default-avatar.png', // ★修正点: photoURL をクリーンアップして保存
        };
        updates[`onlineUsers/${userId}`] = {
            username: username,
            timestamp: Date.now(),
            userId: userId,
            photoURL: userData.photoURL ? cleanPhotoURL(userData.photoURL) : '/chat/images/default-avatar.png' // ★修正点: photoURL をクリーンアップして保存
        };
        const actionRef = push(actionsRef);
        updates[`actions/${actionRef.key}`] = {
            type: 'setUsername',
            userId: userId,
            username,
            timestamp: Date.now()
        };

        let retries = 3;
        let success = false;
        let lastError = null;
        while (retries > 0 && !success) {
            try {
                // ここを修正: 各パスに対して個別に update を呼び出す
                for (const path in updates) {
                    if (updates.hasOwnProperty(path)) {
                        await update(ref(database, path), updates[path]);
                    }
                }
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