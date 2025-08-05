import { GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { ref, set, get, push, update, remove } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js';
// utils.jsから必要な関数のみをインポート
import { showError, showSuccess, getClientIp, cleanUsername, cleanPhotoURL } from './utils.js';

// ログイン状態のフラグ
let isLoggingIn = false;

// NOTE: 重複しており、誤判定の原因となっていたisValidProfileURL関数は削除しました。

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
    try {
        const provider = new TwitterAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        console.log('[auth.js] Twitter認証後のuserオブジェクト:', {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            providerData: user.providerData,
        });

        const username = cleanUsername(user.displayName || '匿名');
        const now = Date.now();
        const ipAddress = await getClientIp();

        // ★ 修正ポイント①: providerDataから真のTwitterアイコンURLを取得
        let providerPhotoURL = null;
        if (Array.isArray(user.providerData)) {
            for (const profile of user.providerData) {
                if (profile.providerId === 'twitter.com' && typeof profile.photoURL === 'string') {
                    providerPhotoURL = profile.photoURL;
                    break;
                }
            }
        }

        // ★ 修正ポイント②: _normal → _400x400 に変換
        if (providerPhotoURL && providerPhotoURL.includes('_normal')) {
            providerPhotoURL = providerPhotoURL.replace('_normal', '_400x400');
            console.log('[auth.js] Twitterプロフィール画像URLを_400x400に変換:', providerPhotoURL);
        }

        // ★ 修正ポイント③: cleanPhotoURLで最終検証
        const photoURLToSave = cleanPhotoURL(providerPhotoURL);
        console.log('[auth.js] cleanPhotoURL適用後のphotoURL:', photoURLToSave);

        const userRef = ref(database, `users/${user.uid}`);
        const userSnapshot = await get(userRef);

        if (userSnapshot.exists()) {
            const existingData = userSnapshot.val();
            if (existingData.photoURL !== photoURLToSave) {
                await update(userRef, {
                    username, photoURL: photoURLToSave, lastLogin: now, lastUpdate: now, ipAddress
                });
                console.log('[auth.js] 既存ユーザー更新（photoURL変更あり）');
            } else {
                await update(userRef, {
                    username, lastLogin: now, lastUpdate: now, ipAddress
                });
                console.log('[auth.js] 既存ユーザー更新（photoURL変更なし）');
            }
        } else {
            await set(userRef, {
                username, photoURL: photoURLToSave, provider: 'twitter',
                createdAt: now, lastLogin: now, lastUpdate: now, ipAddress
            });
            console.log('[auth.js] 新規ユーザー作成');
        }

        // ★ 修正ポイント④: Firebase Auth上のプロフィールも更新
        await updateProfile(user, {
            displayName: username,
            photoURL: photoURLToSave
        });
        console.log('[auth.js] Firebase Authのプロフィールを更新しました');

        onLoginSuccess(user);
    } catch (error) {
        console.error('[auth.js] Twitterログインエラー:', error);
        showError('Twitterログイン中にエラーが発生しました。');
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Signs a user in with their Google account.
 * On successful login, it saves or updates the user information in the Realtime Database.
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
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // デバッグ: user オブジェクト全体を記録
        console.log('[auth.js] Google認証後のuserオブジェクト:', {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            providerData: user.providerData,
        });

        const username = cleanUsername(user.displayName || '匿名');
        const now = Date.now();
        const ipAddress = await getClientIp();
        const photoURLFromProvider = user.photoURL; // プロバイダーから取得した元のphotoURL

        // utils.jsのcleanPhotoURLを呼び出して、最終的なURLをクリーンアップ
        // cleanPhotoURLがnullを返す場合、photoURLToSaveもnullになる
        const photoURLToSave = cleanPhotoURL(photoURLFromProvider);
        
        console.log('[auth.js] cleanPhotoURL適用後の最終的なphotoURL (保存用):', photoURLToSave);

        const userRef = ref(database, `users/${user.uid}`);
        const userSnapshot = await get(userRef);

        if (userSnapshot.exists()) {
            const existingData = userSnapshot.val();
            console.log('[auth.js] DBから取得した既存のphotoURL:', existingData.photoURL);

            // 既存のphotoURLと取得したphotoURLToSaveが異なる場合のみ更新
            if (existingData.photoURL !== photoURLToSave) {
                const updates = {
                    username: username,
                    lastLogin: now,
                    lastUpdate: now,
                    ipAddress: ipAddress,
                    photoURL: photoURLToSave, // ここで修正
                };
                await update(userRef, updates);
                console.log('[auth.js] Googleログイン成功、既存ユーザーを更新 (photoURL更新)', { updatedPhotoURL: photoURLToSave });
            } else {
                const updates = {
                    username: username,
                    lastLogin: now,
                    lastUpdate: now,
                    ipAddress: ipAddress,
                };
                await update(userRef, updates);
                console.log('[auth.js] Googleログイン成功、既存ユーザーを更新 (photoURL変更なし)');
            }
        } else {
            await set(userRef, {
                username: username,
                photoURL: photoURLToSave, // ここで修正
                provider: 'google.com',
                createdAt: now,
                lastLogin: now,
                lastUpdate: now,
                ipAddress: ipAddress,
            });
            console.log('[auth.js] Googleログイン成功、新規ユーザーを作成', { photoURL: photoURLToSave });
        }

        onLoginSuccess(user);
    } catch (error) {
        console.error('[auth.js] Googleログインエラー:', error);
        showError('Googleログイン中にエラーが発生しました。');
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

        // デバッグ: user オブジェクト全体を記録
        console.log('[auth.js] 匿名認証後のuserオブジェクト:', {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            providerData: user.providerData,
        });

        const defaultUsername = `ゲスト${user.uid.substring(0, 4)}`;
        const username = cleanUsername(defaultUsername);
        const now = Date.now();
        const ipAddress = await getClientIp();
        const photoURL = null; // 匿名ユーザーはphotoURLをnullに設定
        
        const userRef = ref(database, `users/${user.uid}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            await set(userRef, {
                username: username,
                photoURL: photoURL,
                provider: 'anonymous',
                createdAt: now,
                lastLogin: now,
                lastUpdate: now,
                ipAddress: ipAddress,
            });
            console.log('[auth.js] 匿名ログイン成功、新規ユーザーを作成', { photoURL });
        } else {
            await update(userRef, {
                lastLogin: now,
                lastUpdate: now,
                ipAddress: ipAddress,
            });
            console.log('[auth.js] 匿名ログイン成功、既存ユーザーを更新');
        }

        onLoginSuccess(user);
    } catch (error) {
        console.error('[auth.js] 匿名ログインエラー:', error);
        showError('匿名ログイン中にエラーが発生しました。');
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Signs out the current user.
 * @param {object} auth - The Firebase Auth instance.
 * @param {object} database - The Firebase Realtime Database instance.
 * @param {string} userId - The ID of the user to sign out.
 */
export async function signOutUser(auth, database, userId) {
    try {
        if (userId) {
            await remove(ref(database, `fcmTokens/${userId}`));
            console.log(`[auth.js] FCMトークンをデータベースから削除しました: ${userId}`);
        }
        
        await signOut(auth);
        console.log('[auth.js] サインアウト成功');
    } catch (error) {
        console.error('[auth.js] サインアウトエラー:', error);
        if (error.code === 'PERMISSION_DENIED') {
            showError('ログアウト時にFCMトークンの削除に失敗しました（パーミッションエラー）。Firebase Databaseのセキュリティルールを確認してください。');
        } else {
            showError(`ログアウトに失敗しました: ${error.message}`);
        }
    }
}

/**
 * Updates the user's display name (username) in Firebase Auth and Realtime Database.
 * @param {object} auth - The Firebase Auth instance.
 * @param {object} database - The Firebase Realtime Database instance.
 * @param {string} newUsername - The new username to set.
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
        showError('ユーザー名の更新中にエラーが発生しました。');
        throw error;
    }
}