// ui-manager.js

// 必要なユーティリティ関数をインポート
import { showError, showSuccess, showToast, getCookie, setCookie, isMobileDevice, escapeHTMLAttribute, cleanPhotoURL, cleanUsername } from './utils.js';
import * as bootstrap from 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';

// グローバルで利用するために、初期化されるまで null で宣言
let loginModalEl = null;

// DOM要素の取得
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
export let avatarImgEl; // img要素用
export let avatarInitialsEl; // 頭文字表示用div要素
export let currentUsernameEl;
export let userIdEl;
export let toggleDebugModeBtn;
export let debugInfoEl;
export let versionInfoEl;
export let unameModalEl;
export let notificationButton;
export let messageDisplayLimitSelect;
export let loginDropdown;
export let messageLoadingSpinner;
export let loadingMessageDiv;
export let newMessageBtn;
export let userColorPreference;
export let userColorPicker;
export let resetUserColorBtn;
export let userColorDisplay;

/**
 * UIのDOM要素を取得し、イベントリスナーを設定して初期化します。
 * @param {object} authInstance - Firebase Authインスタンス
 * @param {object} databaseInstance - Firebase Realtime Databaseインスタンス
 * @param {function} onLoginSuccessCallback - ログインボタンクリック時のコールバック
 * @param {function} onLogoutSuccessCallback - ログアウト成功時のコールバック
 * @param {function} onNameUpdateSuccessCallback - ユーザー名更新成功時のコールバック
 * @param {function} onMessageSendCallback - メッセージ送信時のコールバック
 * @param {function} onDeleteMessageCallback - メッセージ削除時のコールバック
 * @param {function} onMessageLimitChange - メッセージ表示数変更時のコールバック
 * @param {function} onColorModeChange - 背景色モード変更時のコールバック
 * @param {function} onUserColorChange - ユーザーメッセージ色変更時のコールバック
 * @param {function} onResetUserColor - ユーザーメッセージ色リセット時のコールバック
 */
export function setupUI(
    authInstance,
    databaseInstance,
    onLoginSuccessCallback,
    onLogoutSuccessCallback,
    onNameUpdateSuccessCallback,
    onMessageSendCallback,
    onDeleteMessageCallback,
    onMessageLimitChange,
    onColorModeChange,
    onUserColorChange,
    onResetUserColor
) {
    try {
        // モーダルの初期化
        initLoginModal();

        // DOM要素の参照を取得
        formEl = document.getElementById('messageForm');
        inputEl = document.getElementById('m');
        messagesEl = document.getElementById('messages');
        loginBtn = document.getElementById('login-btn');
        errorAlert = document.getElementById('error-alert');
        onlineUsersCountEl = document.getElementById('online-users-count');
        compactModeBtn = document.getElementById('compactModeBtn');
        fontSizeS = document.getElementById('fontSizeS');
        fontSizeM = document.getElementById('fontSizeM');
        fontSizeL = document.getElementById('fontSizeL');
        toggleEnterModeBtn = document.getElementById('toggleModeBtn');
        newNameInput = document.getElementById('uname');
        saveNameBtn = document.getElementById('confirmName');
        logoutBtn = document.getElementById('signOut');
        avatarImgEl = document.getElementById('avatar-img');
        avatarInitialsEl = document.getElementById('avatar-initials');
        currentUsernameEl = document.getElementById('current-username-display');
        notificationButton = document.getElementById('notification-toggle-btn');
        newMessageBtn = document.getElementById('newMessageBtn');
        userColorPicker = document.getElementById('userColorSelect');
        unameModalEl = new bootstrap.Modal(document.getElementById('unameModal'));

        // アバター要素の初期化確認
        if (!avatarImgEl || !avatarInitialsEl) {
            console.warn('[ui-manager.js] setupUI: avatarImgEl または avatarInitialsEl の初期化に失敗しました。', {
                avatarImgEl,
                avatarInitialsEl,
            });
        }

        // イベントリスナーの設定
        document.getElementById('googleLogin').addEventListener('click', () => onLoginSuccessCallback('google'));
        document.getElementById('twitterLogin').addEventListener('click', () => onLoginSuccessCallback('twitter'));
        document.getElementById('anonymousLogin').addEventListener('click', () => onLoginSuccessCallback('anonymous'));
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', onLogoutSuccessCallback);
        } else {
            console.warn('[ui-manager.js] logoutBtn 要素が見つかりませんでした。');
        }

        if (formEl) {
            formEl.addEventListener('submit', onMessageSendCallback);
        } else {
            console.warn('[ui-manager.js] messageForm 要素が見つかりませんでした。');
        }

        // ユーザー名変更
        const userInfoDisplay = document.getElementById('user-info');
        if (userInfoDisplay) {
            userInfoDisplay.addEventListener('click', () => {
                const currentName = currentUsernameEl.textContent;
                if (newNameInput) {
                    newNameInput.value = currentName;
                }
                unameModalEl.show();
            });
        } else {
            console.warn('[ui-manager.js] user-info 要素が見つかりませんでした。');
        }

if (saveNameBtn) {
    saveNameBtn.removeEventListener('click', handleNameUpdate); // 既存リスナーを削除
    saveNameBtn.addEventListener('click', async () => {
        console.log('[ui-manager.js] saveNameBtn clicked, newUsername:', newNameInput.value.trim());
        const newUsername = newNameInput.value.trim();
        if (newUsername === '') {
            showError('ユーザー名を入力してください。');
            return;
        }
        try {
            await onNameUpdateSuccessCallback(newUsername);
            console.log('[ui-manager.js] onNameUpdateSuccessCallback completed');
            unameModalEl.hide();
            console.log('[ui-manager.js] Modal hidden:', !unameModalEl._isShown);
            showSuccess('ユーザー名が正常に更新されました！');
        } catch (error) {
            console.error('[ui-manager.js] ユーザー名更新エラー:', error);
            showError(`ユーザー名の更新中にエラーが発生しました: ${error.message}`);
        }
    });
} else {
    console.warn('[ui-manager.js] confirmName (saveNameBtn) 要素が見つかりませんでした。');
}        
        // メッセージ削除確認モーダル
        const deleteMessageModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        let messageToDeleteId = null;

        if (messagesEl) {
            messagesEl.addEventListener('click', (event) => {
                const deleteButton = event.target.closest('.delete-message');
                if (deleteButton) {
                    messageToDeleteId = deleteButton.dataset.messageId;
                    deleteMessageModal.show();
                }
            });
        } else {
            console.warn('[ui-manager.js] messages 要素が見つかりませんでした。');
        }

        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => {
                if (messageToDeleteId) {
                    onDeleteMessageCallback(messageToDeleteId);
                    messageToDeleteId = null;
                    deleteMessageModal.hide();
                }
            });
        } else {
            console.warn('[ui-manager.js] confirmDeleteBtn 要素が見つかりませんでした。');
        }

        // 設定関連
        if (compactModeBtn) {
            compactModeBtn.addEventListener('click', () => {
                document.body.classList.toggle('compact-mode');
                const isCompact = document.body.classList.contains('compact-mode');
                setCookie('compactMode', isCompact ? 'true' : 'false', 365);
                showSuccess(`コンパクトモードを${isCompact ? '有効' : '無効'}にしました。`);
            });
        } else {
            console.warn('[ui-manager.js] compactModeBtn 要素が見つかりませんでした。');
        }

        if (fontSizeS) fontSizeS.addEventListener('click', () => setFontSize('small')); else console.warn('[ui-manager.js] fontSizeS 要素が見つかりませんでした。');
        if (fontSizeM) fontSizeM.addEventListener('click', () => setFontSize('medium')); else console.warn('[ui-manager.js] fontSizeM 要素が見つかりませんでした。');
        if (fontSizeL) fontSizeL.addEventListener('click', () => setFontSize('large')); else console.warn('[ui-manager.js] fontSizeL 要素が見つかりませんでした。');

        if (toggleEnterModeBtn) {
            toggleEnterModeBtn.addEventListener('click', () => {
                const currentMode = getCookie('enterSendMode') === 'true';
                setCookie('enterSendMode', !currentMode ? 'true' : 'false', 365);
                showSuccess(`Enterで送信モードを${!currentMode ? '有効' : '無効'}にしました。`);
            });
        } else {
            console.warn('[ui-manager.js] toggleModeBtn (EnterMode) 要素が見つかりませんでした。');
        }

        const userColorSelect = document.getElementById('userColorSelect');
        if (userColorSelect) {
            userColorSelect.addEventListener('change', (event) => {
                const selectedColorClass = event.target.value;
                if (selectedColorClass === '色') {
                    showToast('メッセージの色を選択してください。', 'info');
                    return;
                }
                onUserColorChange(selectedColorClass);
            });
        } else {
            console.warn('[ui-manager.js] userColorSelect 要素が見つかりませんでした。');
        }
        
        // 初期状態の適用
        applyInitialSettings();
    } catch (error) {
        console.error('[ui-manager.js] setupUIエラー:', error);
    }
}

/**
 * フォントサイズを設定し、クッキーに保存します。
 * @param {string} size - 'small', 'medium', 'large'
 */
function setFontSize(size) {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    if (messagesEl) {
        messagesEl.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        messagesEl.classList.add(`font-size-${size}`);
    }
    setCookie('fontSize', size, 365);
    const fontButtons = [fontSizeS, fontSizeM, fontSizeL];
    fontButtons.forEach(btn => {
        if (btn) {
            if (btn.id === `fontSize${size.charAt(0).toUpperCase()}`) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
    showSuccess(`フォントサイズを${size === 'small' ? '小' : size === 'medium' ? '中' : '大'}に設定しました。`);
}

/**
 * 初期設定（クッキーから読み込み）をUIに適用します。
 */
function applyInitialSettings() {
    if (getCookie('compactMode') === 'true') {
        document.body.classList.add('compact-mode');
    }
    const savedFontSize = getCookie('fontSize');
    if (savedFontSize) {
        setFontSize(savedFontSize);
    } else {
        setFontSize('medium');
    }
    if (getCookie('enterSendMode') === 'true') {
        // script.jsでこの設定が使われる
    }
    const isSoundEnabled = getCookie('notificationSoundEnabled') === 'true';
    updateNotificationButtonUI(isSoundEnabled);
    const savedColorMode = getCookie('colorAssignmentMode');
    if (savedColorMode) {
        userColorPreference = savedColorMode;
    }
    const savedUserColor = getCookie('userSelectedColor');
    if (userColorPicker && savedUserColor) {
        userColorPicker.value = savedUserColor;
    }
}

/**
 * ステータスインジケーターの表示を更新します。
 * @param {string} status - 'online' または 'offline'
 */
export function updateStatusIndicator(status) {
    const statusDot = document.querySelector('.status-dot');
    if (statusDot) {
        statusDot.classList.remove('status-online', 'status-away');
        statusDot.classList.add(`status-${status}`);
    } else {
        console.warn('[ui-manager.js] status-dot 要素が見つかりませんでした。');
    }
}

/**
 * ツールチップを破棄する関数
 */
export function disposeTooltip(element) {
    const tooltipInstance = bootstrap.Tooltip.getInstance(element);
    if (tooltipInstance) {
        tooltipInstance.dispose();
    }
}

/**
 * ツールチップを表示する関数
 */
export function showTooltip(element, message) {
    disposeTooltip(element);
    const tooltip = new bootstrap.Tooltip(element, {
        title: message,
        trigger: 'manual',
        placement: 'bottom'
    });
    tooltip.show();
    setTimeout(() => {
        tooltip.hide();
        setTimeout(() => disposeTooltip(element), 500);
    }, 3000);
}

/**
 * 通知音トグルボタンのUIを更新します。
 * @param {boolean} isEnabled - 通知音が有効な場合は true、無効な場合は false。
 */
export function updateNotificationButtonUI(isEnabled) {
    if (notificationButton) {
        const icon = notificationButton.querySelector('i.fas');
        if (icon) {
            if (isEnabled) {
                icon.classList.remove('fa-bell-slash');
                icon.classList.add('fa-bell');
                notificationButton.setAttribute('aria-label', '通知音を無効にする');
                notificationButton.classList.remove('btn-outline-secondary');
                notificationButton.classList.add('btn-primary');
            } else {
                icon.classList.remove('fa-bell');
                icon.classList.add('fa-bell-slash');
                notificationButton.setAttribute('aria-label', '通知音を有効にする');
                notificationButton.classList.remove('btn-primary');
                notificationButton.classList.add('btn-outline-secondary');
            }
        }
    } else {
        console.warn('[ui-manager.js] updateNotificationButtonUI: notificationButton 要素が見つかりません。');
    }
}

/**
 * 画像読み込みエラー時の処理（アバター画像用）
 * @param {HTMLImageElement} imgElement - 対象のimg要素
 * @param {string} userId - ユーザーID
 * @param {string} displayUsername - 表示するユーザー名
 * @param {string} photoURL - 元のphotoURL
 */
export function handleImageError(imgElement, userId, displayUsername, photoURL) {
    try {
        if (!imgElement || !(imgElement instanceof HTMLImageElement)) {
            console.error('[ui-manager.js] handleImageError: imgElementが無効です。', { imgElement, userId, displayUsername, photoURL });
            return;
        }

        const cleanedUsername = cleanUsername(displayUsername || '匿名');
        const initials = cleanedUsername.charAt(0).toUpperCase() || '？';
        const isSmall = imgElement.classList.contains('profile-img-small');
        const avatarDiv = document.createElement('div');
        avatarDiv.className = `avatar${isSmall ? '-small' : ''} rounded-circle d-flex align-items-center justify-content-center text-white bg-secondary`;
        avatarDiv.textContent = initials;

        // imgElementを頭文字アバターに置き換え
        imgElement.replaceWith(avatarDiv);
        console.log(`[ui-manager.js] アバター画像読み込みエラー: userId=${userId}, username=${cleanedUsername}, 頭文字=${initials} を表示`);
    } catch (error) {
        console.error('[ui-manager.js] handleImageErrorエラー:', error, { imgElement, userId, displayUsername, photoURL });
    }
}

/**
 * ユーザーのアバター表示（画像または頭文字）を更新します。
 * @param {Object} options - 更新オプション
 * @param {string} options.photoURL - ユーザーのプロフィール画像のURL
 * @param {string} options.displayUsername - ユーザーの表示名
 * @param {string} options.userId - ユーザーID
 */
export function updateUserAvatarDisplay({ photoURL, displayUsername, userId }) {
    console.log('[ui-manager.js] updateUserAvatarDisplay called with:', { photoURL, displayUsername, userId });
    
    const avatarImgEl = document.getElementById('avatar-img');
    const avatarInitialsEl = document.getElementById('avatar-initials');
    const currentUsernameEl = document.getElementById('current-username-display');
    const userInfo = document.getElementById('user-info');

    if (!avatarImgEl || !avatarInitialsEl || !currentUsernameEl || !userInfo) {
        console.error('[ui-manager.js] updateUserAvatarDisplay: 必要なDOM要素が見つかりません', {
            avatarImgEl,
            avatarInitialsEl,
            currentUsernameEl,
            userInfo
        });
        return;
    }

    try {
        const cleanedUsername = cleanUsername(displayUsername || '匿名');
        currentUsernameEl.textContent = cleanedUsername;

        // photoURL の処理（オブジェクトの場合に対応）
        let urlToUse = photoURL;
        if (typeof photoURL === 'object' && photoURL !== null && photoURL.photoURL) {
            console.warn('[ui-manager.js] updateUserAvatarDisplay: photoURLがオブジェクトです。photoURL.photoURLを使用:', photoURL.photoURL);
            urlToUse = photoURL.photoURL;
        }

        const cleanedPhotoURL = cleanPhotoURL(urlToUse, window.location.origin);
        console.log('[ui-manager.js] cleanPhotoURL input:', urlToUse, 'baseURL:', window.location.origin, 'output:', cleanedPhotoURL);

        // 既存の <div class="avatar-small"> を削除
        const existingAvatarDiv = userInfo.querySelector('div.avatar-small:not(#avatar-initials)');
        if (existingAvatarDiv) {
            existingAvatarDiv.remove();
            console.log('[ui-manager.js] 既存の非公式アバターdivを削除');
        }

        if (cleanedPhotoURL && typeof cleanedPhotoURL === 'string' && cleanedPhotoURL.trim() !== '' &&
            !cleanedPhotoURL.toLowerCase().includes('icon.png') && !cleanedPhotoURL.toLowerCase().includes('default-avatar.png')) {
            avatarImgEl.src = cleanedPhotoURL;
            avatarImgEl.alt = escapeHTMLAttribute(cleanedUsername);
            avatarImgEl.dataset.uid = userId || 'anonymous';
            avatarImgEl.classList.remove('d-none');
            avatarInitialsEl.classList.add('d-none');
            // エラーハンドラをリセットしてから設定
            avatarImgEl.onerror = null;
            avatarImgEl.onerror = () => {
                console.error('[ui-manager.js] アバター画像読み込みエラー:', {
                    userId,
                    username: cleanedUsername,
                    photoURL: cleanedPhotoURL,
                    error: 'Image failed to load'
                });
                handleImageError(avatarImgEl, userId, cleanedUsername, cleanedPhotoURL);
            };
            console.log(`[ui-manager.js] アバター画像を更新: ${cleanedPhotoURL}`);
        } else {
            console.log('[ui-manager.js] photoURLが無効、頭文字アバターを表示: userId=', userId, ', username=', cleanedUsername);
            avatarImgEl.classList.add('d-none');
            avatarInitialsEl.textContent = cleanedUsername.charAt(0).toUpperCase() || '？';
            avatarInitialsEl.classList.remove('d-none');
        }
    } catch (error) {
        console.error('[ui-manager.js] updateUserAvatarDisplayエラー:', error, { photoURL, displayUsername, userId });
        const cleanedUsername = cleanUsername(displayUsername || '匿名');
        avatarImgEl.classList.add('d-none');
        avatarInitialsEl.textContent = cleanedUsername.charAt(0).toUpperCase() || '？';
        avatarInitialsEl.classList.remove('d-none');
    }
}

/**
 * ユーザーのUIを更新します（ユーザー名編集後に呼び出される）。
 * @param {Object} user - Firebase Authのユーザーオブジェクト
 * @param {Object} userData - データベースから取得したユーザーデータ
 */
export function updateUserUI(user, userData) {
    console.log('[ui-manager.js] updateUserUI called with:', { user, userData });
    
    if (!user || !userData) {
        console.error('[ui-manager.js] updateUserUI: user または userData が無効です', { user, userData });
        return;
    }

    try {
        const cleanedUsername = cleanUsername(userData.username || '匿名');
        const cleanedPhotoURL = cleanPhotoURL(userData.photoURL, window.location.origin);
        
        updateUserAvatarDisplay({
            photoURL: cleanedPhotoURL || userData.photoURL,
            displayUsername: cleanedUsername,
            userId: user.uid
        });
        
        console.log('[ui-manager.js] updateUserUI completed, username:', cleanedUsername);
    } catch (error) {
        console.error('[ui-manager.js] updateUserUIエラー:', error);
        showError('ユーザー情報の更新に失敗しました。');
    }
}

/**
 * アバターのHTMLを生成します。画像があれば画像、なければ頭文字を返します。
 * @param {string|null} photoURL - プロフィール画像のURL
 * @param {string} displayUsername - 表示するユーザー名
 * @param {string} userId - ユーザーID
 * @param {string} [size='normal'] - 'small' | 'normal'
 * @returns {string} HTML文字列
 */
export function renderUserAvatar(photoURL, displayUsername, userId, size = 'normal') {
    const cleanedUsername = cleanUsername(displayUsername || '匿名');
    const initials = cleanedUsername.charAt(0).toUpperCase() || '？';
    const escapedUsername = escapeHTMLAttribute(cleanedUsername);
    const escapedUserId = escapeHTMLAttribute(userId || '');
    const cleanedURL = cleanPhotoURL(photoURL);

    const isSmall = size === 'small';
    const imgClass = isSmall ? 'profile-img-small' : 'profile-img';
    const avatarClass = isSmall ? 'avatar-small' : 'avatar';

    let urlToUse = null;

    // 有効なphotoURLを優先的に使用
    if (photoURL && typeof photoURL === 'string' && photoURL.trim() !== '' &&
        !photoURL.toLowerCase().includes('icon.png') &&
        !photoURL.toLowerCase().includes('default-avatar.png')) {

        urlToUse = cleanedURL;

        // cleanedURLが無効なら元のURLを試す
        if (!urlToUse) {
            try {
                new URL(photoURL, window.location.origin);
                urlToUse = photoURL;
            } catch (e) {
                console.warn('[ui-manager.js] renderUserAvatar: 無効なphotoURLを検出。頭文字にフォールバックします。', { photoURL, error: e });
            }
        }
    }

    if (urlToUse) {
        return `<img src="${escapeHTMLAttribute(urlToUse)}"
                     alt="${escapedUsername}"
                     class="${imgClass} rounded-circle"
                     data-uid="${escapedUserId}"
                     onerror="handleImageError(this, '${escapedUserId}', '${escapedUsername}', '${escapeHTMLAttribute(urlToUse)}')">`;
    }

    // 有効なURLがない場合は頭文字アバターを返す
    return `<div class="${avatarClass} rounded-circle d-flex align-items-center justify-content-center text-white bg-secondary">
                ${initials}
            </div>`;
}


/**
 * ログインモーダルを初期化します。
 */
export function initLoginModal() {
    const modalElement = document.getElementById('loginModal');
    if (modalElement) {
        loginModalEl = new bootstrap.Modal(modalElement);
        console.log('[ui-manager.js] ログインモーダルを初期化しました。');
    } else {
        console.error('[ui-manager.js] ID "loginModal" を持つ要素が見つかりませんでした。モーダルを初期化できません。');
    }
}

/**
 * ログインモーダルを表示します。
 */
export function showLoginModal() {
    if (loginModalEl) {
        loginModalEl.show();
        console.log('[ui-manager.js] ログインモーダルを表示しました。');
    } else {
        console.warn('[ui-manager.js] loginModal が初期化されていません。モーダルを表示できません。');
    }
}

/**
 * ログインモーダルを閉じます。
 */
export function hideLoginModal() {
    if (loginModalEl) {
        loginModalEl.hide();
        console.log('[ui-manager.js] ログインモーダルを閉じました。');
    } else {
        console.warn('[ui-manager.js] loginModal が初期化されていません。モーダルを閉じられません。');
    }
}