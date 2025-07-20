// 既存のコード（変更なし）
import { initNotifications as initFCM, sendNotification, requestNotificationPermission, saveFCMToken } from './chat/fcmpush.js';
import { initNotify, notifyNewMessage } from './notifysound.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase, ref, push, onChildAdded, set, get, query, orderByChild, limitToLast, endAt, onValue, onDisconnect, remove, update, onChildRemoved, startAfter } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { getAuth, GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

// 画像読み込みエラー処理関数
function handleImageError(imgElement, userId, displayUsername, photoURL) {
    try {
        const initial = displayUsername && typeof displayUsername === 'string' && displayUsername.length > 0
            ? displayUsername.charAt(0).toUpperCase()
            : 'A';
        imgElement.outerHTML = `<div class="avatar">${initial}</div>`;
        console.log(`画像読み込みエラー: userId=${userId}, URL=${photoURL || 'なし'}`);
    } catch (error) {
        console.error('handleImageErrorエラー:', error);
    }
}

// GSAP をグローバルスコープで使用
const { gsap } = window;

// Firebase設定取得
async function loadFirebaseConfig() {
    try {
        const response = await fetch('https://trextacy.com/firebase-config.php', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`HTTPエラー: ステータス ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('[script.js] Firebase設定取得エラー:', error);
        throw error;
    }
}

// IPアドレス取得関数
async function getClientIp() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || 'unknown';
    } catch (error) {
        console.error('IP取得エラー:', error);
        return 'unknown';
    }
}

// クッキー設定
function setCookie(name, value, days) {
    try {
        const expires = days ? `; expires=${new Date(Date.now() + days * 86400000).toUTCString()}` : '';
        document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Strict`;
        console.log(`クッキー設定: ${name}=${value}, expires=${expires}`);
    } catch (error) {
        console.error('クッキー設定エラー:', error);
    }
}

// クッキー取得
function getCookie(name) {
    try {
        const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
        const value = match ? decodeURIComponent(match[2]) : null;
        console.log(`クッキー取得: ${name}=${value}`);
        return value;
    } catch (error) {
        console.error('クッキー取得エラー:', error);
        return null;
    }
}

function isMobileDevice() {
    try {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    } catch (error) {
        console.error('デバイス判定エラー:', error);
        return false;
    }
}

// Firebase初期化とグローバル変数
let app, database, auth, messagesRef, usersRef, actionsRef, bannedUsersRef, onlineUsersRef;
let isInitialized = false; // 初期化フラグ
let formEl, messagesEl, inputEl, errorAlert, loginBtn, twitterLogin, googleLogin, anonymousLogin, userInfo, unameModalEl, unameModal, loginModalEl, loginModal, unameInput, confirmName, onlineUsersEl, compactModeBtn, fontSizeS, fontSizeM, fontSizeL, signOutBtn, newMessageBtn, toggleModeBtn, loadingIndicator, progressOverlay, navbarRow2;
let isSending = false;
let isLoggingIn = false;
let isUserScrolledUp = false;
let isEnterSendMode = getCookie('enterSendMode') === 'true';
let messagesElScrollHandler = null;
let scrollTimeout = null; // スクロールイベントのデバウンス用
let isLoading = false;
let lastTimestamp = null;
let latestInitialTimestamp = null;
let isCompactMode = false;
let lastActivity = Date.now();
const userCache = new Map();
let debounceTimeout = null;

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

try {
    const firebaseConfig = await loadFirebaseConfig();
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth = getAuth(app);

    // 通知音の初期化
    await initNotify();
    console.log('[script.js] initNotify 実行成功');
} catch (error) {
    console.error('[script.js] 初期化エラー:', error);
    showError('アプリケーションの初期化に失敗しました。ページをリロードしてください。');
}
    // データベース参照
    messagesRef = ref(database, 'messages');
    usersRef = ref(database, 'users');
    actionsRef = ref(database, 'actions');
    bannedUsersRef = ref(database, 'bannedUsers');
    onlineUsersRef = ref(database, 'onlineUsers');

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

// エラーメッセージ表示
function showError(message) {
    try {
        const errorAlert = document.getElementById('error-alert');
        if (errorAlert) {
            errorAlert.textContent = message;
            errorAlert.classList.remove('d-none');
            errorAlert.setAttribute('role', 'alert');
            errorAlert.focus();
            setTimeout(() => {
                errorAlert.classList.add('d-none');
                errorAlert.removeAttribute('role');
            }, 6000);
        }
    } catch (error) {
        console.error('[script.js] エラーメッセージ表示エラー:', error);
    }
}

// 成功メッセージ表示
function showSuccess(message) {
    try {
        const successAlert = document.createElement('div');
        successAlert.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x m-3';
        successAlert.style.zIndex = '2000';
        successAlert.setAttribute('role', 'alert');
        successAlert.textContent = message;
        document.body.appendChild(successAlert);
        setTimeout(() => successAlert.remove(), 3000);
    } catch (error) {
        console.error('成功メッセージ表示エラー:', error);
    }
}

// トースト通知
function showToast(message) {
    try {
        const toast = document.createElement('div');
        toast.className = 'alert alert-info position-fixed bottom-0 end-0 m-3';
        toast.style.zIndex = '2000';
        toast.setAttribute('role', 'alert');
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    } catch (error) {
        console.error('トースト通知エラー:', error);
    }
}

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
            ? Object.entries(snapshot.val())
                .filter(([uid, user]) => uid && user && typeof user === 'object')
                .map(([uid, user]) => ({
                    userId: uid,
                    username: user.username && typeof user.username === 'string' ? user.username : '匿名',
                    photoURL: user.photoURL && typeof user.photoURL === 'string' ? user.photoURL : null
                }))
            : [];
        return users;
    } catch (error) {
        console.error('オンラインユーザー取得エラー:', error);
        return [];
    }
}

async function getUserData(userId) {
    try {
        if (!userId || typeof userId !== 'string') {
            return { userId, username: '匿名', photoURL: null };
        }
        if (userCache.has(userId)) {
            const cachedData = userCache.get(userId);
            if (cachedData && cachedData.userId === userId) {
                return cachedData;
            }
            userCache.delete(userId);
        }
        const snapshot = await get(ref(database, `users/${userId}`));
        const data = snapshot.val() || { username: '匿名', photoURL: null };
        const userData = { userId, username: '匿名', photoURL: null, ...data };
        userCache.set(userId, userData);
        if (userCache.size > 100) userCache.clear();
        return userData;
    } catch (error) {
        console.error('ユーザーデータ取得エラー:', error);
        return { userId, username: '匿名', photoURL: null };
    }
}

function escapeHTMLAttribute(str) {
    try {
        if (!str || typeof str !== 'string') return '';
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/</g, '<').replace(/>/g, '>');
    } catch (error) {
        console.error('HTML属性エスケープエラー:', error);
        return '';
    }
}

function renderOnlineUsers(users) {
    try {
        if (!users || users.length === 0) {
            return '<span class="text-muted">オンラインのユーザーはいません</span>';
        }
        return users
            .filter(user => user && user.userId && typeof user.userId === 'string')
            .map(({ userId, username, photoURL }) => {
                const displayUsername = username && typeof username === 'string' ? username : '匿名';
                const escapedUserId = escapeHTMLAttribute(userId);
                const escapedDisplayUsername = escapeHTMLAttribute(displayUsername);
                const escapedPhotoURL = escapeHTMLAttribute(photoURL || '');
                return `<span class="online-user" title="${escapedDisplayUsername}" data-user-id="${escapedUserId}">
                    ${photoURL && typeof photoURL === 'string'
                        ? `<img src="${escapedPhotoURL}" alt="${escapedDisplayUsername}のプロフィール画像" class="profile-img" onerror="handleImageError(this, '${escapedUserId}', '${escapedDisplayUsername}', '${escapedPhotoURL}')">`
                        : `<div class="avatar">${displayUsername.charAt(0).toUpperCase()}</div>`}
                </span>`;
            })
            .join('');
    } catch (error) {
        console.error('オンラインユーザー描画エラー:', error);
        return '<span class="text-muted">オンラインユーザーの表示に失敗しました</span>';
    }
}

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
        const userDataArray = (await Promise.all(limitedUsers.map(user => getUserData(user.userId))))
            .filter(user => user && user.userId && typeof user.userId === 'string');
        if (onlineUsersEl) {
            onlineUsersEl.innerHTML = renderOnlineUsers(userDataArray);
        }
    } catch (error) {
        console.error('オンラインユーザー更新エラー:', error);
        if (onlineUsersEl) {
            onlineUsersEl.innerHTML = '<span class="text-muted">オンライン状況の取得に失敗</span>';
        }
    }
}

onValue(onlineUsersRef, (snapshot) => {
    try {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(updateOnlineUsers, 1000);
    } catch (error) {
        console.error('オンラインユーザー監視エラー:', error);
    }
});

// ユーザーUI更新
async function updateUserUI(user) {
    try {
        let userData;
        if (user) {
            userCache.delete(user.uid);
            userData = (await get(ref(database, `users/${user.uid}`))).val() || {};
            console.log('updateUserUIで取得されたuserData:', userData); 
            let username = userData.username || user.displayName || 'ゲスト';
            username = username.length > 7 ? username.substring(0, 7) + "..." : username;
            if (userInfo) {
                userInfo.innerHTML = `<span class="status-dot status-active"></span>${escapeHTMLAttribute(username)}<i class="fas fa-pencil-alt ms-1"></i>`;
            }
            if (loginBtn) {
                loginBtn.innerHTML = '<i class="fa fa-sign-out"></i>';
            }
            loginModal.hide();
            loginModalEl.setAttribute('inert', '');
            if ((user.isAnonymous || !userData.username) && !isLoggingIn) {
                unameInput.value = userData.username || '';
                unameModalEl.removeAttribute('inert');
                unameModal.show();
                setTimeout(() => unameInput.focus(), 100);
            }
            lastActivity = Date.now();
            try {
                await set(ref(database, `onlineUsers/${user.uid}`), {
                    userId: user.uid,
                    username,
                    timestamp: Date.now()
                });
                onDisconnect(ref(database, `onlineUsers/${user.uid}`)).remove();
            } catch (error) {
                console.error('オンラインステータス更新エラー:', error);
            }
            updateStatusIndicator();
            await updateOnlineUsers();
            await loadInitialMessages();
        } else {
            if (userInfo) {
                userInfo.innerHTML = `<span class="status-dot status-away"></span>ゲスト <i class="fas fa-pencil-alt ms-1"></i>`;
            }
            if (loginBtn) {
                loginBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i>`;
            }
            unameModalEl.setAttribute('inert', '');
            loginModalEl.removeAttribute('inert');
            loginModal.show();
            setTimeout(() => document.getElementById('twitterLogin')?.focus(), 100);
            if (progressOverlay) progressOverlay.classList.add('d-none');
            await updateOnlineUsers();
        }
    } catch (error) {
        console.error('ユーザーUI更新エラー:', error);
        showError('ユーザー情報の更新に失敗しました。');
    }
}

// オンラインユーザー監視
onValue(onlineUsersRef, () => updateOnlineUsers());

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

// 背景色モード切り替え
if (colorModeDropdown) {
    colorModeDropdown.nextElementSibling.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            colorAssignmentMode = e.target.getAttribute('data-mode');
            setCookie('colorAssignmentMode', colorAssignmentMode, 365);
            colorPicker.classList.toggle('show', colorAssignmentMode === 'user-selected' && auth.currentUser);
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
      if (userId !== auth.currentUser.uid) {
        notifyNewMessage();
      }
    }
}

// Twitterログイン認証
if (twitterLogin) {
    twitterLogin.addEventListener('click', async () => {
        if (isLoggingIn) return;
        isLoggingIn = true;
        try {
            const provider = new TwitterAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
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
                photoURL: user.photoURL || null,
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
                    console.warn(`書き込み失敗（残りリトライ: ${retries}）:`, error);
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
        } catch (error) {
            console.error('Twitterログインエラー:', error);
            showError('Twitterログインに失敗しました: ' + error.message);
        } finally {
            isLoggingIn = false;
        }
    });
}

// Googleログイン
if (googleLogin) {
    googleLogin.addEventListener('click', async () => {
        if (isLoggingIn) return;
        isLoggingIn = true;
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
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
                photoURL: user.photoURL || null,
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
                    console.warn(`書き込み失敗（残りリトライ: ${retries}）:`, error);
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
        } catch (error) {
            console.error('Googleログインエラー:', error);
            showError('Googleログインに失敗しました: ' + error.message);
        } finally {
            isLoggingIn = false;
        }
    });
}

// 匿名ログイン
if (anonymousLogin) {
    anonymousLogin.addEventListener('click', async () => {
        if (isLoggingIn) return;
        isLoggingIn = true;
        try {
            const result = await signInAnonymously(auth);
            const user = result.user;
            const uniqueUsername = `anon${Date.now()}`;
            const ipAddress = await getClientIp();
            const userData = {
                username: uniqueUsername,
                provider: 'anonymous',
                ipAddress,
                photoURL: null,
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
                    console.warn(`書き込み失敗（残りリトライ: ${retries}）:`, error);
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
        } catch (error) {
            console.error('匿名ログインエラー:', error);
            showError('匿名ログインに失敗しました: ' + error.message);
        } finally {
            isLoggingIn = false;
        }
    });
}

// ログアウト
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        if (auth.currentUser) {
            try {
                await push(actionsRef, {
                    type: 'logout',
                    userId: auth.currentUser.uid,
                    username: userInfo.textContent.replace(/<[^>]+>/g, '').trim(),
                    timestamp: Date.now()
                });
                await remove(ref(database, `onlineUsers/${auth.currentUser.uid}`));
                await signOut(auth);
                showSuccess('ログアウトしました。');
            } catch (error) {
                console.error('ログアウトエラー:', error);
                showError('ログアウトに失敗しました: ' + error.message);
            }
        } else {
            loginModalEl.removeAttribute('inert');
            loginModal.show();
            setTimeout(() => document.getElementById('twitterLogin')?.focus(), 100);
        }
    });
}

if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
        try {
            await push(actionsRef, {
                type: 'logout',
                userId: auth.currentUser.uid,
                username: userInfo.textContent.replace(/<[^>]+>/g, '').trim(),
                timestamp: Date.now()
            });
            await remove(ref(database, `onlineUsers/${auth.currentUser.uid}`));
            await signOut(auth);
            unameModal.hide();
            unameModalEl.setAttribute('inert', '');
            document.getElementById('login-btn').focus();
            showSuccess('ログアウトしました。');
        } catch (error) {
            console.error('ログアウトエラー:', error);
            showError('ログアウトに失敗しました: ' + error.message);
        }
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
                console.error('ユーザー名取得エラー:', error);
                showError('ユーザー名の取得に失敗しました。');
            }
        } else {
            showError('ログインしてください。');
        }
    });
}

if (confirmName) {
    confirmName.addEventListener('click', async () => {
        try {
            const rawInput = unameInput.value;
            const username = rawInput.trim();
            if (!username || username.length === 0) {
                unameInput.classList.add('is-invalid');
                showError('ユーザー名を入力してください。');
                return;
            }
            if (username.length > 20) {
                unameInput.classList.add('is-invalid');
                showError('ユーザー名は20文字以内にしてください。');
                return;
            }
            if (/[.#$/\[\]]/.test(username)) {
                unameInput.classList.add('is-invalid');
                showError('ユーザー名に使用できない文字（. # $ / [ ]）が含まれています。');
                return;
            }
            if (!auth.currentUser) {
                showError('ログインしてください。');
                return;
            }
            const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
            const updates = {};
            updates[`users/${auth.currentUser.uid}`] = {
                username,
                provider: userData.provider || 'anonymous',
                ipAddress: userData.ipAddress || 'unknown'
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
                    console.warn(`ユーザー名設定失敗（残りリトライ: ${retries}）:`, error);
                    if (retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            if (!success) {
                throw lastError || new Error('ユーザー名の保存に失敗しました');
            }
            userInfo.innerHTML = `<span class="status-dot status-active"></span>${escapeHTMLAttribute(username)} <i class="fas fa-pencil-alt ms-1"></i>`;
            unameModal.hide();
            unameInput.classList.remove('is-invalid');
            showSuccess('ユーザー名を更新しました。');
            await updateOnlineUsers();
        } catch (error) {
            console.error('ユーザー名設定エラー:', error);
            showError(`ユーザー名の保存に失敗しました: ${error.message}`);
            unameInput.classList.add('is-invalid');
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


// メッセージ送信（修正部分）
if (formEl) {
    // 既存のイベントリスナーを削除し、新しいハンドラを設定
    // formEl.removeEventListener('submit', formEl._submitHandler); // この行は既に存在するか、不要な場合があるため注意
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
            const username = userInfo.textContent.replace(/<[^>]+>/g, '').trim();
            const timestamp = Date.now();

            // Firebase にメッセージを送信
            await push(messagesRef, {
                username,
                message,
                timestamp,
                userId: auth.currentUser.uid,
                ipAddress: userData.ipAddress || 'unknown'
            });

            // アクションを記録
            await push(actionsRef, {
                type: 'sendMessage',
                userId: auth.currentUser.uid,
                username,
                timestamp
            });

            // 通知送信ロジックを修正
            try {
                const notificationTitle = `新しいメッセージ from ${username}`;
                const notificationBody = message.length > 50 ? message.substring(0, 47) + '...' : message;

                // オンラインユーザーを取得
                const onlineUsers = await fetchOnlineUsers();
                console.log('[script.js] オンラインユーザー:', onlineUsers);

                // 自分以外のオンラインユーザー全員に通知を送信
                for (const onlineUser of onlineUsers) {
                    // ログイン中のユーザーIDとオンラインユーザーのIDが異なる場合のみ通知を送信
                    if (onlineUser.userId && onlineUser.userId !== auth.currentUser.uid) {
                        console.log(`[script.js] 通知送信対象: ${onlineUser.userId} (${onlineUser.username})`);
                        await sendNotification(
                            onlineUser.userId, // ★ここを修正: 受信者のuserIdを渡す
                            notificationTitle,
                            notificationBody,
                            { url: 'https://soysourcetan.github.io/chat', icon: onlineUser.photoURL || '/learning/english-words/chat/images/icon.png' }, // 受信者のアイコン、またはデフォルト
                            auth.currentUser.uid, // 送信者のuserId
                            username // 送信者のusername
                        );
                    } else {
                        console.log(`[script.js] 通知スキップ: ユーザー ${onlineUser.userId} は送信者自身か、無効なIDです。`);
                    }
                }
                console.log('[script.js] 全ての通知送信処理が完了しました。');
            } catch (notificationError) {
                console.error('[script.js] 通知送信エラー:', notificationError);
                showError('通知の送信に失敗しました。');
            }

            // フォームクリアとスクロール
            inputEl.value = '';
            formEl.classList.remove('was-validated');
            isUserScrolledUp = false;
            newMessageBtn.classList.add('d-none');
            if ('virtualKeyboard' in navigator) {
                navigator.virtualKeyboard.hide();
                formEl.style.bottom = '10px';
                messagesEl.style.maxHeight = '';
                console.log('[script.js] 仮想キーボードを非表示');
            }
            requestAnimationFrame(() => {
                messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
                console.log('[script.js] メッセージ送信後: トップにスクロール');
            });
            setTimeout(() => inputEl.focus(), 100);
        } catch (error) {
            console.error('[script.js] メッセージ送信エラー:', error);
            showError(`メッセージの送信に失敗しました: ${error.message}`);
        } finally {
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
            messagesEl.prepend(li);
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
                            ${photoURL ? 
                                `<img src="${escapeHTMLAttribute(photoURL)}" alt="${escapeHTMLAttribute(username)}のプロフィール画像" class="profile-img" onerror="handleImageError(this, '${escapeHTMLAttribute(userId)}', '${escapeHTMLAttribute(username)}', '${escapeHTMLAttribute(photoURL)}')">` :
                                `<div class="avatar">${username.charAt(0).toUpperCase()}</div>`}
                        </div>
                        <div class="col-auto message-header p-0 m-0 d-flex align-items-center">
                            <strong>${escapeHTMLAttribute(username || '匿名')}</strong>
                            <small class="text-muted ms-2">${date}</small>
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

// ====== ここから修正・追加するコードブロック ======

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

// メッセージスクロール処理
if (messagesEl) {
    // 既存のイベントリスナーがあれば削除（重複登録防止）
    if (messagesElScrollHandler) {
        messagesEl.removeEventListener('scroll', messagesElScrollHandler);
    }

    // messagesEl (チャットメッセージコンテナ) のスクロールイベントを監視
    messagesElScrollHandler = async () => {
        try {
            // スクロール検知後に一定時間待ってから処理を実行するデバウンス
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(async () => {
                // messagesElのスクロール位置をチェック
                // messagesEl.scrollTop: 現在のスクロール位置 (上端からの距離)
                // messagesEl.scrollHeight: コンテンツ全体の高さ
                // messagesEl.clientHeight: 表示されている領域の高さ

                // ユーザーが一番上（古いメッセージ側）から10px以上離れているか
                // 「新しいメッセージが上、古いメッセージが下」なので、ユーザーが下（最新メッセージ）から離れて上にスクロールしたときに表示するボタン
                isUserScrolledUp = messagesEl.scrollTop > 10;
                // newMessageBtnは「最新のメッセージへ」のようなボタンと仮定し、
                // ユーザーが最新メッセージから離れたら表示する
                newMessageBtn.classList.toggle('d-none', !isUserScrolledUp);

                // ユーザーが一番上（古いメッセージ側）に近づいたら過去のメッセージをロード
                // messagesEl.scrollTop が 200px 未満 (つまり上端から200px以内) で、かつロード中でない場合
                if (messagesEl.scrollTop < 200 && !isLoading) {
                    console.log('ローディング開始');
                    isLoading = true;
                    loadingIndicator.textContent = '過去の10件のメッセージを読み込み中...';
                    loadingIndicator.style.display = 'block';

                    try {
                        // 現在表示されているメッセージの中で最も古いタイムスタンプを取得
                        // messagesEl.querySelectorAll('[data-timestamp]')は既存のメッセージ要素を取得
                        const currentMessages = messagesEl.querySelectorAll('[data-timestamp]');
                        lastTimestamp = currentMessages.length ?
                            Math.min(...Array.from(currentMessages).map(m => Number(m.getAttribute('data-timestamp')))) :
                            null;

                        if (lastTimestamp) {
                            // FirebaseからlastTimestampより厳密に古いメッセージを10件取得
                            // orderByChild('timestamp')で昇順、endAt(lastTimestamp - 1)で指定タイムスタンプより古いものに限定
                            // limitToLast(10)でその中から最後の10件（つまり最も新しい10件）を取得
                            const olderMessagesSnapshot = await get(query(messagesRef, orderByChild('timestamp'), endAt(lastTimestamp - 1), limitToLast(10)));

                            const olderMessagesData = olderMessagesSnapshot.val();
                            let olderMessagesArray = [];

                            if (olderMessagesData) {
                                // 取得したデータを配列に変換し、タイムスタンプの降順（新しい順）にソート
                                olderMessagesArray = Object.entries(olderMessagesData);
                                olderMessagesArray.sort((a, b) => b[1].timestamp - a[1].timestamp); // 新しい順にソート
                            }

                            // 取得した古いメッセージがない場合、それ以上ロードするものはない
                            if (olderMessagesArray.length === 0) {
                                loadingIndicator.textContent = 'これ以上古いメッセージはありません。';
                                setTimeout(() => loadingIndicator.style.display = 'none', 1500);
                                isLoading = false;
                                return; // ロード処理を終了
                            }

                            // 関連するユーザーデータを取得（キャッシュ優先）
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

                            // 新しく読み込んだメッセージをメッセージリストの**先頭**に追加し、スクロール位置を調整
                            const oldScrollHeight = messagesEl.scrollHeight; // 追加前のスクロール高さ

                            for (const [key, { username, message, timestamp, userId = 'anonymous', ipAddress }] of olderMessagesArray) {
                                // 既に表示されているメッセージはスキップ
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

                                // **重要な修正点: appendChild から prepend に変更**
                                messagesEl.prepend(li);
                                setTimeout(() => li.classList.add('show'), 10); // フェードインアニメーション
                            }

                            // スクロール位置を調整し、読み込んだメッセージ群の先頭が見えるようにする
                            // 新しいメッセージが追加された分だけスクロール位置を調整する
                            const newScrollHeight = messagesEl.scrollHeight;
                            messagesEl.scrollTop += (newScrollHeight - oldScrollHeight);
                        }
                    } catch (error) {
                        console.error('過去メッセージ取得エラー:', error);
                        showError('過去のメッセージが取得できませんでした。');
                    } finally {
                        isLoading = false;
                        loadingIndicator.textContent = 'ロード完了'; // ロード完了を短時間表示
                        setTimeout(() => {
                            loadingIndicator.style.display = 'none';
                            loadingIndicator.textContent = 'ロード中...'; // 次回のためにリセット
                        }, 500);
                    }
                }
            }, 200); // デバウンス時間
        } catch (error) {
            console.error('スクロール処理エラー:', error);
        }
    };
    // messagesElにイベントリスナーを登録
    messagesEl.addEventListener('scroll', messagesElScrollHandler);
}

// ====== ここまで新しい「削除処理」コードブロック ======
// 認証状態変更リスナー
auth.onAuthStateChanged(async (user) => {
    try {
        await updateUserUI(user);
        
        if (user) {
            console.log('[script.js] Firebase認証: ユーザーがログインしました。');
            // ユーザーログイン時にメッセージの初期読み込みとリアルタイム監視を開始
            await loadInitialMessages(); // 既存メッセージを読み込む
            setupMessageListener(); // 新しいメッセージの監視を開始

            if (colorPicker) {
                if (!getCookie('colorAssignmentMode')) {
                    setCookie('colorAssignmentMode', 'user-selected', 365);
                    colorAssignmentMode = 'user-selected';
                }
                colorPicker.classList.toggle('show', colorAssignmentMode === 'user-selected' && user);
                if (colorAssignmentMode === 'user-selected') {
                    const savedColor = getCookie(`userColor_${user.uid}`);
                    const defaultColor = backgroundColors[0];
                    userColorSelect.value = savedColor && backgroundColors.includes(savedColor) ? savedColor : defaultColor;
                    console.log(`[script.js] ログイン時色設定: ユーザー ${user.uid}, 色: ${userColorSelect.value}`);
                    if (savedColor && backgroundColors.includes(savedColor)) {
                        userColorMap.set(user.uid, savedColor);
                    } else {
                        userColorMap.set(user.uid, defaultColor);
                        setCookie(`userColor_${user.uid}`, defaultColor, 365);
                    }
                    // reloadMessages() はここでは不要かもしれません。loadInitialMessagesが一度実行されればOKなはずです。
                    // 必要であれば残しても構いませんが、重複がないか確認してください。
                    // reloadMessages(); 
                }
            }

            // --- ここからトークン保存のコードを追加 ---
            const idToken = await user.getIdToken();
            console.log('Firebase ID Token:', idToken);
            localStorage.setItem('firebase_id_token', idToken);
            // --- ここまでトークン保存のコードを追加 ---

        } else {
            console.log('[script.js] Firebase認証: ユーザーがログアウトしました。');
            // ユーザーがログアウトしている場合、保存されたトークンを削除する
            localStorage.removeItem('firebase_id_token');
            console.log('ユーザーがログアウトしました。トークンを削除しました。');

            // ログアウト時のUIリセット
            userInfo.innerHTML = `<span class="status-dot status-away"></span>ゲスト <i class="fas fa-pencil-alt ms-1"></i>`;
            loginBtn.textContent = `<i class="fas fa-sign-in-alt"></i>`;
            loginModal.show();
            loginModalEl.removeAttribute('inert');
            unameModalEl.setAttribute('inert', '');
            if (progressOverlay) progressOverlay.classList.add('d-none');

            // ログアウト時にメッセージリスナーを解除（重複呼び出しを防ぐため）
            if (messageListener) {
                messageListener();
                messageListener = null; // リスナーをnullに設定
            }
            if (messageRemoveListener) {
                messageRemoveListener();
                messageRemoveListener = null; // リスナーをnullに設定
            }
            messagesEl.innerHTML = ''; // メッセージ表示エリアをクリア
        }

    } catch (error) {
        console.error('[script.js] 認証状態変更エラー:', error);
        showError('認証状態の更新に失敗しました。ページをリロードしてください。');
        userInfo.innerHTML = `<span class="status-dot status-away"></span>ゲスト <i class="fas fa-pencil-alt ms-1"></i>`;
        loginBtn.textContent = `<i class="fas fa-sign-in-alt"></i>`;
        loginModal.show();
        loginModalEl.removeAttribute('inert');
        unameModalEl.setAttribute('inert', '');
        if (progressOverlay) progressOverlay.classList.add('d-none');
    }
});

// モード変更リスナー (この部分は変更なしでOKです)
if (colorModeDropdown) {
    colorModeDropdown.nextElementSibling.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            colorAssignmentMode = e.target.getAttribute('data-mode');
            setCookie('colorAssignmentMode', colorAssignmentMode, 365);
            colorPicker.classList.toggle('show', colorAssignmentMode === 'user-selected' && auth.currentUser);
            userColorMap.clear();
            console.log('モード変更:', colorAssignmentMode, 'userColorMap リセット');
            reloadMessages();
            showSuccess(`背景色モードを${colorAssignmentMode === 'sequential' ? '順番' : colorAssignmentMode === 'random' ? 'ランダム' : '自分で選択'}に変更しました。`);
        });
    });
}

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

// 初回ロード時にProgress Overlayを表示 (変更なし)
document.addEventListener('DOMContentLoaded', () => {
    showProgressOverlay();
});