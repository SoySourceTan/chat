// ui-manager.js

// 必要なユーティリティ関数をインポート
import { showError, showSuccess, showToast, getCookie, setCookie, isMobileDevice, escapeHTMLAttribute, cleanPhotoURL } from './utils.js'; // cleanPhotoURLを追加

// DOM要素の取得
// これらの変数はDOM要素を保持します。
export let formEl;
export let inputEl;
export let messagesEl;
export let loginBtn;
export let errorAlert;
export let onlineUsersCountEl; // HTMLにはonline-users-countがないが、online-usersはある
export let onlineUsersListEl; // HTMLには存在しない
export let compactModeBtn;
export let fontSizeS;
export let fontSizeM;
export let fontSizeL;
export let toggleEnterModeBtn;
export let newNameInput;
export let saveNameBtn;
export let logoutBtn;
export let avatarImgEl; // ★変更: avatarEl から avatarImgEl に変更 (img要素用)
export let avatarInitialsEl; // ★追加: 頭文字表示用div要素
export let currentUsernameEl;
export let userIdEl; // HTMLには存在しない
export let toggleDebugModeBtn; // HTMLには存在しない
export let debugInfoEl; // HTMLには存在しない
export let versionInfoEl;
export let loginModalEl; // ★修正: ここをコメントアウト解除し、正しくBootstrap Modalインスタンスを保持するようにします
export let unameModalEl;
export let notificationButton;

export let messageDisplayLimitSelect; // HTMLには存在しない
export let loginDropdown; // HTMLには存在しない
export let messageLoadingSpinner; // HTMLには存在しない
export let loadingMessageDiv; // HTMLには存在しない
export let newMessageBtn;
export let userColorPreference;
export let userColorPicker;
export let resetUserColorBtn; // HTMLには存在しない
export let userColorDisplay; // HTMLには存在しない


// UIの初期化
/**
 * UIのDOM要素を取得し、イベントリスナーを設定して初期化します。
 * @param {object} authInstance - Firebase Authインスタンス
 * @param {object} databaseInstance - Firebase Realtime Databaseインスタンス
 * @param {function} onLoginSuccessCallback - ログインボタンクリック時のコールバック (認証処理そのものではない点に注意)
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
    // DOM要素の参照を取得
    formEl = document.getElementById('messageForm');
    inputEl = document.getElementById('m');
    messagesEl = document.getElementById('messages');
    loginBtn = document.getElementById('login-btn');
    errorAlert = document.getElementById('error-alert');
    onlineUsersCountEl = document.getElementById('online-users-count'); // HTMLにはonline-users-countがないが、online-usersはある
    // onlineUsersListEl = document.getElementById('online-users-list'); // HTMLには存在しないためコメントアウト
    compactModeBtn = document.getElementById('compactModeBtn');
    fontSizeS = document.getElementById('fontSizeS');
    fontSizeM = document.getElementById('fontSizeM');
    fontSizeL = document.getElementById('fontSizeL');
    toggleEnterModeBtn = document.getElementById('toggleModeBtn');
    newNameInput = document.getElementById('uname');
    saveNameBtn = document.getElementById('confirmName');
    logoutBtn = document.getElementById('signOut');
    avatarImgEl = document.getElementById('avatar-img'); // ★変更: idで取得
    avatarInitialsEl = document.getElementById('avatar-initials'); // ★追加: idで取得
    currentUsernameEl = document.getElementById('current-username-display');
    // userIdEl = document.getElementById('user-id-display'); // HTMLには存在しないためコメントアウト
    // toggleDebugModeBtn = document.getElementById('toggleDebugModeBtn'); // HTMLには存在しないためコメントアウト
    // debugInfoEl = document.getElementById('debug-info'); // HTMLには存在しないためコメントアウト
    notificationButton = document.getElementById('notification-toggle-btn');
    // messageDisplayLimitSelect = document.getElementById('messageDisplayLimitSelect'); // HTMLには存在しないためコメントアウト
    // loginDropdown = document.getElementById('loginDropdown'); // HTMLには存在しないためコメントアウト
    // messageLoadingSpinner = document.querySelector('#loading-message-div .spinner-border'); // HTMLには存在しないためコメントアウト
    // loadingMessageDiv = document.getElementById('loading-message-div'); // HTMLには存在しないためコメントアウト
    newMessageBtn = document.getElementById('newMessageBtn');

    // colorPicker の select 要素を取得
    userColorPicker = document.getElementById('userColorSelect');
    // resetUserColorBtn = document.getElementById('resetUserColorBtn'); // HTMLには存在しないためコメントアウト
    // userColorDisplay = document.getElementById('user-color-display'); // HTMLには存在しないためコメントアウト

    // モーダル要素の取得と初期化
    const loginModalDomElement = document.getElementById('loginModal');
    if (loginModalDomElement) {
        loginModalEl = new bootstrap.Modal(loginModalDomElement);
        console.log('[ui-manager.js] loginModalEl 初期化成功:', loginModalEl);
    } else {
        console.warn('[ui-manager.js] ID "loginModal" を持つ要素が見つかりません。');
    }
    unameModalEl = new bootstrap.Modal(document.getElementById('unameModal'));

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
        saveNameBtn.addEventListener('click', async () => {
            const newUsername = newNameInput.value.trim();
            if (newUsername === '') {
                showError('ユーザー名を入力してください。');
                return;
            }

            console.log('[ui-manager.js] ユーザー名更新処理開始。onNameUpdateSuccessCallbackを呼び出します。');
            try {
                await onNameUpdateSuccessCallback(newUsername);
                console.log('[ui-manager.js] onNameUpdateSuccessCallbackが完了しました。モーダルを非表示にします。');
                if (unameModalEl) {
                    console.log('[ui-manager.js] unameModalElが存在します。hide()を呼び出します。', unameModalEl);
                    unameModalEl.hide();
                    console.log('[ui-manager.js] unameModalEl.hide()が呼び出されました。');
                } else {
                    console.warn('[ui-manager.js] unameModalEl が見つかりません。モーダルを閉じられません。');
                }
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
    let messageToDeleteId = null; // 削除対象のメッセージIDを保持する変数

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
                messageToDeleteId = null; // リセット
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
    
    // デバッグモードトグルはHTMLに要素がないためコメントアウト
    // if (toggleDebugModeBtn && debugInfoEl) {
    //     toggleDebugModeBtn.addEventListener('click', () => {
    //         debugInfoEl.classList.toggle('d-none');
    //         const isDebugMode = !debugInfoEl.classList.contains('d-none');
    //         setCookie('debugMode', isDebugMode ? 'true' : 'false', 365);
    //         showSuccess(`デバッグモードを${isDebugMode ? '有効' : '無効'}にしました。`);
    //     });
    // } else {
    //     console.warn('[ui-manager.js] toggleDebugModeBtn または debugInfoEl 要素が見つかりませんでした。');
    // }

    // 初期状態の適用
    applyInitialSettings();
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
    // コンパクトモード
    if (getCookie('compactMode') === 'true') {
        document.body.classList.add('compact-mode');
    }
    // フォントサイズ
    const savedFontSize = getCookie('fontSize');
    if (savedFontSize) {
        setFontSize(savedFontSize);
    } else {
        setFontSize('medium'); // デフォルト
    }
    // Enterで送信モード (UIはここでは更新しない)
    if (getCookie('enterSendMode') === 'true') {
        // script.jsでこの設定が使われる
    }
    
    // 通知音の初期状態をUIに適用
    const isSoundEnabled = getCookie('notificationSoundEnabled') === 'true';
    updateNotificationButtonUI(isSoundEnabled);

    // デバッグモード (HTMLに要素がないためコメントアウト)
    // if (getCookie('debugMode') === 'true') {
    //     if (debugInfoEl) debugInfoEl.classList.remove('d-none');
    // }

    // 背景色モードとユーザーカラー (HTMLに該当する要素が少ないため調整)
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

// ツールチップを破棄する関数
export function disposeTooltip(element) {
    const tooltipInstance = bootstrap.Tooltip.getInstance(element);
    if (tooltipInstance) {
        tooltipInstance.dispose();
    }
}

// ツールチップを表示する関数
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
 * 画像読み込みエラー時、またはphotoURLがない場合に頭文字アバターを表示します。
 * @param {string} displayUsername - 表示するユーザー名。
 */
export function handleImageError(displayUsername) {
    // avatarImgEl が存在しない場合はエラーをログに出力し、処理を中断
    if (!avatarImgEl || !avatarInitialsEl) {
        console.error('[ui-manager.js] handleImageError: avatarImgEl または avatarInitialsEl が見つかりません。');
        return;
    }

    const initial = displayUsername && typeof displayUsername === 'string' && displayUsername.length > 0
        ? displayUsername.charAt(0).toUpperCase()
        : '?'; // デフォルト値を 'A' から '?' に変更。

    avatarInitialsEl.textContent = initial; // 頭文字をセット
    avatarImgEl.style.display = 'none'; // 画像を非表示
    avatarInitialsEl.style.display = 'flex'; // 頭文字を表示
    console.log(`[ui-manager.js] 画像読み込みエラーまたはphotoURLなし: 頭文字 "${initial}" を表示。`);
}

/**
 * ユーザーのアバター表示（画像または頭文字）を更新します。
 * @param {string|null} photoURL - ユーザーのプロフィール画像のURL。
 * @param {string} displayUsername - ユーザーの表示名。
 */
export function updateUserAvatarDisplay(photoURL, displayUsername) {
    if (!avatarImgEl || !avatarInitialsEl) {
        console.error('[ui-manager.js] updateUserAvatarDisplay: avatarImgEl または avatarInitialsEl が見つかりません。');
        return;
    }

    if (photoURL && photoURL !== 'null') { // 'null'文字列のphotoURLも考慮
        const cleanedURL = cleanPhotoURL(photoURL);
        avatarImgEl.src = cleanedURL;
        avatarImgEl.onerror = () => handleImageError(displayUsername); // エラーハンドラを設定
        avatarImgEl.style.display = 'block'; // 画像を表示
        avatarInitialsEl.style.display = 'none'; // 頭文字を非表示
        console.log(`[ui-manager.js] アバター画像を更新: ${cleanedURL}`);
    } else {
        handleImageError(displayUsername); // photoURLがない場合は頭文字を表示
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
        console.warn('[ui-manager.js] loginModalEl が初期化されていません。モーダルを閉じられません。');
    }
}