// script.js
console.log("cleanUsername の型:", typeof cleanUsername);
import { initNotifications as initFCM, sendNotification, requestNotificationPermission, saveFCMToken } from './chat/fcmpush.js';
import { initializeFirebase } from './firebase-config.js'; // firebase-config.jsから初期化関数をインポート
import { initNotify, notifyNewMessage } from './notifysound.js';
import { getDatabase, ref, push, onChildAdded, set, get, child, query, orderByChild, limitToLast, endAt, onValue, onDisconnect, remove, update, onChildRemoved, startAfter } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
// ★修正点: cleanPhotoURL を utils.js からインポート
import { showError, showSuccess, showToast, getClientIp, setCookie, getCookie, isMobileDevice, escapeHTMLAttribute, cleanPhotoURL, cleanUsername } from './utils.js'; // cleanUsernameを追加
import { initFirebaseServices } from './firebase-service.js';
// auth.js からログイン関連関数をインポート
import { signInWithTwitter, signInWithGoogle, signInAnonymouslyUser, signOutUser, updateUsername } from './auth.js';
// ui-manager.js から handleImageError をインポート
import { handleImageError } from './ui-manager.js';

// handleImageError をグローバルスコープに公開
window.handleImageError = handleImageError;

// Firebase初期化とグローバル変数
let globalSwRegistration = null; 
let isFCMInitialized = false;
let app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef; // 初期化を遅延
let isInitialized = false; // 初期化フラグ
let formEl, messagesEl, inputEl, errorAlert, loginBtn, twitterLogin, googleLogin, anonymousLogin, userInfo, unameModalEl, unameModal, loginModalEl, loginModal, unameInput, confirmName, onlineUsersEl, compactModeBtn, fontSizeS, fontSizeM, fontSizeL, signOutBtn, newMessageBtn, toggleModeBtn, loadingIndicator, progressOverlay, navbarRow2;
let isSending = false;
let isUserScrolledUp = false;
let isEnterSendMode = getCookie('enterSendMode') === 'true';
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
// 背景色割り当てモード
let colorAssignmentMode = getCookie('colorAssignmentMode') || 'user-selected';

// ユーザー背景色割り当て関数
function assignUserBackgroundColor(userId) {
    try {
        if (userColorMap.has(userId)) {
            return userColorMap.get(userId);
        }

        let colorClass;
        console.log(`モード: ${colorAssignmentMode}, ユーザー: ${userId}`);
        if (colorAssignmentMode === 'random') {
            const randomIndex = Math.floor(Math.random() * backgroundColors.length);
            colorClass = backgroundColors[randomIndex];
            console.log(`ランダム割り当て: ${colorClass}`);
        } else if (colorAssignmentMode === 'sequential') {
            const index = userColorMap.size % backgroundColors.length;
            colorClass = backgroundColors[index];
            console.log(`順番割り当て: ${colorClass} (インデックス: ${index})`);
        } else if (colorAssignmentMode === 'user-selected') {
            if (auth.currentUser && userId === auth.currentUser.uid) {
                const selectedColor = getCookie(`userColor_${userId}`);
                colorClass = selectedColor && backgroundColors.includes(selectedColor)
                    ? selectedColor
                    : backgroundColors[0];
                console.log(`ユーザー選択（現在のユーザー）: ${colorClass} (クッキー: ${selectedColor})`);
            } else {
                const selectedColor = getCookie(`userColor_${userId}`);
                if (selectedColor && backgroundColors.includes(selectedColor)) {
                    colorClass = selectedColor;
                    console.log(`ユーザー選択（他のユーザー）: ${colorClass} (クッキー: ${selectedColor})`);
                } else {
                    const index = userColorMap.size % backgroundColors.length;
                    colorClass = backgroundColors[index];
                    console.log(`ユーザー選択（フォールバック・順番割り当て）: ${colorClass} (インデックス: ${index})`);
                }
            }
        } else {
            console.warn(`不明なモード: ${colorAssignmentMode}`);
            colorClass = backgroundColors[0];
        }

        userColorMap.set(userId, colorClass);
        console.log(`userColorMap 更新:`, userColorMap);
        return colorClass;
    } catch (error) {
        console.error('背景色割り当てエラー:', error);
        return backgroundColors[0];
    }
}

// 背景色モードのドロップダウンイベントリスナー
const colorModeDropdown = document.getElementById('colorModeDropdown');
if (colorModeDropdown) {
    const dropdownItems = colorModeDropdown.nextElementSibling.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const mode = e.target.getAttribute('data-mode');
            if (['sequential', 'random', 'user-selected'].includes(mode)) {
                colorAssignmentMode = mode;
                setCookie('colorAssignmentMode', mode, 365);
                console.log(`背景色モード変更: ${mode}`);
                userColorMap.clear();
                reloadMessages();
                const colorPicker = document.getElementById('colorPicker');
                if (colorPicker) {
                    colorPicker.classList.toggle('show', mode === 'user-selected' && auth.currentUser);
                }
            } else {
                console.warn(`無効なモード選択: ${mode}`);
            }
        });
    });
}

// DOM要素
formEl = document.getElementById('messageForm');
messagesEl = document.getElementById('messages');
inputEl = document.getElementById('m');
errorAlert = document.getElementById('error-alert');
loginBtn = document.getElementById('login-btn');
twitterLogin = document.getElementById('twitterLogin');
googleLogin = document.getElementById('googleLogin');
anonymousLogin = document.getElementById('anonymousLogin');
userInfo = document.getElementById('user-info');
unameModalEl = document.getElementById('unameModal');
unameModal = new bootstrap.Modal(unameModalEl);
loginModalEl = document.getElementById('loginModal');
loginModal = new bootstrap.Modal(loginModalEl);
unameInput = document.getElementById('uname');
confirmName = document.getElementById('confirmName');
onlineUsersEl = document.getElementById('online-users');
compactModeBtn = document.getElementById('compactModeBtn');
fontSizeS = document.getElementById('fontSizeS');
fontSizeM = document.getElementById('fontSizeM');
fontSizeL = document.getElementById('fontSizeL');
signOutBtn = document.getElementById('signOut');
newMessageBtn = document.getElementById('newMessageBtn');
toggleModeBtn = document.getElementById('toggleModeBtn');
loadingIndicator = document.getElementById('loading-indicator');
progressOverlay = document.getElementById('progress-overlay');
navbarRow2 = document.getElementById('navsec');
const userColorSelect = document.getElementById('userColorSelect'); // userColorSelect の定義を追加
const colorPicker = document.getElementById('colorPicker'); // colorPicker の定義を追加

// ステータスインジケーター更新
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

async function fetchOnlineUsers() {
    try {
        const snapshot = await get(onlineUsersRef);
        const users = snapshot.val()
            ? await Promise.all(
                  Object.entries(snapshot.val())
                      .filter(([uid, user]) => uid && user && typeof user === 'object')
                      .map(async ([uid, user]) => {
                          const userRef = ref(getDatabase(), `users/${uid}`);
                          const userData = (await get(userRef)).val() || {};
                          return {
                              userId: uid,
                              username: user.username && typeof user.username === 'string' ? user.username : '匿名',
                              photoURL: userData.photoURL && typeof userData.photoURL === 'string' ? `${userData.photoURL}?t=${Date.now()}` : null // icon.pngを削除し、nullを返す
                          };
                      })
              )
            : [];
        console.log('[script.js] オンラインユーザー取得成功:', users);
        return users;
    } catch (error) {
        console.error('[script.js] オンラインユーザー取得エラー:', error);
        return [];
    }
}

async function getUserData(userId) {
    try {
        if (!userId || typeof userId !== 'string') {
            console.warn('[script.js] 無効なuserId:', userId);
            return { userId, username: '匿名', photoURL: null };
        }
        if (userCache.has(userId)) {
            const cachedData = userCache.get(userId);
            if (cachedData && cachedData.userId === userId && typeof cachedData.username === 'string') {
                console.log('[script.js] キャッシュから取得したユーザーデータ:', cachedData);
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
        console.log('[script.js] Firebaseから取得したユーザーデータ:', userData);
        userCache.set(userId, userData);
        if (userCache.size > 100) userCache.clear();
        return userData;
    } catch (error) {
        console.error('ユーザーデータ取得エラー:', error);
        return { userId, username: '匿名', photoURL: null };
    }
}

// renderOnlineUsers (オンラインユーザーリストのレンダリング)
function renderOnlineUsers(users) {
    try {
        if (!users || users.length === 0) {
            return '<span class="text-muted">オンラインのユーザーはいません</span>';
        }
        return users
            .filter(user => user && user.userId && typeof user.userId === 'string')
            .map(({ userId, username, photoURL }) => {
                // ここで username に cleanUsername を適用
                const displayUsername = username && typeof username === 'string' ? cleanUsername(username) : '匿名'; // ★修正点: cleanUsername を適用
                const escapedUserId = escapeHTMLAttribute(userId);
                const escapedDisplayUsername = escapeHTMLAttribute(displayUsername); // escapeHTMLAttribute は cleanUsername の後に適用

                const cleanedPhotoURLForError = escapeHTMLAttribute(cleanPhotoURL(photoURL || ''));

                console.log(`[renderOnlineUsers] userId: ${userId}, username: ${displayUsername}, photoURL: ${photoURL}`);
                return `<span class="online-user" title="${escapedDisplayUsername}" data-user-id="${escapedUserId}">
                    ${photoURL && typeof photoURL === 'string' && photoURL !== '' ?
                        `<img src="${escapeHTMLAttribute(cleanPhotoURL(photoURL))}" alt="${escapedDisplayUsername}のプロフィール画像" class="profile-img" onerror="handleImageError(this, '${escapedUserId}', '${escapedDisplayUsername}', '${cleanedPhotoURLForError}')">` :
                        `<div class="avatar">${displayUsername.charAt(0).toUpperCase()}</div>`}
                </span>`;
            })
            .join('');
    } catch (error) {
        console.error('オンラインユーザー描画エラー:', error);
        return '<span class="text-muted">オンラインユーザーの表示に失敗しました</span>';
    }
}

// script.js（updateOnlineUsersの修正）
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
            onlineUsersEl.innerHTML = renderOnlineUsers(limitedUsers); // getUserDataをスキップ
        }
    } catch (error) {
        console.error('オンラインユーザー更新エラー:', error);
        if (onlineUsersEl) {
            onlineUsersEl.innerHTML = '<span class="text-muted">オンライン状況の取得に失敗</span>';
        }
    }
}


// ユーザーUI更新
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
            console.log('updateUserUIで取得されたuserData (DBから):', userData);

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
                console.log(`[updateUserUI] ユーザー ${user.uid} のphotoURLをAuthからDBに保存/更新しました: ${user.photoURL}`);
            }

            // photoURLが無効な場合のフォールバック
            const cleanedPhotoURL = cleanPhotoURL(photoUrlToUse);
            photoUrlToUse = cleanedPhotoURL || `${getBasePath()}images/icon.png`;
            console.log('[updateUserUI] 使用するphotoURL:', photoUrlToUse);

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

// ユーザーアクティビティ監視
['click', 'keydown', 'mousemove'].forEach(event => {
    document.addEventListener(event, () => {
        lastActivity = Date.now();
        updateStatusIndicator();
    });
});
setInterval(updateStatusIndicator, 60000);

// ツールチップ管理
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

// コンパクトモード切り替え
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

// フォントサイズ切り替え
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

// 送信/改行モード切り替え
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
            console.log('入力モード切替:', isEnterSendMode ? '送信モード' : '改行モード', 'クッキー値:', getCookie('enterSendMode'));
        } catch (error) {
            console.error('モード切り替えエラー:', error);
        }
    });
}

// 背景色モード切り替え (auth.currentUser のチェックを考慮)
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
            console.log('モード変更:', colorAssignmentMode, 'userColorMap リセット');
            reloadMessages();
            showSuccess(`背景色モードを${colorAssignmentMode === 'sequential' ? '順番' : colorAssignmentMode === 'random' ? 'ランダム' : '自分で選択'}に変更しました。`);
        });
    });
}

// ユーザー色選択
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
                console.log(`ユーザー ${auth.currentUser.uid} の色選択: ${selectedColor}`);
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



// inputEl のイベントリスナー（フォーカス、ブラー、キー入力）
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
                            formEl.style.bottom = `${height}px`; /* キーボードの高さに応じて調整 */
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
                console.log('仮想キーボードを非表示');
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
                    console.log('Enterキー: 送信モードでフォーム送信');
                } else {
                    // 改行モードではデフォルトの改行動作を許可
                    console.log('Enterキー: 改行モードで改行挿入');
                }
            } else if (e.key === 'Enter' && e.shiftKey) {
                // Shift+Enterは常に改行
                console.log('Shift+Enter: 改行挿入');
            }
        } catch (error) {
            console.error('キー入力処理エラー:', error);
        }
    });
}
// メッセージスクロール処理
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
                if (messagesEl.scrollTop > scrollTopMax - 200 && !isLoading) {
                    console.log('ローディング開始');
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


                                // ★ここから追加★
                                console.log(`[メッセージレンダリング前] key: ${key}, 元のusername: "${username}", userId: ${userId}`);
                                const tempDisplayUsername = cleanUsername(username || '匿名');
                                console.log(`[メッセージレンダリング後] key: ${key}, cleanUsername適用後: "${tempDisplayUsername}"`);
                                // ★ここまで追加




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

// メッセージフォーマット処理
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

// メッセージ再描画関数
async function reloadMessages() {
    try {
        console.log('メッセージ再描画開始, モード:', colorAssignmentMode);
        messagesEl.innerHTML = '';
        await loadInitialMessages();
        setupMessageListener();
        console.log('メッセージ再描画完了, userColorMap:', userColorMap);
    } catch (error) {
        console.error('メッセージ再描画エラー:', error);
        showError('メッセージの再読み込みに失敗しました。');
    }
    if (auth.currentUser) {
      const userId = auth.currentUser.uid;
      // if (userId !== auth.currentUser.uid) { // この条件は常に false になるため、不要
        notifyNewMessage();
      // }
    }
}

// Twitterログイン認証
if (twitterLogin) {
    twitterLogin.addEventListener('click', async () => {
        // auth.js に処理を委譲
        // 引数を auth.js の定義に合わせる (actionsRef と usersRef は auth.js 内部で取得すべき)
        await signInWithTwitter(auth, database, async (user) => { // ★ ここを修正
            // ログイン成功時の追加処理
            await updateUserUI(user);
        });
    });
}

// Googleログイン
if (googleLogin) {
    googleLogin.addEventListener('click', async () => {
        await signInWithGoogle(auth, database, async (user) => { // ★ ここを修正
            await updateUserUI(user);
        });
    });
}

// 匿名ログイン
if (anonymousLogin) {
    anonymousLogin.addEventListener('click', async () => {
        await signInAnonymouslyUser(auth, database, async (user) => { // ★ ここを修正
            await updateUserUI(user);
        });
    });
}

// ログアウト
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        if (auth.currentUser) {
            await signOutUser(auth, database, actionsRef, onlineUsersRef, userInfo.textContent.replace(/<[^>]+>/g, '').trim(), () => {
                // ログアウト成功時の追加処理 (auth.onAuthStateChanged でUIが更新されるため、ここでは特別不要)
            });
        } else {
            loginModalEl.removeAttribute('inert');
            loginModal.show();
            setTimeout(() => document.getElementById('twitterLogin')?.focus(), 100);
        }
    });
}

if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
        await signOutUser(auth, database, actionsRef, onlineUsersRef, userInfo.textContent.replace(/<[^>]+>/g, '').trim(), () => {
            unameModal.hide();
            unameModalEl.setAttribute('inert', '');
            document.getElementById('login-btn').focus();
        });
    });
}

// ユーザー名変更
if (userInfo) {
    userInfo.addEventListener('click', async () => {
        if (auth.currentUser) {
            try {
                const userData = await get(ref(database, `users/${auth.currentUser.uid}`));
                unameInput.value = userData.val()?.username || '';
                unameModalEl.removeAttribute('inert');
                unameModal.show();
                setTimeout(() => unameInput.focus(), 100);
            } catch (error) {
                console.error('[script.js] ユーザー名取得エラー:', error);
                showError('ユーザー名の取得に失敗しました。');
            }
        } else {
            showError('ログインしてください。');
        }
    });
}

if (confirmName) {
    confirmName.addEventListener('click', async () => {
        const rawInput = unameInput.value;
        const username = rawInput.trim();
        console.log('[script.js] ユーザー名入力値:', username, '型:', typeof username, '入力要素:', unameInput);
        if (typeof username !== 'string' || username === '') {
            console.error('[script.js] 無効なユーザー名:', username);
            unameInput.classList.add('is-invalid');
            return;
        }
        try {
            await updateUsername(auth, database, username, async (updatedUsername, updatedPhotoURL) => {
                console.log('[script.js] ユーザー名更新成功:', updatedUsername, 'photoURL:', updatedPhotoURL);
                // ユーザー名更新成功時のUI更新
                const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
                
                // user-info 内の画像と文字アバター要素を取得
                const profileImgInUserInfo = userInfo.querySelector('.profile-img-small');
                let profileAvatarDivInUserInfo = userInfo.querySelector('.avatar-small');
                // user-info 内のユーザー名表示用のテキスト要素を取得 (新しいIDを使用)
                const usernameTextSpan = userInfo.querySelector('#current-username-display');

                if (userData.photoURL && userData.photoURL !== '') {
                    // photoURLがある場合、画像を表示
                    if (profileImgInUserInfo) {
                        const photoURL = cleanPhotoURL(userData.photoURL) + '?t=' + Date.now();
                        console.log('[script.js] 画像パス:', photoURL);
                        profileImgInUserInfo.src = photoURL;
                        profileImgInUserInfo.alt = escapeHTMLAttribute(updatedUsername);
                        profileImgInUserInfo.dataset.uid = auth.currentUser.uid; // 修正: user.uid → auth.currentUser.uid
                        profileImgInUserInfo.classList.remove('d-none'); // 画像を表示
                        profileImgInUserInfo.classList.add('profile-img-small'); // 必要であればクラスを追加
                    }
                    if (profileAvatarDivInUserInfo) {
                        profileAvatarDivInUserInfo.classList.add('d-none'); // 文字アバターを非表示
                    }
                } else {
                    // photoURLがない場合、文字アバターを表示
                    if (profileImgInUserInfo) {
                        profileImgInUserInfo.classList.add('d-none');
                    }
                    if (!profileAvatarDivInUserInfo) { // avatar divがまだ存在しない場合のみ作成
                        profileAvatarDivInUserInfo = document.createElement('div');
                        profileAvatarDivInUserInfo.className = 'avatar-small me-1';
                        // usernameTextSpanの直前に挿入
                        if (usernameTextSpan) {
                            userInfo.insertBefore(profileAvatarDivInUserInfo, usernameTextSpan);
                        } else {
                            userInfo.appendChild(profileAvatarDivInUserInfo); // fallback
                        }
                    }
                    profileAvatarDivInUserInfo.textContent = updatedUsername.charAt(0).toUpperCase();
                    profileAvatarDivInUserInfo.classList.remove('d-none');
                }

                // ユーザー名テキストの更新
                if (usernameTextSpan) {
                    usernameTextSpan.textContent = updatedUsername;
                }

                currentUserPhotoURL = userData.photoURL || null; // ログインユーザーのphotoURLを更新
                unameModal.hide();
                unameInput.classList.remove('is-invalid');
                await updateOnlineUsers(); // オンラインユーザーリストも更新
                showSuccess('ユーザー名を更新しました。');
            });
        } catch (error) {
            console.error('[script.js] ユーザー名更新エラー:', error);
            unameInput.classList.add('is-invalid');
            showError(`ユーザー名の更新に失敗しました: ${error.message}`);
        }
    });
}
// タブ点滅機能関連の変数と関数
let originalTitle = document.title;
let blinkingInterval = null;
let isBlinking = false; // 点滅中かどうかを管理するフラグ

function startTabBlinking() {
    if (isBlinking) return; // 既に点滅中の場合は何もしない

    originalTitle = document.title; // 元のタイトルを保存
    let toggle = false;
    blinkingInterval = setInterval(() => {
        document.title = toggle ? "新しいメッセージ！" : originalTitle;
        toggle = !toggle;
    }, 1000); // 1秒ごとにタイトルを切り替える
    isBlinking = true;

    // ユーザーがタブをアクティブにしたときに点滅を止めるイベントリスナー
    document.addEventListener('visibilitychange', stopTabBlinking);
    window.addEventListener('focus', stopTabBlinking);
}

function stopTabBlinking() {
    if (blinkingInterval) {
        clearInterval(blinkingInterval);
        blinkingInterval = null;
    }
    if (isBlinking) { // 点滅が止まったら元のタイトルに戻す
        document.title = originalTitle;
        isBlinking = false;
    }
    // イベントリスナーを削除 (一度きりで良い場合)
    document.removeEventListener('visibilitychange', stopTabBlinking);
    window.removeEventListener('focus', stopTabBlinking);
}


// メッセージ送信（修正済み）
if (formEl) {
formEl._submitHandler = async (e) => {
    try {
        e.preventDefault();

        if (!formEl.checkValidity()) {
            e.stopPropagation();
            formEl.classList.add('was-validated');
            console.log('[script.js] フォームバリデーション失敗');
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
        console.log('[script.js] Enterキー: 送信モードでフォーム送信');

        const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
        // 修正: cleanUsername を適用
        const cleanedUsername = cleanUsername(userInfo.textContent.replace(/<[^>]+>/g, '').trim());
        const timestamp = Date.now();

        // Firebase にメッセージを送信
        await push(messagesRef, {
            username: cleanedUsername,
            message,
            timestamp,
            userId: auth.currentUser.uid,
            ipAddress: userData.ipAddress || 'unknown'
        });

        // アクションを記録（ユーザー名もクリーンアップ済みのものを使用）
        await push(actionsRef, {
            type: 'sendMessage',
            userId: auth.currentUser.uid,
            username: cleanedUsername,
            timestamp
        });

        // 通知送信処理（ユーザー名をクリーンアップ済みのものに変更）
        try {
            const notificationTitle = `新しいメッセージ from ${cleanedUsername}`;
            const notificationBody = message.length > 50 ? message.substring(0, 47) + '...' : message;
            const onlineUsers = await fetchOnlineUsers();
            console.log('[script.js] オンラインユーザー:', onlineUsers);

            const defaultIconPath = './chat/images/icon.png';
            for (const onlineUser of onlineUsers) {
                if (onlineUser.userId && onlineUser.userId !== auth.currentUser.uid) {
                    console.log(`[script.js] 通知送信対象: ${onlineUser.userId} (${onlineUser.username})`);
                    await sendNotification(
                        onlineUser.userId,
                        notificationTitle,
                        notificationBody,
                        {
                            url: 'https://soysourcetan.github.io/chat',
                            icon: defaultIconPath
                        },
                        auth.currentUser.uid,
                        cleanedUsername // クリーンアップ済みのユーザー名を使用
                    );
                }
            }
        } catch (notificationError) {
            console.error('[script.js] 通知送信エラー:', notificationError);
            showError('通知の送信に失敗しました。');
        }

    } catch (error) {
        console.error('[script.js] メッセージ送信エラー:', error);
        showError(`メッセージの送信に失敗しました: ${error.message}`);
    } finally {
        inputEl.value = '';
        inputEl.textContent = '';
        formEl.classList.remove('was-validated');
        isUserScrolledUp = false;
        newMessageBtn.classList.add('d-none');

        requestAnimationFrame(() => {
            messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
            console.log('[script.js] メッセージ送信後: トップにスクロール');
        });

        if ('virtualKeyboard' in navigator) {
            navigator.virtualKeyboard.hide();
            formEl.style.bottom = '10px';
            messagesEl.style.maxHeight = '';
            console.log('[script.js] 仮想キーボードを非表示');
            setTimeout(() => {
                inputEl.focus();
                inputEl.select();
            }, 300);
        } else {
            inputEl.focus();
            inputEl.select();
        }

        setTimeout(() => inputEl.focus(), 100);
        isSending = false;
    }
};

    formEl.addEventListener('submit', formEl._submitHandler);
}

// テキストエリアの自動リサイズ
if (inputEl) {
    inputEl.addEventListener('focus', (e) => {
        e.preventDefault();
        const currentScrollY = window.scrollY;
        setTimeout(() => {
            window.scrollTo({ top: currentScrollY, behavior: 'auto' });
        }, 100);
        stopTabBlinking(); // ここに追加: inputElにフォーカスしたらタブ点滅を停止
    });
}

// 初期メッセージ読み込み
async function loadInitialMessages() {
    console.log('[script.js] loadInitialMessages関数が呼び出されました。');
    try {
        if (!auth.currentUser) {
            console.log('[script.js] 未ログインのためメッセージ読み込みをスキップ');
            return;
        }
        console.log('[script.js] ユーザーはログイン済みです:', auth.currentUser.uid);

        if (!progressOverlay) {
            console.warn('[script.js] progress-overlay要素が見つかりません。');
            return;
        }
        progressOverlay.classList.remove('d-none');
        console.log('[script.js] progressOverlayを表示しました。');

        const startTime = performance.now();
        console.log('[script.js] メッセージ取得クエリを作成中...');
        const initialMessagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(10));

        console.log('[script.js] Firebaseからメッセージのスナップショットを取得中...');
        const snapshot = await get(initialMessagesQuery);
        console.log('[script.js] メッセージのスナップショットを取得しました。snapshot.exists():', snapshot.exists());

        const messages = snapshot.val() ? Object.entries(snapshot.val()).sort((a, b) => a[1].timestamp - b[1].timestamp) : [];
        console.log('[script.js] 取得したメッセージの数:', messages.length);
        if (messages.length === 0) {
            console.log('[script.js] 取得されたメッセージがありません。');
        }

        const userIds = [...new Set(messages.map(([_, msg]) => msg.userId))];
        console.log('[script.js] 関連するユーザーID:', userIds);

        const userDataPromises = userIds.map(async userId => {
            if (userCache.has(userId)) {
                console.log(`[script.js] ユーザーデータ (キャッシュから): ${userId}`);
                return { userId, data: userCache.get(userId) };
            }
            console.log(`[script.js] ユーザーデータ (Firebaseから取得): ${userId}`);
            const snapshot = await get(ref(database, `users/${userId}`));
            const data = snapshot.val() || {};
            userCache.set(userId, data);
            return { userId, data };
        });
        const userDataArray = await Promise.all(userDataPromises);
        const userDataMap = Object.fromEntries(userDataArray.map(({ userId, data }) => [userId, data]));
        console.log('[script.js] ユーザーデータマップ:', userDataMap);

        messagesEl.innerHTML = '';
        latestInitialTimestamp = messages.length ? Math.max(...messages.map(([_, msg]) => msg.timestamp)) : null;
        console.log('[script.js] 最新の初期メッセージタイムスタンプ:', latestInitialTimestamp);

        for (const [key, { username, message, timestamp, userId = 'anonymous', ipAddress }] of messages) {
            console.log(`[script.js] メッセージをレンダリング中: ID=${key}, ユーザー=${username}, タイムスタンプ=${timestamp}`);
            const isLatest = key === messages[messages.length - 1]?.[0]; // 最新メッセージを判定
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
                        ${photoURL && photoURL !== '' ? // photoURL が存在し、空文字列でない場合
                            `<img src="${escapeHTMLAttribute(photoURL)}" alt="${escapeHTMLAttribute(username)}のプロフィール画像" class="profile-img" onerror="handleImageError(this, '${escapeHTMLAttribute(userId)}', '${escapeHTMLAttribute(username)}', '${escapeHTMLAttribute(photoURL)}')">` :
                            // photoURL が空文字列の場合（匿名ユーザーや画像取得失敗時）
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
            // ★ここからイベントリスナーを追加
            const img = li.querySelector('.profile-img');
            if (img) {
                img.onerror = () => handleImageError(img, userId, username, photoURL);
            }
            // ★ここまで
            setTimeout(() => li.classList.add('show'), 10);
        }
        messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
        console.log('[script.js] メッセージ表示後: トップにスクロールしました。');
    } catch (error) {
        console.error('[script.js] 初期メッセージ読み込みエラー:', error);
        showError('メッセージの読み込みに失敗しました。');
    } finally {
        if (progressOverlay) progressOverlay.classList.add('d-none');
        console.log('[script.js] progressOverlayを非表示にしました。');
        console.log('[script.js] loadInitialMessages関数が完了しました。');
    }
}

// 新しいメッセージの監視
let messageListener = null;
let messageRemoveListener = null;

function setupMessageListener() {
    console.log('[script.js] setupMessageListener関数が呼び出されました。');
    try {
        if (messageListener) {
            console.log('[script.js] 既存のmessageListenerを解除します。');
            messageListener(); // 既存のリスナーを解除
        }
        if (messageRemoveListener) {
            console.log('[script.js] 既存のmessageRemoveListenerを解除します。');
            messageRemoveListener(); // 既存のリスナーを解除
        }

        // 最新の初期メッセージタイムスタンプが存在する場合、それ以降のメッセージのみを監視するクエリを作成
        let listenerQuery = messagesRef;
        if (latestInitialTimestamp) {
            console.log(`[script.js] setupMessageListener: 最新の初期タイムスタンプ (${latestInitialTimestamp}) 以降のメッセージを監視します。`);
            listenerQuery = query(messagesRef, orderByChild('timestamp'), startAfter(latestInitialTimestamp));
        } else {
            console.log('[script.js] setupMessageListener: latestInitialTimestampが設定されていないため、全ての新しいメッセージを監視します。');
            // 初期メッセージがない場合は、以降に投稿されるメッセージをすべて監視
            listenerQuery = query(messagesRef, orderByChild('timestamp'));
        }

        messageListener = onChildAdded(listenerQuery, async (snapshot) => { // ★ ここを修正
            console.log('[script.js] onChildAddedイベントが発生しました。');
            try {
                const { username, message, timestamp, userId = 'anonymous', ipAddress, fcmMessageId } = snapshot.val();
                const key = snapshot.key;
                console.log(`[script.js] 新しいメッセージ: ID=${key}, ユーザー=${username}, タイムスタンプ=${timestamp}`);

                // ここでのtimestamp <= latestInitialTimestampのチェックは不要になるはずですが、
                // 念のため残しておくとより堅牢になります。
                if (timestamp <= latestInitialTimestamp) {
                    console.log('[script.js] メッセージは初期読み込み済みのためスキップします。（リスナー側でフィルタリング済み）');
                    return;
                }
                if (messagesEl.querySelector(`[data-message-id="${key}"]`)) {
                    console.log('[script.js] メッセージは既にDOMに存在するためスキップします。');
                    return;
                }

                console.log(`[script.js] ユーザーデータ取得中 for userId: ${userId}`);
                const userData = userCache.has(userId) ? userCache.get(userId) : (await get(ref(database, `users/${userId}`))).val() || {};
                userCache.set(userId, userData);
                if (userCache.size > 100) {
                    console.log('[script.js] userCacheが大きくなったためクリアしました。');
                    userCache.clear();
                }
                const photoURL = userData.photoURL;
                const formattedMessage = formatMessage(message);

                // ★ 修正点: cleanUsernameを適用して、きれいなユーザー名を取得する
                const displayUsername = cleanUsername(username || '匿名');
                // ★ここまで修正

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
</div>        <div class="col-12 message-body mt-2">
            ${formattedMessage}
        </div>
    </div>`;
                messagesEl.prepend(li);
                // ★ここからイベントリスナーを追加
const img = li.querySelector('.profile-img');
if (img) {
    img.onerror = () => handleImageError(img, userId, displayUsername, photoURL); // ★ここも displayUsername が使われているか
}
                // ★ここまで
                setTimeout(() => li.classList.add('show'), 10);
                if (!isUserScrolledUp) {
                    requestAnimationFrame(() => {
                        messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                    newMessageBtn.classList.add('d-none');
                } else {
                    newMessageBtn.classList.remove('d-none');
                }
                // 現在のユーザー以外のメッセージで通知
                console.log('[タブ点滅デバッグ] document.hidden:', document.hidden);
                console.log('[タブ点滅デバッグ] auth.currentUser.uid:', auth.currentUser ? auth.currentUser.uid : '未ログイン');
                console.log('[タブ点滅デバッグ] message.userId:', userId);

                const currentUserId = auth.currentUser ? auth.currentUser.uid : null;
                if (document.hidden && userId !== currentUserId) {
                    console.log('[タブ点滅デバッグ] 通知条件を満たしました: タブ非表示 AND 他ユーザーからのメッセージ');
                    startTabBlinking();
                    notifyNewMessage({ title: username, body: message });
                } else {
                    console.log('[タブ点滅デバッグ] 通知条件を満たしませんでした。');
                    if (!document.hidden) {
                        console.log('理由: タブが表示されているため。');
                        stopTabBlinking();
                    }
                    if (userId === currentUserId) {
                        console.log('理由: 自身のメッセージであるため。');
                    }
                }
            } catch (error) {
                console.error('[script.js] 新メッセージ追加エラー:', error);
                showError('メッセージの取得に失敗しました。');
            }
        });
        messageRemoveListener = onChildRemoved(messagesRef, (snapshot) => {
            console.log('[script.js] onChildRemovedイベントが発生しました。');
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
// この変数は、スクリプトの他の部分からもアクセスできるよう、
// グローバルスコープ、または関連する関数群を囲む上位スコープに配置してください。
let currentMessageIdToDelete = null;

// HTMLからモーダル要素とボタン要素を取得します。
// これらの要素は、ページの読み込み時に一度だけ取得されるべきです。
// 例えば、DOMContentLoadedイベントリスナーの内部など、初期化処理の場所で定義してください。
const deleteConfirmModalEl = document.getElementById('deleteConfirmModal');
const deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalEl); // Bootstrapモーダルインスタンス

const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn'); // モーダル内のキャンセルボタンも取得することを推奨

// 削除実行ボタン (confirmDeleteBtn) のイベントリスナーを一度だけ登録
// これにより、クリックされるたびにイベントリスナーが重複して登録されるのを防ぎます。
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        // currentMessageIdToDelete が設定されていることを確認
        if (!currentMessageIdToDelete) {
            console.error('削除対象のメッセージIDが設定されていません。');
            showError('メッセージの削除に失敗しました。');
            deleteConfirmModal.hide(); // モーダルを閉じる
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

            await remove(messageRef); // Firebaseからメッセージを削除
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
            showSuccess('メッセージを削除しました。'); // 削除成功時のトースト通知
        } catch (error) {
            console.error('メッセージ削除エラー:', error);
            showError(`メッセージの削除に失敗しました: ${error.message}`);
        } finally {
            deleteConfirmModal.hide(); // 削除が成功しても失敗してもモーダルを閉じる
            inputEl.focus(); // 入力フィールドにフォーカスを戻す
            currentMessageIdToDelete = null; // 保持していたメッセージIDをリセット
        }
    });
}

// キャンセルボタン (cancelDeleteBtn) のイベントリスナーも追加することを推奨
if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
        deleteConfirmModal.hide(); // モーダルを閉じる
        inputEl.focus(); // 入力フィールドにフォーカスを戻す
        currentMessageIdToDelete = null; // 保持していたメッセージIDをリセット
    });
}


// ====== ここから新しい「削除処理」コードブロック ======

// messagesEl が存在する場合のみ処理
if (messagesEl) {
    // ★追加: メッセージリスト内の削除ボタンに対するイベント委譲
    messagesEl.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-message'); // クラス名を修正
        if (deleteButton) {
            currentMessageIdToDelete = deleteButton.getAttribute('data-message-id');
            if (currentMessageIdToDelete) {
                deleteConfirmModal.show();
            } else {
                console.warn('削除ボタンに data-message-id が見つかりません。');
            }
        }
    });

    // 既存のイベントリスナーがあれば削除 (重複登録防止)
    // messagesEl._scrollHandler が定義されていることを前提とする
    // この行は存在しない可能性もあるため、エラーにならないように注意
    if (messagesEl._scrollHandler) {
        messagesEl.removeEventListener('scroll', messagesEl._scrollHandler);
    }

    // スクロールハンドラーを定義
    messagesEl._scrollHandler = async () => {
        try {
            // setTimeout によるデバウンス処理はそのまま残しても良いですが、
            // messagesEl のスクロールイベント自体に直接 `async` を付けても動作します。
            // ここでは元のsetTimeout構造を尊重しつつ、window.scrollYのチェックを削除します。
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(async () => {
                // messagesEl.scrollTop が messagesEl の一番下近くに到達したかをチェック
                const scrollTopMax = messagesEl.scrollHeight - messagesEl.clientHeight;
                if (messagesEl.scrollTop >= scrollTopMax - 200 && !isLoading) { // >= に変更するとより確実にトリガーされます
                    console.log('ローディング開始');
                    isLoading = true;
                    loadingIndicator.textContent = '過去の10件のメッセージを読み込み中...';
                    loadingIndicator.style.display = 'block';

                    try {
                        const messages = messagesEl.querySelectorAll('[data-timestamp]');
                        // lastTimestamp は現在表示されているメッセージの中で最も古いものを取得
                        lastTimestamp = messages.length ? Math.min(...Array.from(messages).map(m => Number(m.getAttribute('data-timestamp')))) : null;

                        if (lastTimestamp) {
                            // Firebaseから過去のメッセージを10件取得
                            const olderMessages = await get(query(messagesRef, orderByChild('timestamp'), endAt(lastTimestamp - 1), limitToLast(10)));
                            // 取得したメッセージをタイムスタンプの新しい順（降順）にソート
                            const olderMessagesArray = olderMessages.val() ? Object.entries(olderMessages.val()).sort((a, b) => b[1].timestamp - a[1].timestamp) : [];

                            // ユーザーデータの取得とキャッシュはそのまま
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

                            // 新しいメッセージをリストの末尾に追加
                            for (const [key, { username, message, timestamp, userId = 'anonymous', ipAddress }] of olderMessagesArray) {
                                if (messagesEl.querySelector(`[data-message-id="${key}"]`)) continue; // 重複チェック
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
                                messagesEl.appendChild(li); // 新しいものから古いものが上から下に並ぶよう、末尾に追加
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
            }, 200); // デバウンス時間
        } catch (error) {
            console.error('スクロール処理エラー:', error);
        }
    };

    messagesEl.addEventListener('scroll', messagesEl._scrollHandler);
}


// 認証状態変更リスナー
// auth.onAuthStateChanged(async (user) => { ... }); のブロックは setupFirebase() 内に移動します。

// モーダル非表示時のフォーカス管理 (変更なし)
if (unameModalEl) {
    unameModalEl.addEventListener('hidden.bs.modal', () => {
        unameModalEl.setAttribute('inert', '');
        loginBtn.focus();
    });
}

if (loginModalEl) {
    loginModalEl.addEventListener('hidden.bs.modal', () => {
        loginModalEl.setAttribute('inert', '');
        loginBtn.focus();
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
// 不要な場合にタイトルが点滅し続けるのを防ぐため、明示的に停止
setInterval(() => {
    if (!document.hidden && blinkingInterval) {
        stopTabBlinking();
    }
}, 5000); // 5秒ごとにチェック

// DOMContentLoaded イベントリスナーのセットアップ
document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    formEl = document.getElementById('messageForm'); // IDを修正
    inputEl = document.getElementById('m'); // IDを修正
    messagesEl = document.getElementById('messages');
    errorAlert = document.getElementById('error-alert');
    loginBtn = document.getElementById('login-btn');
    twitterLogin = document.getElementById('twitterLogin');
    googleLogin = document.getElementById('googleLogin');
    anonymousLogin = document.getElementById('anonymousLogin');
    userInfo = document.getElementById('user-info');
    unameModalEl = document.getElementById('unameModal');
    unameModal = new bootstrap.Modal(unameModalEl);
    loginModalEl = document.getElementById('loginModal');
    loginModal = new bootstrap.Modal(loginModalEl);
    unameInput = document.getElementById('uname'); // IDを修正
    // 以下の要素はHTMLに存在しないか、またはui-manager.jsで取得されているため、ここでは削除
    // messageCountElement = document.getElementById('messageCount');
    // chatSoundToggle = document.getElementById('chatSoundToggle');
    // notificationSoundToggle = document.getElementById('notificationSoundToggle');
    // userListModal = new bootstrap.Modal(document.getElementById('userListModal'));
    // userListBtn = document.getElementById('userListBtn');
    // colorPickerButton = document.getElementById('colorPickerButton');
    // colorPickerModal = new bootstrap.Modal(document.getElementById('colorPickerModal'));
    // colorPalette = document.getElementById('colorPalette');
    // applyColorButton = document.getElementById('applyColorButton');
    // currentColorDisplay = document.getElementById('currentColorDisplay');
    // colorAssignmentModeToggle = document.getElementById('colorAssignmentModeToggle');
    // newMessagesIndicator = document.getElementById('newMessagesIndicator');
    newMessageBtn = document.getElementById('newMessageBtn'); // 再度取得

    initNotify(); // notifysound.js の初期化
    setupFirebase(); // Firebaseの初期化と認証状態の監視を開始
});

async function setupFirebase() {
    console.log('[script.js] setupFirebase関数が呼び出されました。');
    try {
        // Step 1: Firebaseコアサービスを初期化（最も重要！）
        const firebaseServices = await initializeFirebase();
        app = firebaseServices.app;
        database = firebaseServices.database;
        auth = firebaseServices.auth;
        messagesRef = firebaseServices.messagesRef;
        usersRef = firebaseServices.usersRef;
        actionsRef = firebaseServices.actionsRef;
        bannedUsersRef = firebaseServices.bannedUsersRef;
        onlineUsersRef = firebaseServices.onlineUsersRef;
        console.log('[script.js] Firebaseコアサービス初期化完了。');
        initNotify(); // 通知音の初期化

        // Step 2: Service Workerの登録と取得
        let swRegistration = null;
        if ('serviceWorker' in navigator) {
            try {
                // まずService Workerの登録を試みる (初回アクセス時や更新時に必要)
                swRegistration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', {
                    scope: './' // Service Workerのスコープ
                });
                console.log('[script.js] Service Worker登録成功:', swRegistration);

                // Step 3: FCM通知サービスを初期化
                // initNotifications (initFCM) には、初期化済みのFirebase AppインスタンスとDatabaseインスタンスを渡す
                // Service Workerが登録されていれば、必ず initFCM を呼び出す
                if (app && database && swRegistration && !isFCMInitialized) {
                    try {
                        await initFCM(app, database, swRegistration);
                        isFCMInitialized = true;
                        console.log('[script.js] FCM通知サービス初期化完了。');

                        // FCMトークンの取得と保存（初回訪問時または通知が許可されていない場合のみ）
                        // ここで通知許可を求めるのは、ユーザーがログインしているかどうかにかかわらず、
                        // ページロード時にFCM機能を使えるようにするため。
                        // ユーザーがログインした際にトークンをデータベースに保存するロジックは別に設ける。
                        if (!getCookie('notificationPermissionAsked')) { // 許可を一度も求めていない場合
                            const fcmToken = await requestNotificationPermission(); // fcmpush.js側でSWRegistrationを使用する
                            if (fcmToken) {
                                // トークンが取得できた場合、後でログイン時に保存するために保持する
                                // または、ログイン状態を監視して後で保存する
                                console.log('[script.js] FCMトークン取得済み（ユーザーログイン時に保存予定）:', fcmToken);
                                setCookie('notificationPermissionAsked', 'true', 365); // 許可を求めたことを記録
                            } else {
                                console.warn('[script.js] FCMトークンが取得できませんでした（通知許可拒否またはSWエラー）。');
                            }
                        } else {
                            console.log('[script.js] 過去に通知許可を求めています。');
                            // 既に許可済みの場合、getTokenを呼び出して既存のトークンを取得し、
                            // ユーザーがログイン状態になったら保存を試みる
                            // requestNotificationPermission() はgetTokenを含んでいるため、ここでは不要かもしれない
                            // もし必要なら fcmpush.js から getToken を別途エクスポートする
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
                if (user) {
                    await updateUserUI(user);
                    await loadInitialMessages();
                    setupMessageListener();

                    // ログイン時色設定
                    const userColorFromCookie = getCookie(`userColor_${user.uid}`);
                    if (userColorFromCookie) {
                        userColorMap.set(user.uid, userColorFromCookie);
                        document.documentElement.style.setProperty('--current-user-color', `var(--${userColorFromCookie})`);
                    }

                    // ユーザーがログインした際にFCMトークンをデータベースに保存
                    // FCMが初期化済みであれば、ここでトークンの保存を試みる
                    if (isFCMInitialized) {
                        try {
                            // requestNotificationPermission() を再度呼び出すとプロンプトが何度も表示される可能性があるので注意。
                            // initFCM成功時に一度だけ許可を求めている前提なら、ここではgetTokenで既存トークンを取得し保存する。
                            // 例: const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
                            // 現状の fcmpush.js の requestNotificationPermission は getToken を含んでいるため、
                            // ここでそれを呼び出すのは、プロンプト表示を許容するか、fcmpush.jsを修正してgetTokenをexportする必要がある。
                            // ここではシンプルに、initFCMでトークンが取得できていて、それがユーザーに紐付いていれば保存する、という想定。
                            // あるいは、requestNotificationPermission がトークンを返したら、それをどこかに保持しておき、
                            // ここで user.uid と共に saveFCMToken を呼び出す。
                            const currentFCMToken = await requestNotificationPermission(); // 許可済みならプロンプトは出ないはず
                            if (currentFCMToken) {
                                await saveFCMToken(user.uid, currentFCMToken);
                                console.log('[script.js] ログイン時FCMトークンをデータベースに保存済み。');
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
                } else {
                    updateUserUI(null);
                    localStorage.removeItem('firebase_id_token');
                    // メッセージリスナーとUIのクリーンアップは既存のロジックのまま
                    if (messageListener) messageListener();
                    if (messageRemoveListener) messageRemoveListener();
                    messagesEl.innerHTML = '';
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



// showProgressOverlay 関数の追加 (定義がなかったので追加)
function showProgressOverlay() {
    if (progressOverlay) {
        progressOverlay.classList.remove('d-none');
    }
}


navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('[script.js] サービスワーカーからのメッセージ:', event.data);
    if (event.data.type === 'FCM_INIT_ERROR') {
        showError(`FCM初期化エラー: ${event.data.message}`);
    }
});