// ui-manager.js

// 必要なユーティリティ関数をインポート
import { showError, showSuccess, showToast, getCookie, setCookie, isMobileDevice, escapeHTMLAttribute } from './utils.js';

// DOM要素の取得
// これらの変数はDOM要素を保持します。
export let formEl;
export let inputEl;
export let messagesEl;
export let loginBtn;
export let errorAlert;
export let onlineUsersCountEl;
export let onlineUsersListEl;
export let compactModeBtn;
export let fontSizeS;
export let fontSizeM;
export let fontSizeL;
export let toggleEnterModeBtn;
export let newNameInput;
export let saveNameBtn;
export let logoutBtn;
export let avatarEl;
export let currentUsernameEl;
export let userIdEl;
export let toggleDebugModeBtn;
export let debugInfoEl;
export let versionInfoEl;
export let notificationToggle;
export let pushNotificationSwitch;
export let messageDisplayLimitSelect;
export let loginDropdown;
export let messageLoadingSpinner;
export let loadingMessageDiv;
export let newMessageBtn;
export let userColorPreference;
export let userColorPicker;
export let resetUserColorBtn;
export let userColorDisplay;

// モーダルのDOM要素をエクスポート
export let loginModalEl; // この変数はDOM要素を保持します
export let unameModalEl; // この変数はDOM要素を保持します

// UIの状態変数
let isCompactMode = getCookie('compactMode') === 'true';
let currentFontSize = getCookie('fontSize') || 'medium';
let colorAssignmentMode = getCookie('colorAssignmentMode') || 'sequential';
let enterMode = getCookie('enterMode') || 'enter';
let isDebugMode = getCookie('debugMode') === 'true';

// スクロール位置追跡用
let isUserScrolledUp = false;

// UIの初期化を行う関数
export function setupUI(authInstance, databaseInstance, onLoginSuccessCallback, onLogoutSuccessCallback, onNameUpdateSuccessCallback, sendMessageCallback, loadMoreMessagesCallback, uploadImageCallback, reportUserCallback, bannedUsersRef, deleteMessageCallback) {
    // DOM要素を初期化
    formEl = document.getElementById('message-form');
    inputEl = document.getElementById('message-input');
    messagesEl = document.getElementById('messages');
    loginBtn = document.getElementById('login-btn');
    errorAlert = document.getElementById('error-alert');
    onlineUsersCountEl = document.getElementById('online-users-count');
    onlineUsersListEl = document.getElementById('online-users-list');
    compactModeBtn = document.getElementById('compact-mode-btn');
    fontSizeS = document.getElementById('font-size-s');
    fontSizeM = document.getElementById('font-size-m');
    fontSizeL = document.getElementById('font-size-l');
    toggleEnterModeBtn = document.getElementById('toggle-enter-mode');
    newNameInput = document.getElementById('new-name-input');
    saveNameBtn = document.getElementById('save-name-btn');
    logoutBtn = document.getElementById('logout-btn');
    avatarEl = document.getElementById('avatar');
    currentUsernameEl = document.getElementById('current-username');
    userIdEl = document.getElementById('user-id');
    toggleDebugModeBtn = document.getElementById('toggle-debug-mode');
    debugInfoEl = document.getElementById('debug-info');
    versionInfoEl = document.getElementById('version-info');
    notificationToggle = document.getElementById('notification-toggle');
    pushNotificationSwitch = document.getElementById('push-notification-switch');
    messageDisplayLimitSelect = document.getElementById('message-display-limit');
    loginDropdown = document.getElementById('login-dropdown');
    messageLoadingSpinner = document.getElementById('message-loading-spinner');
    loadingMessageDiv = document.getElementById('loading-message');
    newMessageBtn = document.getElementById('new-message-btn');
    userColorPreference = document.getElementById('user-color-preference');
    userColorPicker = document.getElementById('user-color-picker');
    resetUserColorBtn = document.getElementById('reset-user-color-btn');
    userColorDisplay = document.getElementById('user-color-display');

    // モーダルのDOM要素を取得
    loginModalEl = document.getElementById('loginModal');
    unameModalEl = document.getElementById('unameModal');

    // Bootstrap Modalインスタンスを別途作成
    const loginModalInstance = loginModalEl ? new bootstrap.Modal(loginModalEl) : null;
    const unameModalInstance = unameModalEl ? new bootstrap.Modal(unameModalEl) : null;

    // ... その他のDOM要素の初期化やイベントリスナーの設定 ...

    // モーダル非表示時のフォーカス管理
    if (unameModalEl) { // ここでunameModalElはDOM要素
        unameModalEl.addEventListener('hidden.bs.modal', () => {
            unameModalEl.setAttribute('inert', '');
            if (loginBtn) loginBtn.focus();
        });
    }

    if (loginModalEl) { // ここでloginModalElはDOM要素
        loginModalEl.addEventListener('hidden.bs.modal', () => {
            loginModalEl.setAttribute('inert', '');
            if (loginBtn) loginBtn.focus();
        });
    }

    // 他のイベントリスナーの設定...
    if (formEl) {
        formEl.addEventListener('submit', (e) => {
            e.preventDefault();
            const messageText = inputEl.value;
            callbacks.onSendMessage(messageText);
        });
    }

    // 新着メッセージボタン (変更なし) - これはDOM要素に依存するため、DOM要素の初期化後に配置
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
}


// その他の関数（setCompactMode, setFontSize, updateEnterModeButton, updateUserUI, renderOnlineUsers, startTitleFlash, stopTitleFlash, updateStatusIndicator, disposeTooltip, showTooltip, handleImageError, getClientIpは変更なし）

// Compact Mode
function setCompactMode(enabled) {
    document.body.classList.toggle('compact-mode', enabled);
}

// Font Size
function setFontSize(size) {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add(`font-${size}`);
    setCookie('fontSize', size, 365);
    currentFontSize = size;
    showSuccess(`フォントサイズを「${size === 'small' ? '小' : size === 'medium' ? '中' : '大'}」に設定しました。`);
}

// Enter Mode Button Text
function updateEnterModeButton() {
    if (toggleEnterModeBtn) {
        toggleEnterModeBtn.textContent = enterToSend ? 'Enterで送信 (Shift+Enterで改行)' : 'Shift+Enterで送信 (Enterで改行)';
    }
}

/**
 * ユーザーUIの更新
 * @param {object} user - Firebase Userオブジェクト
 * @param {boolean} isLoggedIn - ログイン状態
 * @param {object} currentUserInfo - 現在のユーザー情報
 */
export function updateUserUI(user, isLoggedIn, currentUserInfo) {
    if (isLoggedIn && user) {
        loginBtn.classList.add('d-none');
        loginDropdown.classList.remove('d-none');
        currentUsernameEl.textContent = currentUserInfo.displayUsername || '名無し';
        userIdEl.textContent = user.uid;
        // userColorPicker の初期値を設定
        if (userColorPicker) {
            userColorPicker.value = assignUserBackgroundColor(user.uid);
            userColorDisplay.style.backgroundColor = userColorPicker.value;
        }

        // ラジオボタンの初期選択
        const colorAssignmentMode = getCookie('colorAssignmentMode') || 'sequential';
        const selectedRadio = document.querySelector(`input[name="colorAssignmentMode"][value="${colorAssignmentMode}"]`);
        if (selectedRadio) {
            selectedRadio.checked = true;
        }

        if (avatarEl) {
            if (currentUserInfo.photoURL && currentUserInfo.photoURL !== 'null' && currentUserInfo.photoURL !== '') {
                avatarEl.src = currentUserInfo.photoURL;
                avatarEl.classList.remove('d-none');
                avatarEl.onerror = () => handleImageError(avatarEl, user.uid, currentUserInfo.displayUsername, currentUserInfo.photoURL);
            } else {
                handleImageError(avatarEl, user.uid, currentUserInfo.displayUsername, currentUserInfo.photoURL);
            }
        }
    } else {
        loginBtn.classList.remove('d-none');
        loginBtn.textContent = 'ログイン';
        loginDropdown.classList.add('d-none');
        currentUsernameEl.textContent = 'ゲスト';
        userIdEl.textContent = 'N/A';
        avatarEl.src = '';
        avatarEl.classList.add('d-none');
    }
}

// オンラインユーザーのリストをレンダリング
export function renderOnlineUsers(onlineUsers) {
    if (onlineUsersCountEl) {
        onlineUsersCountEl.textContent = onlineUsers.length;
    }
    if (onlineUsersListEl) {
        onlineUsersListEl.innerHTML = '';
        if (onlineUsers.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = 'オンラインユーザーはいません。';
            onlineUsersListEl.appendChild(li);
        } else {
            onlineUsers.forEach(user => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.textContent = user;
                onlineUsersListEl.appendChild(li);
            });
        }
    }
}

// タブのタイトルを点滅させる
let titleFlashInterval;
let originalTitle = document.title;

export function startTitleFlash(newMessage) {
    if (titleFlashInterval) return; // 既に点滅中の場合は何もしない

    let toggle = false;
    titleFlashInterval = setInterval(() => {
        document.title = toggle ? newMessage : originalTitle;
        toggle = !toggle;
    }, 1000); // 1秒ごとに切り替え
}

export function stopTitleFlash() {
    if (titleFlashInterval) {
        clearInterval(titleFlashInterval);
        titleFlashInterval = null;
        document.title = originalTitle; // 元のタイトルに戻す
    }
}

// ユーザーのアクティビティ状態をUIに反映
export function updateStatusIndicator(status) {
    const statusIndicator = document.getElementById('status-indicator');
    if (statusIndicator) {
        statusIndicator.className = `status-indicator status-${status}`;
        statusIndicator.title = `現在のステータス: ${status === 'online' ? 'オンライン' : '離席中'}`;
    }
}

// ツールチップを破棄する関数
export function disposeTooltip(element) {
    const tooltipInstance = bootstrap.Tooltip.getInstance(element);
    if (tooltipInstance) {
        tooltipInstance.dispose();
    }
}

// ツールチップを表示する関数
export function showTooltip(element, message) {
    // 既存のツールチップがあれば破棄
    disposeTooltip(element);
    // 新しいツールチップを作成
    const tooltip = new bootstrap.Tooltip(element, {
        title: message,
        trigger: 'manual', // 手動で制御
        placement: 'bottom'
    });
    tooltip.show();
    // 3秒後に非表示
    setTimeout(() => {
        tooltip.hide();
        // 完全に非表示になった後に破棄（オプション）
        setTimeout(() => disposeTooltip(element), 500);
    }, 3000);
}

// 画像読み込みエラー処理関数
export function handleImageError(imgElement, userId, displayUsername, photoURL) {
    try {
        const initial = displayUsername && typeof displayUsername === 'string' && displayUsername.length > 0
            ? displayUsername.charAt(0).toUpperCase()
            : 'A';
        imgElement.outerHTML = `<div class="avatar">${initial}</div>`;
        console.log(`画像読み込みエラー: userId=${userId}, URL=${photoURL || 'なし'}`);
    } catch (error) {
        console.error('handleImageErrorでのエラー:', error);
    }
}