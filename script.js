// script.js

// 必要なモジュールをインポート
import { initNotifications as initFCM, sendNotification, requestNotificationPermission, saveFCMToken } from './chat/fcmpush.js';
// firebase-config.jsから初期化関数とFirebaseサービスを直接インポート
import { initializeFirebase, app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef } from './firebase-config.js';
import { initNotify, notifyNewMessage } from './notifysound.js';
import { getDatabase, ref, push, onChildAdded, set, get, child, query, orderByChild, limitToLast, endAt, onValue, onDisconnect, remove, update, onChildRemoved, startAfter } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { showError, showSuccess, showToast, getClientIp, setCookie, getCookie, isMobileDevice, escapeHTMLAttribute, cleanPhotoURL, cleanUsername } from './utils.js';
// signOutUser は直接呼び出すため、ここではインポートしない (auth.jsからインポート済みなので修正)
import { signInWithTwitter, signInWithGoogle, signInAnonymouslyUser, signOutUser, updateUsername } from './auth.js';
import { handleImageError } from './ui-manager.js';

// handleImageError をグローバルスコープに公開
window.handleImageError = handleImageError;

// ★★★ 追加: isDebug変数をscript.jsのトップレベルで定義 ★★★
const isDebug = true;

// Firebase初期化とグローバル変数
let globalSwRegistration = null;
let isFCMInitialized = false;
// app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef は
// firebase-config.js から直接インポートされるため、ここでは重複宣言を削除します。
// let app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef; // 初期化を遅延
// let isInitialized = false; // 初期化フラグ

// DOM要素の宣言のみ行い、初期化はDOMContentLoaded内で行う
// unameModal, loginModal は Bootstrap Modal インスタンスなので、DOM要素とは別に宣言
let formEl, messagesEl, inputEl, errorAlert, loginBtn, twitterLogin, googleLogin, anonymousLogin, userInfo;
let unameModalEl, loginModalEl, unameInput, confirmName, onlineUsersEl, compactModeBtn, fontSizeS, fontSizeM, fontSizeL, signOutBtn, newMessageBtn, toggleModeBtn, loadingIndicator, progressOverlay, navbarRow2;
let colorModeDropdown, userColorSelect, colorPicker; // 新たに追加するDOM要素の変数もここで宣言

// Bootstrap Modal インスタンス
let unameModal;
let loginModal;
let deleteConfirmModal; // 削除確認モーダルのインスタンス

let isSending = false;
let isUserScrolledUp = false;
let isEnterSendMode; // 初期化はDOMContentLoaded内
let messagesElScrollHandler = null;
let scrollTimeout = null; // スクロールイベントのデバウンス用
let isLoading = false;
let lastTimestamp = null;
let latestInitialTimestamp = null;
let isCompactMode = false;
let lastActivity = Date.now();
let currentUserPhotoURL;
const userCache = new Map();

// FCM初期化が完了したことを示すPromise
let fcmInitPromise = null;

// GSAP をグローバルスコープで使用
const { gsap } = window;

// ユーザーIDと背景色のマッピング
const userColorMap = new Map();
// 背景色のリスト
const backgroundColors = [
    'bg-user-0', // 薄ピンク
    'bg-user-1', // 黄緑
    'bg-user-2', // 薄紫
    'bg-user-3', // ライトラベンダー
    'bg-user-4', // 水色
    'bg-user-5'  // 薄い水色
];
let colorAssignmentMode; // 初期化はDOMContentLoaded内

// ユーザー背景色割り当て関数 (変更なし)
function assignUserBackgroundColor(userId) {
    try {
        if (userColorMap.has(userId)) {
            return userColorMap.get(userId);
        }

        let colorClass;
        if (isDebug) console.log(`モード: ${colorAssignmentMode}, ユーザー: ${userId}`);
        if (colorAssignmentMode === 'random') {
            const randomIndex = Math.floor(Math.random() * backgroundColors.length);
            colorClass = backgroundColors[randomIndex];
            if (isDebug) console.log(`ランダム割り当て: ${colorClass}`);
        } else if (colorAssignmentMode === 'sequential') {
            const index = userColorMap.size % backgroundColors.length;
            colorClass = backgroundColors[index];
            if (isDebug) console.log(`順番割り当て: ${colorClass} (インデックス: ${index})`);
        } else if (colorAssignmentMode === 'user-selected') {
            if (auth.currentUser && userId === auth.currentUser.uid) {
                const selectedColor = getCookie(`userColor_${userId}`);
                colorClass = selectedColor && backgroundColors.includes(selectedColor)
                    ? selectedColor
                    : backgroundColors[0];
                if (isDebug) console.log(`ユーザー選択（現在のユーザー）: ${colorClass} (クッキー: ${selectedColor})`);
            } else {
                const selectedColor = getCookie(`userColor_${userId}`);
                if (selectedColor && backgroundColors.includes(selectedColor)) {
                    colorClass = selectedColor;
                    if (isDebug) console.log(`ユーザー選択（他のユーザー）: ${colorClass} (クッキー: ${selectedColor})`);
                } else {
                    const index = userColorMap.size % backgroundColors.length;
                    colorClass = backgroundColors[index];
                    if (isDebug) console.log(`ユーザー選択（フォールバック・順番割り当て）: ${colorClass} (インデックス: ${index})`);
                }
            }
        } else {
            console.warn(`不明なモード: ${colorAssignmentMode}`);
            colorClass = backgroundColors[0];
        }

        userColorMap.set(userId, colorClass);
        if (isDebug) console.log(`userColorMap 更新:`, userColorMap);
        return colorClass;
    } catch (error) {
        console.error('背景色割り当てエラー:', error);
        return backgroundColors[0];
    }
}

// ステータスインジケーター更新 (変更なし)
function updateStatusIndicator() {
    try {
        const statusDot = userInfo?.querySelector('.status-dot');
        if (statusDot) {
            const now = Date.now();
            statusDot.classList.toggle('status-active', now - lastActivity < 5 * 60 * 1000);
            statusDot.classList.toggle('status-away', now - lastActivity >= 5 * 60 * 1000);
        }
    } catch (error) {
        console.error('ステータスインジケーター更新エラー:', error);
    }
}

// fetchOnlineUsers (変更なし)
async function fetchOnlineUsers() {
    try {
        const snapshot = await get(onlineUsersRef);
        const users = snapshot.val()
            ? await Promise.all(
                  Object.entries(snapshot.val())
                      .filter(([uid, user]) => uid && user && typeof user === 'object')
                      .map(async ([uid, user]) => {
                          const userRef = ref(database, `users/${uid}`); // database を直接使用
                          const userData = (await get(userRef)).val() || {};
                          return {
                              userId: uid,
                              username: user.username && typeof user.username === 'string' ? user.username : '匿名',
                              photoURL: userData.photoURL && typeof userData.photoURL === 'string' ? `${userData.photoURL}?t=${Date.now()}` : null
                          };
                      })
              )
            : [];
        if (isDebug) console.log('[script.js] オンラインユーザー取得成功:', users);
        return users;
    } catch (error) {
        console.error('[script.js] オンラインユーザー取得エラー:', error);
        return [];
    }
}

// getUserData (変更なし)
async function getUserData(userId) {
    try {
        if (!userId || typeof userId !== 'string') {
            console.warn('[script.js] 無効なuserId:', userId);
            return { userId, username: '匿名', photoURL: null };
        }
        if (userCache.has(userId)) {
            const cachedData = userCache.get(userId);
            if (cachedData && cachedData.userId === userId && typeof cachedData.username === 'string') {
                if (isDebug) console.log('[script.js] キャッシュから取得したユーザーデータ:', cachedData);
                return cachedData;
            }
            userCache.delete(userId);
        }
        const snapshot = await get(ref(database, `users/${userId}`));
        const data = snapshot.val() || { username: '匿名', photoURL: null };
        const userData = { userId, username: '匿名', photoURL: null, ...data };
        if (typeof userData.username !== 'string') {
            console.warn('[script.js] 無効なusername検出:', userData.username);
            userData.username = '匿名';
        }
        if (isDebug) console.log('[script.js] Firebaseから取得したユーザーデータ:', userData);
        userCache.set(userId, userData);
        if (userCache.size > 100) userCache.clear();
        return userData;
    } catch (error) {
        console.error('ユーザーデータ取得エラー:', error);
        return { userId, username: '匿名', photoURL: null };
    }
}

// renderOnlineUsers (オンラインユーザーリストのレンダリング) (変更なし)
function renderOnlineUsers(users) {
    try {
        if (!users || users.length === 0) {
            if (isDebug) console.log('[renderOnlineUsers] ユーザーリストが空です。');
            return '<span class="text-muted">オンラインのユーザーはいません</span>';
        }
        const renderedHtml = users
            .filter(user => user && user.userId && typeof user.userId === 'string')
            .map(({ userId, username, photoURL }) => {
                const displayUsername = username && typeof username === 'string' ? cleanUsername(username) : '匿名';
                const escapedUserId = escapeHTMLAttribute(userId);
                const escapedDisplayUsername = escapeHTMLAttribute(displayUsername);

                const cleanedPhotoURLForError = escapeHTMLAttribute(cleanPhotoURL(photoURL || ''));

                if (isDebug) console.log(`[renderOnlineUsers] userId: ${userId}, username: ${displayUsername}, photoURL: ${photoURL}`);
                return `<span class="online-user" title="${escapedDisplayUsername}" data-user-id="${escapedUserId}">
                    ${photoURL && typeof photoURL === 'string' && photoURL !== '' ?
                        `<img src="${escapeHTMLAttribute(cleanPhotoURL(photoURL))}" alt="${escapedDisplayUsername}のプロフィール画像" class="profile-img" onerror="handleImageError(this, '${escapedUserId}', '${escapedDisplayUsername}', '${cleanedPhotoURLForError}')">` :
                        `<div class="avatar">${displayUsername.charAt(0).toUpperCase()}</div>`}
                </span>`;
            })
            .join('');
        if (isDebug) console.log('[renderOnlineUsers] 生成されたHTML:', renderedHtml);
        return renderedHtml;
    } catch (error) {
        console.error('オンラインユーザー描画エラー:', error);
        return '<span class="text-muted">オンラインユーザーの表示に失敗しました</span>';
    }
}

// script.js（updateOnlineUsersの修正） (変更なし)
async function updateOnlineUsers() {
    try {
        if (!auth.currentUser) {
            if (onlineUsersEl) {
                onlineUsersEl.innerHTML = '<span class="text-muted">ログインしてオンライン状況を確認</span>';
            }
            return;
        }
        const users = await fetchOnlineUsers();
        const limitedUsers = users.slice(0, 50);
        if (onlineUsersEl) {
            onlineUsersEl.innerHTML = renderOnlineUsers(limitedUsers);
            if (isDebug) console.log('[script.js] onlineUsersElにオンラインユーザーをレンダリングしました。');
        }
    } catch (error) {
        console.error('オンラインユーザー更新エラー:', error);
        if (onlineUsersEl) {
            onlineUsersEl.innerHTML = '<span class="text-muted">オンライン状況の取得に失敗</span>';
        }
    }
}

// ユーザーUI更新 (変更なし)
async function updateUserUI(user) {
    try {
        const userInfo = document.getElementById('user-info');
        if (!userInfo) {
            console.error('[updateUserUI] #user-info 要素が見つかりません。');
            return;
        }

        const profileImgInUserInfo = userInfo.querySelector('.profile-img-small');
        let profileAvatarDivInUserInfo = userInfo.querySelector('.avatar-small');
        const usernameTextSpan = userInfo.querySelector('#current-username-display');

        if (user) {
            userCache.delete(user.uid);
            const userData = (await get(ref(database, `users/${user.uid}`))).val() || {};
            if (isDebug) console.log('updateUserUIで取得されたuserData (DBから):', userData);

            let username = userData.username || user.displayName || 'ゲスト';
            username = cleanUsername(username);
            username = username.length > 7 ? username.substring(0, 7) + "..." : username;

            let photoUrlToUse = user.photoURL;
            const isAuthPhotoGeneric = !photoUrlToUse || photoUrlToUse === '' || photoUrlToUse.includes('s96-c/photo.jpg');
            if (isAuthPhotoGeneric && userData.photoURL && userData.photoURL !== '') {
                photoUrlToUse = userData.photoURL;
            }

            if (user.photoURL && user.photoURL !== '' && !isAuthPhotoGeneric && cleanPhotoURL(user.photoURL) !== cleanPhotoURL(userData.photoURL || '')) {
                await update(ref(database, `users/${user.uid}`), { photoURL: user.photoURL });
                photoUrlToUse = user.photoURL;
                if (isDebug) console.log(`[updateUserUI] ユーザー ${user.uid} のphotoURLをAuthからDBに保存/更新しました: ${user.photoURL}`);
            }

            // photoURLが無効な場合のフォールバック
            const cleanedPhotoURL = cleanPhotoURL(photoUrlToUse);
            // getBasePath() は utils.js に移動済みなので、utils.js からインポートするか、直接パスを指定
            photoUrlToUse = cleanedPhotoURL || './images/icon.png';
            if (isDebug) console.log('[updateUserUI] 使用するphotoURL:', photoUrlToUse);

            if (profileImgInUserInfo) {
                if (photoUrlToUse && photoUrlToUse !== '') {
                    profileImgInUserInfo.src = photoUrlToUse + '?t=' + Date.now();
                    profileImgInUserInfo.alt = escapeHTMLAttribute(username);
                    profileImgInUserInfo.dataset.uid = user.uid;
                    profileImgInUserInfo.classList.remove('d-none');
                    if (profileAvatarDivInUserInfo) {
                        profileAvatarDivInUserInfo.classList.add('d-none');
                    }
                } else {
                    profileImgInUserInfo.classList.add('d-none');
                    if (!profileAvatarDivInUserInfo) {
                        profileAvatarDivInUserInfo = document.createElement('div');
                        profileAvatarDivInUserInfo.className = 'avatar-small me-1';
                        const statusDot = userInfo.querySelector('.status-dot');
                        if (statusDot) {
                            userInfo.insertBefore(profileAvatarDivInUserInfo, statusDot.nextSibling);
                        } else if (usernameTextSpan) {
                            userInfo.insertBefore(profileAvatarDivInUserInfo, usernameTextSpan);
                        } else {
                            userInfo.prepend(profileAvatarDivInUserInfo);
                        }
                    }
                    profileAvatarDivInUserInfo.textContent = username.charAt(0).toUpperCase();
                    profileAvatarDivInUserInfo.classList.remove('d-none');
                }
            }

            if (usernameTextSpan) {
                usernameTextSpan.textContent = username;
            } else {
                console.warn('[updateUserUI] #current-username-display 要素が見つかりません。');
            }

            // 以下は変更なし
        } else {
            if (profileImgInUserInfo) {
                profileImgInUserInfo.src = './images/default-avatar.png';
                profileImgInUserInfo.alt = 'ゲスト';
                profileImgInUserInfo.dataset.uid = '';
                profileImgInUserInfo.classList.remove('d-none');
            }
            if (profileAvatarDivInUserInfo) {
                profileAvatarDivInUserInfo.classList.add('d-none');
            }
            if (usernameTextSpan) {
                usernameTextSpan.textContent = 'ゲスト';
            }
            // 以下は変更なし
        }
    } catch (error) {
        console.error('ユーザーUI更新エラー:', error);
        showError('ユーザー情報の更新に失敗しました。');
    }
}

// ユーザーアクティビティ監視 (変更なし)
['click', 'keydown', 'mousemove'].forEach(event => {
    document.addEventListener(event, () => {
        lastActivity = Date.now();
        updateStatusIndicator();
    });
});
setInterval(updateStatusIndicator, 60000);

// ツールチップ管理 (変更なし)
function disposeTooltip(element) {
    try {
        const tooltip = bootstrap.Tooltip.getInstance(element);
        if (tooltip) tooltip.dispose();
    } catch (error) {
        console.error('ツールチップ破棄エラー:', error);
    }
}

function showTooltip(element, title) {
    try {
        disposeTooltip(element);
        new bootstrap.Tooltip(element, { title });
        const tooltip = bootstrap.Tooltip.getInstance(element);
        tooltip.show();
        setTimeout(() => tooltip.hide(), 1000);
    } catch (error) {
        console.error('ツールチップ表示エラー:', error);
    }
}

// コンパクトモード切り替え (変更なし)
if (compactModeBtn) {
    compactModeBtn.addEventListener('click', () => {
        try {
            isCompactMode = !isCompactMode;
            messagesEl.classList.toggle('compact-mode', isCompactMode);
            compactModeBtn.innerHTML = isCompactMode ? '<i class="fas fa-expand"></i>' : '<i class="fas fa-compress"></i>';
            const newTitle = isCompactMode ? '通常モード' : 'コンパクトモード';
            compactModeBtn.setAttribute('aria-label', isCompactMode ? '通常モードに切り替え' : 'コンパクトモードに切り替え');
            compactModeBtn.setAttribute('title', newTitle);
            showTooltip(compactModeBtn, newTitle);
        } catch (error) {
            console.error('コンパクトモード切り替えエラー:', error);
        }
    });
}

// フォントサイズ切り替え (変更なし)
if (fontSizeS) {
    fontSizeS.addEventListener('click', () => {
        try {
            messagesEl.classList.remove('font-size-medium', 'font-size-large');
            messagesEl.classList.add('font-size-small');
            fontSizeS.classList.add('active');
            fontSizeM.classList.remove('active');
            fontSizeL.classList.remove('active');
        } catch (error) {
            console.error('フォントサイズSエラー:', error);
        }
    });
}

if (fontSizeM) {
    fontSizeM.addEventListener('click', () => {
        try {
            messagesEl.classList.remove('font-size-small', 'font-size-large');
            messagesEl.classList.add('font-size-medium');
            fontSizeM.classList.add('active');
            fontSizeS.classList.remove('active');
            fontSizeL.classList.remove('active');
        } catch (error) {
            console.error('フォントサイズMエラー:', error);
        }
    });
}

if (fontSizeL) {
    fontSizeL.addEventListener('click', () => {
        try {
            messagesEl.classList.remove('font-size-small', 'font-size-medium');
            messagesEl.classList.add('font-size-large');
            fontSizeL.classList.add('active');
            fontSizeS.classList.remove('active');
            fontSizeM.classList.remove('active');
        } catch (error) {
            console.error('フォントサイズLエラー:', error);
        }
    });
}

// 送信/改行モード切り替え (変更なし)
if (toggleModeBtn) {
    toggleModeBtn.addEventListener('click', () => {
        try {
            isEnterSendMode = !isEnterSendMode;
            toggleModeBtn.innerHTML = isEnterSendMode ? '<i class="fas fa-paper-plane"></i>' : '<i class="fas fa-level-down-alt fa-rotate-90"></i>';
            const newTitle = isEnterSendMode ? '送信モード' : '改行モード';
            toggleModeBtn.setAttribute('data-bs-title', newTitle);
            toggleModeBtn.setAttribute('aria-label', isEnterSendMode ? '送信モードに切り替え' : '改行モードに切り替え');
            setCookie('enterSendMode', isEnterSendMode, 365);
            showTooltip(toggleModeBtn, newTitle);
            if (isDebug) console.log('入力モード切替:', isEnterSendMode ? '送信モード' : '改行モード', 'クッキー値:', getCookie('enterSendMode'));
        } catch (error) {
            console.error('モード切り替えエラー:', error);
        }
    });
}

// 背景色モード切り替え (auth.currentUser のチェックを考慮) (変更なし)
if (colorModeDropdown) {
    colorModeDropdown.nextElementSibling.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            colorAssignmentMode = e.target.getAttribute('data-mode');
            setCookie('colorAssignmentMode', colorAssignmentMode, 365);
            // auth.currentUser の存在チェックを追加
            if (colorPicker) {
                colorPicker.classList.toggle('show', colorAssignmentMode === 'user-selected' && auth.currentUser);
            }
            userColorMap.clear();
            if (isDebug) console.log('モード変更:', colorAssignmentMode, 'userColorMap リセット');
            reloadMessages();
            showSuccess(`背景色モードを${colorAssignmentMode === 'sequential' ? '順番' : colorAssignmentMode === 'random' ? 'ランダム' : '自分で選択'}に変更しました。`);
        });
    });
}

// ユーザー色選択 (変更なし)
if (userColorSelect) {
    userColorSelect.addEventListener('change', () => {
        try {
            if (!auth.currentUser) {
                showError('ログインしてください。');
                userColorSelect.value = backgroundColors[0];
                return;
            }
            if (colorAssignmentMode !== 'user-selected') {
                showError('背景色モードを「自分で選択」にしてください。');
                userColorSelect.value = getCookie(`userColor_${auth.currentUser.uid}`) || backgroundColors[0];
                return;
            }
            const selectedColor = userColorSelect.value;
            if (backgroundColors.includes(selectedColor)) {
                setCookie(`userColor_${auth.currentUser.uid}`, selectedColor, 365);
                userColorMap.set(auth.currentUser.uid, selectedColor);
                if (isDebug) console.log(`ユーザー ${auth.currentUser.uid} の色選択: ${selectedColor}`);
                reloadMessages();
                const colorName = userColorSelect.options[userColorSelect.selectedIndex].text;
                showSuccess(`メッセージの背景色を${colorName}に変更しました。`);
            } else {
                console.warn(`無効な色選択: ${selectedColor}`);
                showError('無効な色が選択されました。');
                userColorSelect.value = getCookie(`userColor_${auth.currentUser.uid}`) || backgroundColors[0];
            }
        } catch (error) {
            console.error('色選択エラー:', error);
            showError('色の選択に失敗しました。');
            userColorSelect.value = getCookie(`userColor_${auth.currentUser.uid}`) || backgroundColors[0];
        }
    });
}

// inputEl のイベントリスナー（フォーカス、ブラー、キー入力） (変更なし)
if (inputEl) {
    inputEl.addEventListener('focus', (e) => {
        try {
            e.preventDefault();
            document.body.classList.add('keyboard-active');
            if ('virtualKeyboard' in navigator) {
                navigator.virtualKeyboard.addEventListener('geometrychange', () => {
                    try {
                        const { height } = navigator.virtualKeyboard.boundingRect;
                        if (document.activeElement === inputEl && height > 0) {
                            formEl.style.bottom = `${height}px`;
                            inputEl.setAttribute('aria-live', 'polite');
                            inputEl.setAttribute('aria-description', '仮想キーボードが表示されています');
                        } else {
                            formEl.style.bottom = '10px';
                            inputEl.setAttribute('aria-description', '仮想キーボードが非表示です');
                        }
                    } catch (error) {
                        console.error('仮想キーボード処理エラー:', error);
                    }
                });
            }
        } catch (error) {
            console.error('input focusエラー:', error);
        }
    });

    // blur イベント
    inputEl.addEventListener('blur', () => {
        try {
            document.body.classList.remove('keyboard-active');
            if ('virtualKeyboard' in navigator) {
                navigator.virtualKeyboard.hide();
                if (isDebug) console.log('仮想キーボードを非表示');
                formEl.style.bottom = '10px';
            }
        } catch (error) {
            console.error('input blurエラー:', error);
        }
    });

    // キー入力イベント
    inputEl.addEventListener('keydown', (e) => {
        try {
            if (e.key === 'Enter' && !e.shiftKey) {
                if (isEnterSendMode) {
                    e.preventDefault();
                    formEl.dispatchEvent(new Event('submit', { cancelable: true }));
                    if (isDebug) console.log('Enterキー: 送信モードでフォーム送信');
                } else {
                    // 改行モードではデフォルトの改行動作を許可
                    if (isDebug) console.log('Enterキー: 改行モードで改行挿入');
                }
            } else if (e.key === 'Enter' && e.shiftKey) {
                // Shift+Enterは常に改行
                if (isDebug) console.log('Shift+Enter: 改行挿入');
            }
        } catch (error) {
            console.error('キー入力処理エラー:', error);
        }
    });
}
// メッセージスクロール処理 (変更なし)
if (messagesEl) {
    messagesEl.removeEventListener('scroll', messagesEl._scrollHandler);
    let lastScrollTop = 0;
    let scrollTimeout = null;
    window.addEventListener('scroll', () => {
        try {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(async () => {
                const currentScrollTop = window.scrollY;
                isUserScrolledUp = currentScrollTop > 10;
                newMessageBtn.classList.toggle('d-none', !isUserScrolledUp);
                const scrollTopMax = messagesEl.scrollHeight - messagesEl.clientHeight;
                if (messagesEl.scrollTop >= scrollTopMax - 200 && !isLoading) {
                    if (isDebug) console.log('ローディング開始');
                    isLoading = true;
                    loadingIndicator.textContent = '過去の10件のメッセージを読み込み中...';
                    loadingIndicator.style.display = 'block';

                    try {
                        const startTime = performance.now();
                        const messages = messagesEl.querySelectorAll('[data-timestamp]');
                        lastTimestamp = messages.length ? Math.min(...Array.from(messages).map(m => Number(m.getAttribute('data-timestamp')))) : null;

                        if (lastTimestamp) {
                            const olderMessages = await get(query(messagesRef, orderByChild('timestamp'), endAt(lastTimestamp - 1), limitToLast(10)));
                            const olderMessagesArray = olderMessages.val() ? Object.entries(olderMessages.val()).sort((a, b) => b[1].timestamp - a[1].timestamp) : [];

                            const userIds = [...new Set(olderMessagesArray.map(([_, msg]) => msg.userId).filter(id => id != null))];
                            const userDataPromises = userIds.map(async userId => {
                                if (userCache.has(userId)) return { userId, data: userCache.get(userId) };
                                const snapshot = await get(ref(database, `users/${userId}`));
                                const data = snapshot.val() || {};
                                userCache.set(userId, data);
                                return { userId, data };
                            });
                            const userDataArray = await Promise.all(userDataPromises);
                            const userDataMap = Object.fromEntries(userDataArray.map(({ userId, data }) => [userId, data]));

                            for (const [key, { username, message, timestamp, userId = 'anonymous', ipAddress }] of olderMessagesArray) {
                                if (messagesEl.querySelector(`[data-message-id="${key}"]`)) continue;
                                const photoURL = userDataMap[userId]?.photoURL;
                                const li = document.createElement('li');
                                li.className = `list-group-item p-0 m-0 border shadow-sm mb-3 d-flex justify-content-start align-items-start border-0 fade-in ${assignUserBackgroundColor(userId)}`;
                                li.setAttribute('data-message-id', key);
                                li.setAttribute('role', 'listitem');
                                li.setAttribute('data-timestamp', timestamp);
                                const date = timestamp ? new Date(timestamp).toLocaleString('ja-JP') : '不明';
                                const formattedMessage = formatMessage(message);
                                li.innerHTML = `
                                    <div class="message bg-transparent p-2 row">
                                        <div class="col-auto profile-icon">
                                            ${photoURL ?
                                                `<img src="${escapeHTMLAttribute(photoURL)}" alt="${escapeHTMLAttribute(username)}のプロフィール画像" class="profile-img" onerror="handleImageError(this, '${escapeHTMLAttribute(userId)}', '${escapeHTMLAttribute(username)}', '${escapeHTMLAttribute(photoURL)}')">` :
                                                `<div class="avatar">${username.charAt(0).toUpperCase()}</div>`}
                                        </div>
                                        <div class="col-auto message-header p-0 m-0 d-flex align-items-center">
                                            <strong>${escapeHTMLAttribute(username || '匿名')}</strong>
                                            <small class="text-muted ms-2">${date}</small>
                                            ${auth.currentUser && auth.currentUser.uid === userId ?
                                                `<button class="btn btn-sm btn-outline-success ms-2 delete-message" data-message-id="${key}">
                                                    <i class="fa fa-trash"></i>
                                                </button>` : ''}
                                        </div>
                                        <div class="col-12 message-body mt-2">
                                            ${formattedMessage}
                                        </div>
                                    </div>`;
                                messagesEl.appendChild(li);
                                setTimeout(() => li.classList.add('show'), 10);
                            }
                        }
                    } catch (error) {
                        console.error('過去メッセージ取得エラー:', error);
                        showError('過去のメッセージが取得できませんでした。');
                    } finally {
                        isLoading = false;
                        loadingIndicator.textContent = 'ロード中...';
                        loadingIndicator.style.display = 'none';
                    }
                }
            }, 200);
        } catch (error) {
            console.error('スクロール処理エラー:', error);
        }
    });
}

// メッセージフォーマット処理 (変更なし)
function formatMessage(message) {
    try {
        if (!message || typeof message !== 'string') return 'メッセージなし';
        const codeRegex = /```(\w+)?\s*([\s\S]*?)\s*```/g;
        const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
        let formattedMessage = message;
        const codePlaceholder = '___CODE_BLOCK___';
        const codeBlocks = [];
        formattedMessage = formattedMessage.replace(codeRegex, (_, lang, code) => {
            const cleanCode = code.replace(/\n$/, '');
            codeBlocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${cleanCode}</code></pre>`);
            return codePlaceholder + (codeBlocks.length - 1);
        });
        formattedMessage = formattedMessage
            .replace(/\n/g, '<br>')
            .replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        formattedMessage = formattedMessage.replace(new RegExp(`${codePlaceholder}(\\d+)`, 'g'), (_, index) => codeBlocks[index]);
        return DOMPurify.sanitize(formattedMessage, { ADD_ATTR: ['target'], ADD_TAGS: ['pre', 'code'] });
    } catch (error) {
        console.error('メッセージフォーマットエラー:', error);
        return 'メッセージフォーマットエラー';
    }
}

// メッセージ再描画関数 (変更なし)
async function reloadMessages() {
    try {
        if (isDebug) console.log('メッセージ再描画開始, モード:', colorAssignmentMode);
        messagesEl.innerHTML = '';
        await loadInitialMessages();
        setupMessageListener();
        if (isDebug) console.log('メッセージ再描画完了, userColorMap:', userColorMap);
    } catch (error) {
        console.error('メッセージ再描画エラー:', error);
        showError('メッセージの再読み込みに失敗しました。');
    }
    if (auth.currentUser) {
      const userId = auth.currentUser.uid;
      notifyNewMessage();
    }
}

// Twitterログイン認証 (変更なし)
// DOMContentLoaded内でイベントリスナーを設定するため、このブロックは削除します。

// Googleログイン (変更なし)
// DOMContentLoaded内でイベントリスナーを設定するため、このブロックは削除します。

// 匿名ログイン (変更なし)
// DOMContentLoaded内でイベントリスナーを設定するため、このブロックは削除します。

// ログアウト (変更なし)
// DOMContentLoaded内でイベントリスナーを設定するため、このブロックは削除します。

// ユーザー名変更 (変更なし)
// DOMContentLoaded内でイベントリスナーを設定するため、このブロックは削除します。

// タブ点滅機能関連の変数と関数 (変更なし)
let originalTitle = document.title;
let blinkingInterval = null;
let isBlinking = false;

function startTabBlinking() {
    if (isBlinking) return;

    originalTitle = document.title;
    let toggle = false;
    blinkingInterval = setInterval(() => {
        document.title = toggle ? "新しいメッセージ！" : originalTitle;
        toggle = !toggle;
    }, 1000);
    isBlinking = true;

    document.addEventListener('visibilitychange', stopTabBlinking);
    window.addEventListener('focus', stopTabBlinking);
}

function stopTabBlinking() {
    if (blinkingInterval) {
        clearInterval(blinkingInterval);
        blinkingInterval = null;
    }
    if (isBlinking) {
        document.title = originalTitle;
        isBlinking = false;
    }
    document.removeEventListener('visibilitychange', stopTabBlinking);
    window.removeEventListener('focus', stopTabBlinking);
}

// メッセージ送信（修正済み） (変更なし)
if (formEl) { // DOMContentLoadedでformElが取得されるため、このif文は不要になるはずですが、念のため残します。
    formEl._submitHandler = async (e) => {
        try {
            e.preventDefault();

            if (!formEl.checkValidity()) {
                e.stopPropagation();
                formEl.classList.add('was-validated');
                if (isDebug) console.log('[script.js] フォームバリデーション失敗');
                return;
            }

            if (!auth.currentUser) {
                showError('ログインしてください。');
                return;
            }

            const banned = (await get(ref(database, `bannedUsers/${auth.currentUser.uid}`))).val();
            if (banned) {
                showError('あなたはBANされています。メッセージを送信できません。');
                return;
            }

            const message = inputEl.value.trim();
            if (message.length === 0) {
                showError('メッセージを入力してください。');
                return;
            }

            if (isSending) {
                console.warn('[script.js] メッセージ送信連打防止');
                return;
            }

            isSending = true;
            if (isDebug) console.log('[script.js] Enterキー: 送信モードでフォーム送信');

            inputEl.value = '';
            inputEl.textContent = '';
            formEl.classList.remove('was-validated');

            if ('virtualKeyboard' in navigator) {
                navigator.virtualKeyboard.hide();
                if (isDebug) console.log('[script.js] 仮想キーボードを非表示');
            }

            const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
            const cleanedUsername = cleanUsername(userInfo.textContent.replace(/<[^>]+>/g, '').trim());
            const timestamp = Date.now();

            await push(messagesRef, {
                username: cleanedUsername,
                message,
                timestamp,
                userId: auth.currentUser.uid,
                ipAddress: userData.ipAddress || 'unknown'
            });

            await push(actionsRef, {
                type: 'sendMessage',
                userId: auth.currentUser.uid,
                username: cleanedUsername,
                timestamp
            });

            try {
                const notificationTitle = `新しいメッセージ from ${cleanedUsername}`;
                const notificationBody = message.length > 50 ? message.substring(0, 47) + '...' : message;
                const onlineUsers = await fetchOnlineUsers();
                if (isDebug) console.log('[script.js] オンラインユーザー:', onlineUsers);

                const defaultIconPath = './chat/images/icon.png';
                for (const onlineUser of onlineUsers) {
                    if (onlineUser.userId && onlineUser.userId !== auth.currentUser.uid) {
                        if (isDebug) console.log(`[script.js] 通知送信対象: ${onlineUser.userId} (${onlineUser.username})`);
                        await sendNotification(
                            onlineUser.userId,
                            notificationTitle,
                            notificationBody,
                            {
                                url: 'https://soysourcetan.github.io/chat',
                                icon: defaultIconPath
                            },
                            auth.currentUser.uid,
                            cleanedUsername
                        );
                    }
                }
            } catch (notificationError) {
                console.error('[script.js] 通知送信エラー:', notificationError);
            }

            showSuccess('メッセージを送信しました！');

        } catch (error) {
            console.error('[script.js] メッセージ送信エラー:', error);
            showError(`メッセージの送信に失敗しました: ${error.message}`);
        } finally {
            isUserScrolledUp = false;
            newMessageBtn.classList.add('d-none');

            requestAnimationFrame(() => {
                messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
                if (isDebug) console.log('[script.js] メッセージ送信後: トップにスクロール');
            });

            if ('virtualKeyboard' in navigator) {
                formEl.style.bottom = '10px';
                messagesEl.style.maxHeight = '';
                setTimeout(() => {
                    inputEl.focus();
                    inputEl.select();
                }, 300);
            } else {
                inputEl.focus();
                inputEl.select();
            }

            isSending = false;
        }
    };

    formEl.addEventListener('submit', formEl._submitHandler);
}

// テキストエリアの自動リサイズ (変更なし)
if (inputEl) {
    inputEl.addEventListener('focus', (e) => {
        e.preventDefault();
        const currentScrollY = window.scrollY;
        setTimeout(() => {
            window.scrollTo({ top: currentScrollY, behavior: 'auto' });
        }, 100);
        stopTabBlinking();
    });
}

// 初期メッセージ読み込み (変更なし)
async function loadInitialMessages() {
    if (isDebug) console.log('[script.js] loadInitialMessages関数が呼び出されました。');
    try {
        if (!auth.currentUser) {
            if (isDebug) console.log('[script.js] 未ログインのためメッセージ読み込みをスキップ');
            return;
        }
        if (isDebug) console.log('[script.js] ユーザーはログイン済みです:', auth.currentUser.uid);

        if (!progressOverlay) {
            console.warn('[script.js] progress-overlay要素が見つかりません。');
            return;
        }
        progressOverlay.classList.remove('d-none');
        if (isDebug) console.log('[script.js] progressOverlayを表示しました。');

        const startTime = performance.now();
        if (isDebug) console.log('[script.js] メッセージ取得クエリを作成中...');
        const initialMessagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(10));

        if (isDebug) console.log('[script.js] Firebaseからメッセージのスナップショットを取得中...');
        const snapshot = await get(initialMessagesQuery);
        if (isDebug) console.log('[script.js] メッセージのスナップショットを取得しました。snapshot.exists():', snapshot.exists());

        const messages = snapshot.val() ? Object.entries(snapshot.val()).sort((a, b) => a[1].timestamp - b[1].timestamp) : [];
        if (isDebug) console.log('[script.js] 取得したメッセージの数:', messages.length);
        if (messages.length === 0) {
            if (isDebug) console.log('[script.js] 取得されたメッセージがありません。');
        }

        const userIds = [...new Set(messages.map(([_, msg]) => msg.userId))];
        if (isDebug) console.log('[script.js] 関連するユーザーID:', userIds);

        const userDataPromises = userIds.map(async userId => {
            if (userCache.has(userId)) {
                if (isDebug) console.log(`[script.js] ユーザーデータ (キャッシュから): ${userId}`);
                return { userId, data: userCache.get(userId) };
            }
            if (isDebug) console.log(`[script.js] ユーザーデータ (Firebaseから取得): ${userId}`);
            const snapshot = await get(ref(database, `users/${userId}`));
            const data = snapshot.val() || {};
            userCache.set(userId, data);
            return { userId, data };
        });
        const userDataArray = await Promise.all(userDataPromises);
        const userDataMap = Object.fromEntries(userDataArray.map(({ userId, data }) => [userId, data]));
        if (isDebug) console.log('[script.js] ユーザーデータマップ:', userDataMap);

        messagesEl.innerHTML = '';
        latestInitialTimestamp = messages.length ? Math.max(...messages.map(([_, msg]) => msg.timestamp)) : null;
        if (isDebug) console.log('[script.js] 最新の初期メッセージタイムスタンプ:', latestInitialTimestamp);

        for (const [key, { username, message, timestamp, userId = 'anonymous', ipAddress }] of messages) {
            if (isDebug) console.log(`[script.js] メッセージをレンダリング中: ID=${key}, ユーザー=${username}, タイムスタンプ=${timestamp}`);
            const isLatest = key === messages[messages.length - 1]?.[0];
            const photoURL = userDataMap[userId]?.photoURL;
            const li = document.createElement('li');
            li.className = `list-group-item p-0 m-0 border shadow-sm mb-3 d-flex justify-content-start align-items-start border-0 ${isLatest ? 'latest-message pulse' : ''} fade-in ${assignUserBackgroundColor(userId)}`;
            li.setAttribute('data-message-id', key);
            li.setAttribute('role', 'listitem');
            li.setAttribute('data-timestamp', timestamp);
            const date = timestamp ? new Date(timestamp).toLocaleString('ja-JP') : '不明';
            const formattedMessage = formatMessage(message);
            li.innerHTML = `
                <div class="message bg-transparent p-2 row">
                    <div class="col-auto profile-icon">
                        ${photoURL && photoURL !== '' ?
                            `<img src="${escapeHTMLAttribute(photoURL)}" alt="${escapeHTMLAttribute(username)}のプロフィール画像" class="profile-img" onerror="handleImageError(this, '${escapeHTMLAttribute(userId)}', '${escapeHTMLAttribute(username)}', '${escapeHTMLAttribute(photoURL)}')">` :
                            `<div class="avatar">${username.charAt(0).toUpperCase()}</div>`}
                    </div>
                    <div class="col-auto message-header p-0 m-0 d-flex align-items-center">
                        <strong>${escapeHTMLAttribute(username || '匿名')}</strong>
                        <small class="text-muted ms-2">${date}</small>
                        ${auth.currentUser && auth.currentUser.uid === userId ?
                            `<button class="btn btn-sm btn-outline-success ms-2 delete-message" data-message-id="${key}">
                                <i class="fa fa-trash"></i>
                            </button>` : ''}
                    </div>
                    <div class="col-12 message-body mt-2">
                        ${formattedMessage}
                    </div>
                </div>`;
            messagesEl.prepend(li);
            const img = li.querySelector('.profile-img');
            if (img) {
                img.onerror = () => handleImageError(img, userId, username, photoURL);
            }
            setTimeout(() => li.classList.add('show'), 10);
        }
        messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
        if (isDebug) console.log('[script.js] メッセージ表示後: トップにスクロールしました。');
    } catch (error) {
        console.error('[script.js] 初期メッセージ読み込みエラー:', error);
        showError('メッセージの読み込みに失敗しました。');
    } finally {
        if (progressOverlay) progressOverlay.classList.add('d-none');
        if (isDebug) console.log('[script.js] progressOverlayを非表示にしました。');
        if (isDebug) console.log('[script.js] loadInitialMessages関数が完了しました。');
    }
}

// 新しいメッセージの監視 (変更なし)
let messageListener = null;
let messageRemoveListener = null;

function setupMessageListener() {
    if (isDebug) console.log('[script.js] setupMessageListener関数が呼び出されました。');
    try {
        if (messageListener) {
            if (isDebug) console.log('[script.js] 既存のmessageListenerを解除します。');
            messageListener();
        }
        if (messageRemoveListener) {
            if (isDebug) console.log('[script.js] 既存のmessageRemoveListenerを解除します。');
            messageRemoveListener();
        }

        let listenerQuery = messagesRef;
        if (latestInitialTimestamp) {
            if (isDebug) console.log(`[script.js] setupMessageListener: 最新の初期タイムスタンプ (${latestInitialTimestamp}) 以降のメッセージを監視します。`);
            listenerQuery = query(messagesRef, orderByChild('timestamp'), startAfter(latestInitialTimestamp));
        } else {
            if (isDebug) console.log('[script.js] setupMessageListener: latestInitialTimestampが設定されていないため、全ての新しいメッセージを監視します。');
            listenerQuery = query(messagesRef, orderByChild('timestamp'));
        }

        messageListener = onChildAdded(listenerQuery, async (snapshot) => {
            if (isDebug) console.log('[script.js] onChildAddedイベントが発生しました。');
            try {
                const { username, message, timestamp, userId = 'anonymous', ipAddress, fcmMessageId } = snapshot.val();
                const key = snapshot.key;
                if (isDebug) console.log(`[script.js] 新しいメッセージ: ID=${key}, ユーザー=${username}, タイムスタンプ=${timestamp}`);

                if (timestamp <= latestInitialTimestamp) {
                    if (isDebug) console.log('[script.js] メッセージは初期読み込み済みのためスキップします。（リスナー側でフィルタリング済み）');
                    return;
                }
                if (messagesEl.querySelector(`[data-message-id="${key}"]`)) {
                    if (isDebug) console.log('[script.js] メッセージは既にDOMに存在するためスキップします。');
                    return;
                }

                if (isDebug) console.log(`[script.js] ユーザーデータ取得中 for userId: ${userId}`);
                const userData = userCache.has(userId) ? userCache.get(userId) : (await get(ref(database, `users/${userId}`))).val() || {};
                userCache.set(userId, userData);
                if (userCache.size > 100) {
                    if (isDebug) console.log('[script.js] userCacheが大きくなったためクリアしました。');
                    userCache.clear();
                }
                const photoURL = userData.photoURL;
                const formattedMessage = formatMessage(message);

                const displayUsername = cleanUsername(username || '匿名');

                const li = document.createElement('li');
                li.className = `list-group-item p-0 m-0 border shadow-sm mb-3 d-flex justify-content-start align-items-start border-0 fade-in latest-message pulse mb-3 ${assignUserBackgroundColor(userId)}`;
                li.setAttribute('data-message-id', key);
                li.setAttribute('data-user-id', userId);
                li.setAttribute('role', 'listitem');
                li.setAttribute('data-timestamp', timestamp);
                const date = timestamp ? new Date(timestamp).toLocaleString('ja-JP') : '不明';
                li.innerHTML = `
                    <div class="message bg-transparent p-2 row">
                        <div class="col-auto profile-icon">
                            ${photoURL && photoURL !== '' ?
                                `<img src="${escapeHTMLAttribute(photoURL)}" alt="${escapeHTMLAttribute(displayUsername)}のプロフィール画像" class="profile-img" onerror="handleImageError(this, '${escapeHTMLAttribute(userId)}', '${escapeHTMLAttribute(displayUsername)}', '${escapeHTMLAttribute(photoURL)}')">` :
                                `<div class="avatar">${displayUsername.charAt(0).toUpperCase()}</div>`}
                        </div>
                        <div class="col-auto message-header p-0 m-0 d-flex align-items-center">
                            <strong>${escapeHTMLAttribute(displayUsername)}</strong> <small class="text-muted ms-2">${date}</small>
                            ${auth.currentUser && auth.currentUser.uid === userId ?
                                `<button class="btn btn-sm btn-outline-success ms-2 delete-message" data-message-id="${key}">
                                    <i class="fa fa-trash" aria-hidden="true"></i>
                                </button>` : ''}
                        </div>
                        <div class="col-12 message-body mt-2">
                            ${formattedMessage}
                        </div>
                    </div>`;
                messagesEl.prepend(li);
                const img = li.querySelector('.profile-img');
                if (img) {
                    img.onerror = () => handleImageError(img, userId, displayUsername, photoURL);
                }
                setTimeout(() => li.classList.add('show'), 10);
                if (!isUserScrolledUp) {
                    requestAnimationFrame(() => {
                        messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                    newMessageBtn.classList.add('d-none');
                } else {
                    newMessageBtn.classList.remove('d-none');
                }
                if (isDebug) console.log('[タブ点滅デバッグ] document.hidden:', document.hidden);
                if (isDebug) console.log('[タブ点滅デバッグ] auth.currentUser.uid:', auth.currentUser ? auth.currentUser.uid : '未ログイン');
                if (isDebug) console.log('[タブ点滅デバッグ] message.userId:', userId);

                const currentUserId = auth.currentUser ? auth.currentUser.uid : null;
                if (document.hidden && userId !== currentUserId) {
                    if (isDebug) console.log('[タブ点滅デバッグ] 通知条件を満たしました: タブ非表示 AND 他ユーザーからのメッセージ');
                    startTabBlinking();
                    notifyNewMessage({ title: username, body: message });
                } else {
                    if (isDebug) console.log('[タブ点滅デバッグ] 通知条件を満たしませんでした。');
                    if (!document.hidden) {
                        if (isDebug) console.log('理由: タブが表示されているため。');
                        stopTabBlinking();
                    }
                    if (userId === currentUserId) {
                        if (isDebug) console.log('理由: 自身のメッセージであるため。');
                    }
                }
            } catch (error) {
                console.error('[script.js] 新メッセージ追加エラー:', error);
                showError('メッセージの取得に失敗しました。');
            }
        });
        messageRemoveListener = onChildRemoved(messagesRef, (snapshot) => {
            if (isDebug) console.log('[script.js] onChildRemovedイベントが発生しました。');
            try {
                const key = snapshot.key;
                const messageEl = messagesEl.querySelector(`[data-message-id="${key}"]`);
                if (messageEl) {
                    messageEl.classList.remove('show');
                    setTimeout(() => {
                        messageEl.remove();
                    }, 300);
                    showToast('メッセージが削除されました。');
                }
            } catch (error) {
                console.error('メッセージ削除処理エラー:', error);
                showError('メッセージの削除処理に失敗しました。');
            }
        });
    } catch (error) {
        console.error('メッセージリスナー設定エラー:', error);
    }
}

// 削除対象のメッセージIDを一時的に保持する変数
let currentMessageIdToDelete = null;

let deleteConfirmModalEl;
let confirmDeleteBtn;
let cancelDeleteBtn;


// ====== ここから新しい「削除処理」コードブロック ====== (変更なし)

// 認証状態変更リスナー (setupFirebase() 内に移動済み)

// モーダル非表示時のフォーカス管理
if (unameModalEl) {
    unameModalEl.addEventListener('hidden.bs.modal', () => {
        // unameModalEl.setAttribute('inert', ''); // この行は削除またはコメントアウト
        // モーダルが閉じられた後にフォーカスを移動する
        if (loginBtn) { // loginBtnが存在することを確認
            loginBtn.focus();
        } else {
            // loginBtnがない場合のフォールバック（例: bodyにフォーカス）
            document.body.focus();
        }
    });
}

if (loginModalEl) {
    loginModalEl.addEventListener('hidden.bs.modal', () => {
        // loginModalEl.setAttribute('inert', ''); // この行は削除またはコメントアウト
        if (loginBtn) { // loginBtnが存在することを確認
            loginBtn.focus();
        } else {
            document.body.focus();
        }
    });
}

// 新着メッセージボタン (変更なし)
if (newMessageBtn) {
    newMessageBtn.addEventListener('click', () => {
        try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            isUserScrolledUp = false;
            newMessageBtn.classList.add('d-none');
        } catch (error) {
            console.error('新着メッセージボタンエラー:', error);
        }
    });
}

// アクティビティトラッキング（ユーザーの離席状態を検知） (変更なし)
function resetActivityTimer() {
    lastActivity = Date.now();
}

['mousemove', 'keydown', 'click', 'scroll'].forEach(eventType => {
    document.addEventListener(eventType, resetActivityTimer);
});

// アイドル状態になったらタブ点滅を停止（メッセージ受信時以外） (変更なし)
setInterval(() => {
    if (!document.hidden && blinkingInterval) {
        stopTabBlinking();
    }
}, 5000);

// DOMContentLoaded イベントリスナーのセットアップ
document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    formEl = document.getElementById('messageForm');
    inputEl = document.getElementById('m');
    messagesEl = document.getElementById('messages');
    errorAlert = document.getElementById('error-alert');
    loginBtn = document.getElementById('login-btn');
    twitterLogin = document.getElementById('twitterLogin');
    googleLogin = document.getElementById('googleLogin');
    anonymousLogin = document.getElementById('anonymousLogin');
    userInfo = document.getElementById('user-info');
    unameModalEl = document.getElementById('unameModal');
    // Bootstrap Modalインスタンスの初期化はDOMContentLoaded内で行う
    unameModal = new bootstrap.Modal(unameModalEl);
    loginModalEl = document.getElementById('loginModal');
    loginModal = new bootstrap.Modal(loginModalEl);
    unameInput = document.getElementById('uname'); // HTMLのIDは'uname'
    confirmName = document.getElementById('confirmName'); // HTMLのIDは'confirmName'
    newMessageBtn = document.getElementById('newMessageBtn');
    onlineUsersEl = document.getElementById('online-users');
    compactModeBtn = document.getElementById('compactModeBtn');
    fontSizeS = document.getElementById('fontSizeS');
    fontSizeM = document.getElementById('fontSizeM');
    fontSizeL = document.getElementById('fontSizeL');
    signOutBtn = document.getElementById('signOut');
    toggleModeBtn = document.getElementById('toggleModeBtn');
    loadingIndicator = document.getElementById('loading-indicator');
    progressOverlay = document.getElementById('progress-overlay');
    navbarRow2 = document.getElementById('navsec');
    colorModeDropdown = document.getElementById('colorModeDropdown');
    userColorSelect = document.getElementById('userColorSelect');
    colorPicker = document.getElementById('colorPicker');

    // 削除確認モーダル関連の要素
    deleteConfirmModalEl = document.getElementById('deleteConfirmModal');
    deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalEl);
    confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    cancelDeleteBtn = document.getElementById('cancelDeleteBtn');


    // クッキーに依存する変数の初期化をここで行う
    isEnterSendMode = getCookie('enterSendMode') === 'true';
    colorAssignmentMode = getCookie('colorAssignmentMode') || 'user-selected';

    if (isDebug) console.log('[script.js] DOMContentLoadedでonlineUsersElを取得:', onlineUsersEl);
    // ★追加: unameInputとconfirmNameが正しく取得されているか確認
    if (isDebug) console.log('[script.js] DOMContentLoaded: unameInput要素:', unameInput);
    if (isDebug) console.log('[script.js] DOMContentLoaded: confirmName要素:', confirmName);


    // DOM要素が利用可能になった後にイベントリスナーを設定
    if (formEl) {
        formEl.addEventListener('submit', formEl._submitHandler);
    }

    // ログイン認証イベントリスナー
    if (twitterLogin) {
        twitterLogin.addEventListener('click', async () => {
            // onLoginSuccess コールバックは auth.onAuthStateChanged で処理されるため不要
            await signInWithTwitter(auth, database);
        });
    }

    if (googleLogin) {
        googleLogin.addEventListener('click', async () => {
            // onLoginSuccess コールバックは auth.onAuthStateChanged で処理されるため不要
            await signInWithGoogle(auth, database);
        });
    }

    if (anonymousLogin) {
        anonymousLogin.addEventListener('click', async () => {
            // onLoginSuccess コールバックは auth.onAuthStateChanged で処理されるため不要
            await signInAnonymouslyUser(auth, database);
            // 匿名ログイン成功後、ユーザー名設定モーダルを開くロジックは auth.onAuthStateChanged 内に移動
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            if (auth.currentUser) {
                await signOutUser(auth, database, auth.currentUser.uid);
            } else {
                loginModalEl.removeAttribute('inert'); // モーダル表示時に inert を解除
                loginModal.show();
                setTimeout(() => document.getElementById('twitterLogin')?.focus(), 100);
            }
        });
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            await signOutUser(auth, database, auth.currentUser.uid);
            unameModal.hide();
            // unameModalEl.setAttribute('inert', ''); // hidden.bs.modal イベントリスナーで処理
            // ログアウト後にログインボタンにフォーカスを戻す
            if (loginBtn) {
                loginBtn.focus();
            }
        });
    }

    if (userInfo) {
        userInfo.addEventListener('click', async () => {
            if (auth.currentUser) {
                // ★追加: ユーザー名変更モーダルが開かれる直前のログ
                if (isDebug) console.log('[script.js] ユーザー情報クリック: ユーザー名変更モーダルを開きます。');

                try {
                    const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
                    if (unameInput) { // unameInput が存在することを確認
                        unameInput.value = userData.username || '';
                    }
                    if (unameModalEl) { // unameModalEl が存在することを確認
                        unameModalEl.removeAttribute('inert'); // モーダル表示時に inert を解除
                    }
                    if (unameModal) { // unameModal が存在することを確認
                        unameModal.show();
                        setTimeout(() => unameInput.focus(), 100);
                    }
                } catch (error) {
                    console.error('[script.js] ユーザー名取得エラー:', error);
                    showError('ユーザー名の取得に失敗しました。');
                }
            } else {
                showError('ログインしてください。');
            }
        });
    }

    // ★★★ ユーザー名変更の「確定」ボタンのイベントリスナー ★★★
    if (confirmName) {
        if (isDebug) console.log('[script.js] DOMContentLoaded: confirmNameにイベントリスナーをアタッチします。');
        confirmName.addEventListener('click', async () => {
            // ★追加: 「確定」ボタンがクリックされたことを示すログ
            if (isDebug) console.log('[script.js] ユーザー名変更の「確定」ボタンがクリックされました。');

            const rawInput = unameInput.value;
            const username = rawInput.trim();
            if (isDebug) console.log('[script.js] ユーザー名入力値:', username, '型:', typeof username, '入力要素:', unameInput);
            if (typeof username !== 'string' || username === '') {
                if (isDebug) console.error('[script.js] 無効なユーザー名:', username);
                if (unameInput) unameInput.classList.add('is-invalid');
                return;
            }
            try {
                // updateUsername の呼び出し直前にもログを追加
                if (isDebug) console.log('[script.js] updateUsername関数を呼び出します。引数:', auth, database, username, auth.currentUser?.uid);

                // auth.js の updateUsername 関数を呼び出す
                const success = await updateUsername(auth, database, username, auth.currentUser.uid);

                if (success) {
                    if (isDebug) console.log('[script.js] ユーザー名更新成功。');
                    // database が確実に初期化されていることを確認
                    if (!database) {
                        console.error('[script.js] ユーザー名更新成功後のUI更新: database が未初期化です。');
                        return;
                    }
                    const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
                    const profileImgInUserInfo = userInfo.querySelector('.profile-img-small');
                    let profileAvatarDivInUserInfo = userInfo.querySelector('.avatar-small');
                    const usernameTextSpan = userInfo.querySelector('#current-username-display');

                    if (userData.photoURL && userData.photoURL !== '') {
                        if (profileImgInUserInfo) {
                            const photoURL = cleanPhotoURL(userData.photoURL) + '?t=' + Date.now();
                            if (isDebug) console.log('[script.js] 画像パス:', photoURL);
                            profileImgInUserInfo.src = photoURL;
                            profileImgInUserInfo.alt = escapeHTMLAttribute(username);
                            profileImgInUserInfo.dataset.uid = auth.currentUser.uid;
                            profileImgInUserInfo.classList.remove('d-none');
                        }
                        if (profileAvatarDivInUserInfo) {
                            profileAvatarDivInUserInfo.classList.add('d-none');
                        }
                    } else {
                        if (profileImgInUserInfo) {
                            profileImgInUserInfo.classList.add('d-none');
                        }
                        if (!profileAvatarDivInUserInfo) {
                            profileAvatarDivInUserInfo = document.createElement('div');
                            profileAvatarDivInUserInfo.className = 'avatar-small me-1';
                            if (usernameTextSpan) {
                                userInfo.insertBefore(profileAvatarDivInUserInfo, usernameTextSpan);
                            } else {
                                userInfo.appendChild(profileAvatarDivInUserInfo);
                            }
                        }
                        profileAvatarDivInUserInfo.textContent = username.charAt(0).toUpperCase();
                        profileAvatarDivInUserInfo.classList.remove('d-none');
                    }

                    if (usernameTextSpan) {
                        usernameTextSpan.textContent = username;
                    }

                    currentUserPhotoURL = userData.photoURL || null;
                    unameModal.hide(); // モーダルを閉じる
                    if (unameInput) unameInput.classList.remove('is-invalid'); // エラー表示をクリア
                    await updateOnlineUsers(); // オンラインユーザーリストも更新
                    showSuccess('ユーザー名を更新しました。');

                    // ★追加: モーダルが閉じられた後にフォーカスを移動
                    if (loginBtn) { // loginBtnが存在することを確認
                        loginBtn.focus();
                    } else {
                        document.body.focus();
                    }

                } else {
                    showError('ユーザー名の更新に失敗しました。');
                }
            } catch (error) {
                console.error('[script.js] ユーザー名更新エラー:', error);
                if (unameInput) unameInput.classList.add('is-invalid');
                showError(`ユーザー名の更新に失敗しました: ${error.message}`);
            }
        });
    } else {
        if (isDebug) console.warn('[script.js] DOMContentLoaded: confirmName 要素が見つかりませんでした。イベントリスナーをアタッチできません。');
    }


    // メッセージスクロール処理のイベントリスナー設定
    if (messagesEl) {
        // 既存のイベントリスナーがあれば削除 (重複登録防止)
        if (messagesEl._scrollHandler) {
            messagesEl.removeEventListener('scroll', messagesEl._scrollHandler);
        }
        messagesEl.addEventListener('scroll', messagesEl._scrollHandler);
    }

    // 削除確認モーダル関連のイベントリスナー設定 (変更なし)
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!currentMessageIdToDelete) {
                console.error('削除対象のメッセージIDが設定されていません。');
                showError('メッセージの削除に失敗しました。');
                deleteConfirmModal.hide();
                return;
            }
            try {
                const messageRef = ref(database, `messages/${currentMessageIdToDelete}`);
                const snapshot = await get(messageRef);
                if (!snapshot.exists()) {
                    showError('メッセージが見つかりません');
                    return;
                }
                if (snapshot.val().userId !== auth.currentUser.uid) {
                    showError('自分のメッセージのみ削除できます');
                    return;
                }
                await remove(messageRef);
                const messageEl = messagesEl.querySelector(`[data-message-id="${currentMessageIdToDelete}"]`);
                if (messageEl) {
                    messageEl.classList.remove('show');
                    setTimeout(() => messageEl.remove(), 300);
                }
                await push(actionsRef, {
                    type: 'deleteMessage',
                    userId: auth.currentUser.uid,
                    username: userInfo.textContent.replace(/<[^>]+>/g, '').trim(),
                    messageId: currentMessageIdToDelete,
                    timestamp: Date.now()
                });
                showSuccess('メッセージを削除しました。');
            } catch (error) {
                console.error('メッセージ削除エラー:', error);
                showError(`メッセージの削除に失敗しました: ${error.message}`);
            } finally {
                deleteConfirmModal.hide();
                inputEl.focus();
                currentMessageIdToDelete = null;
            }
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            deleteConfirmModal.hide();
            inputEl.focus();
            currentMessageIdToDelete = null;
        });
    }

    // メッセージリスト内の削除ボタンに対するイベント委譲
    if (messagesEl) {
        messagesEl.addEventListener('click', (e) => {
            const deleteButton = e.target.closest('.delete-message');
            if (deleteButton) {
                currentMessageIdToDelete = deleteButton.getAttribute('data-message-id');
                if (currentMessageIdToDelete) {
                    deleteConfirmModal.show();
                } else {
                    console.warn('削除ボタンに data-message-id が見つかりません。');
                }
            }
        });
    }

    initNotify(); // notifysound.js の初期化
    setupFirebase(); // Firebaseの初期化と認証状態の監視を開始
});

// Helper to get base path dynamically (Service Worker pathing)
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

function getServiceWorkerPathAndScope() {
    let swPath = '';
    let swScope = '';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
        const pathParts = window.location.pathname.split('/');
        const chatIndex = pathParts.indexOf('chat');
        if (chatIndex > -1) {
            swPath = pathParts.slice(0, chatIndex + 1).join('/') + '/firebase-messaging-sw.js';
            swScope = pathParts.slice(0, chatIndex + 1).join('/') + '/';
        } else {
            swPath = './firebase-messaging-sw.js';
            swScope = './';
        }
    } else {
        swPath = '/chat/firebase-messaging-sw.js';
        swScope = '/chat/';
    }
    return { swPath, swScope };
}


async function setupFirebase() {
    if (isDebug) console.log('[script.js] setupFirebase関数が呼び出されました。');
    try {
        // Step 1: Firebaseコアサービスを初期化（最も重要！）
        // firebase-config.js から直接インポートされるため、ここでは代入のみ
        // const { app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef } = await initializeFirebase();
        // ★修正：firebase-config.jsで直接エクスポートされているため、ここではインポートされた変数を使用
        await initializeFirebase(); // initializeFirebaseがグローバル変数を設定するので、ここでは返り値を受け取る必要なし
        if (isDebug) console.log('[script.js] Firebaseコアサービス初期化完了。');

        // Step 2: Service Workerの登録と取得
        let swRegistration = null;
        if ('serviceWorker' in navigator) {
            try {
                // 動的にService Workerのパスとスコープを取得
                const { swPath, swScope } = getServiceWorkerPathAndScope();
                swRegistration = await navigator.serviceWorker.register(swPath, { scope: swScope });
                globalSwRegistration = swRegistration; // グローバル変数に登録
                if (isDebug) console.log('[script.js] Service Worker登録成功:', swRegistration);

                // Step 3: FCM通知サービスを初期化
                if (app && database && swRegistration && !isFCMInitialized) {
                    try {
                        await initFCM(app, database, swRegistration);
                        isFCMInitialized = true;
                        if (isDebug) console.log('[script.js] FCM通知サービス初期化完了。');

                        if (!getCookie('notificationPermissionAsked')) {
                            const fcmToken = await requestNotificationPermission();
                            if (fcmToken) {
                                if (isDebug) console.log('[script.js] FCMトークン取得済み（ユーザーログイン時に保存予定）:', fcmToken);
                                setCookie('notificationPermissionAsked', 'true', 365);
                            } else {
                                console.warn('[script.js] FCMトークンが取得できませんでした（通知許可拒否またはSWエラー）。');
                            }
                        } else {
                            if (isDebug) console.log('[script.js] 過去に通知許可を求めています。');
                        }

                    } catch (fcmInitError) {
                        console.error('[script.js] FCM通知サービス初期化エラー:', fcmInitError);
                        isFCMInitialized = false;
                    }
                } else {
                    console.warn('[script.js] Firebaseアプリ、データベース、またはService Workerが利用できないため、FCM通知サービスは初期化されません。');
                }

            } catch (swError) {
                console.error('[script.js] Service Worker登録エラー:', swError);
            }
        } else {
            console.warn('[script.js] このブラウザはService Workerをサポートしていません。プッシュ通知は利用できません。');
        }

        // Step 4: Firebase Authの状態変更を監視 (FCM初期化後に実行)
        auth.onAuthStateChanged(async (user) => {
            try {
                if (isDebug) console.log('[script.js] 認証状態変更:', user ? user.uid : '未ログイン');

                if (user) {
                    await updateUserUI(user);
                    await loadInitialMessages();
                    setupMessageListener();
                    await updateOnlineUsers();

                    const userColorFromCookie = getCookie(`userColor_${user.uid}`);
                    if (userColorFromCookie) {
                        userColorMap.set(user.uid, userColorFromCookie);
                        document.documentElement.style.setProperty('--current-user-color', `var(--${userColorFromCookie})`);
                    }

                    if (isFCMInitialized) {
                        try {
                            const currentFCMToken = await requestNotificationPermission();
                            if (currentFCMToken) {
                                await saveFCMToken(user.uid, currentFCMToken);
                                if (isDebug) console.log('[script.js] ログイン時FCMトークンをデータベースに保存済み。');
                            } else {
                                console.warn('[script.js] ログイン済みだがFCMトークンが利用できない、または許可されていません。');
                            }
                        } catch (tokenSaveError) {
                            console.error('[script.js] ログイン時のFCMトークン保存エラー:', tokenSaveError);
                        }
                    } else {
                        console.warn('[script.js] FCMが初期化されていないため、ログイン時FCMトークンは保存されません。');
                    }

                    const idToken = await user.getIdToken();
                    localStorage.setItem('firebase_id_token', idToken);

                    if (loginModal) {
                        loginModal.hide();
                        if (isDebug) console.log('[script.js] ログインモーダルを閉じました。');
                    }
                    
                    const loginDropdown = document.getElementById('loginDropdown');
                    if (loginDropdown) {
                        const bsCollapse = bootstrap.Collapse.getInstance(loginDropdown);
                        if (bsCollapse) {
                            bsCollapse.hide();
                        }
                    }
                    const loginButton = document.getElementById('login-btn');
                    if (loginButton) {
                        loginButton.setAttribute('aria-expanded', 'false');
                    }

                    // 匿名ログインの場合、ユーザー名設定モーダルを開く
                    if (user.isAnonymous) {
                        setTimeout(() => {
                            if (unameModal) {
                                unameModal.show();
                                // モーダル表示時に inert を解除
                                if (unameModalEl) unameModalEl.removeAttribute('inert');
                                setTimeout(() => unameInput.focus(), 100);
                            } else {
                                console.warn('[script.js] unameModal が見つかりません。');
                            }
                        }, 500);
                    }

                } else {
                    updateUserUI(null);
                    localStorage.removeItem('firebase_id_token');
                    if (messageListener) messageListener();
                    if (messageRemoveListener) messageRemoveListener();
                    messagesEl.innerHTML = '';
                    if (onlineUsersEl) {
                        onlineUsersEl.innerHTML = '<span class="text-muted">ログインしてオンライン状況を確認</span>';
                    }
                }
            } catch (error) {
                console.error('[script.js] 認証状態変更エラー:', error);
            }
        });

    } catch (error) {
        console.error('[script.js] Firebase初期化エラー:', error);
        showError('Firebaseの初期化に失敗しました。ページをリロードしてください。');
    }
}

function showProgressOverlay() {
    if (progressOverlay) {
        progressOverlay.classList.remove('d-none');
    }
}


navigator.serviceWorker.addEventListener('message', (event) => {
    if (isDebug) console.log('[script.js] サービスワーカーからのメッセージ:', event.data);
    if (event.data.type === 'FCM_INIT_ERROR') {
        showError(`FCM初期化エラー: ${event.data.message}`);
    }
});
