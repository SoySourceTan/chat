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
// export let loginModalEl; // loginModalがHTMLに存在しないため削除
export let unameModalEl;


// UIの初期化
/**
 * UIのDOM要素を取得し、イベントリスナーを設定して初期化します。
 * @param {object} authInstance - Firebase Authインスタンス
 * @param {object} databaseInstance - Firebase Realtime Databaseインスタンス
 * @param {function} onLoginSuccessCallback - ログイン成功時のコールバック
 * @param {function} onLogoutSuccessCallback - ログアウト成功時のコールバック
 * @param {function} onNameUpdateSuccessCallback - ユーザー名更新成功時のコールバック
 * @param {function} onMessageSendCallback - メッセージ送信時のコールバック
 * @param {function} onDeleteMessageCallback - メッセージ削除時のコールバック
 * @param {function} onPushNotificationToggle - プッシュ通知トグル時のコールバック
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
    onPushNotificationToggle,
    onMessageLimitChange,
    onColorModeChange,
    onUserColorChange,
    onResetUserColor
) {
    // DOM要素の参照を取得
    formEl = document.getElementById('message-form');
    inputEl = document.getElementById('message-input');
    messagesEl = document.getElementById('messages');
    loginBtn = document.getElementById('loginBtn');
    errorAlert = document.getElementById('error-alert');
    onlineUsersCountEl = document.getElementById('online-users-count');
    onlineUsersListEl = document.getElementById('online-users-list');
    compactModeBtn = document.getElementById('compactModeBtn');
    fontSizeS = document.getElementById('fontSizeS');
    fontSizeM = document.getElementById('fontSizeM');
    fontSizeL = document.getElementById('fontSizeL');
    toggleEnterModeBtn = document.getElementById('toggleEnterModeBtn');
    newNameInput = document.getElementById('new-name-input');
    saveNameBtn = document.getElementById('saveNameBtn');
    logoutBtn = document.getElementById('logoutBtn');
    avatarEl = document.getElementById('avatar');
    currentUsernameEl = document.getElementById('current-username');
    userIdEl = document.getElementById('user-id-display');
    toggleDebugModeBtn = document.getElementById('toggleDebugModeBtn');
    debugInfoEl = document.getElementById('debug-info');
    versionInfoEl = document.getElementById('version-info');
    notificationToggle = document.getElementById('notificationToggle');
    pushNotificationSwitch = document.getElementById('pushNotificationSwitch');
    messageDisplayLimitSelect = document.getElementById('messageDisplayLimitSelect');
    loginDropdown = document.getElementById('loginDropdown');
    messageLoadingSpinner = document.querySelector('#loading-message-div .spinner-border');
    loadingMessageDiv = document.getElementById('loading-message-div');
    newMessageBtn = document.getElementById('newMessageBtn');
    userColorPreference = getCookie('colorAssignmentMode') || 'sequential';
    userColorPicker = document.getElementById('userColorOptions');
    resetUserColorBtn = document.getElementById('resetUserColorBtn');
    userColorDisplay = document.getElementById('user-color-display'); // 新しい要素

    // モーダル要素の取得と初期化
    // loginModalEl = new bootstrap.Modal(document.getElementById('loginModal')); // id="loginModal" がHTMLに存在しないためコメントアウトまたは削除
    unameModalEl = new bootstrap.Modal(document.getElementById('usernameModal'));

    // イベントリスナーの設定
    // ログイン関連
    document.getElementById('googleLoginBtn').addEventListener('click', () => onLoginSuccessCallback('google'));
    document.getElementById('twitterLoginBtn').addEventListener('click', () => onLoginSuccessCallback('twitter'));
    document.getElementById('anonymousLoginBtn').addEventListener('click', () => onLoginSuccessCallback('anonymous'));
    logoutBtn.addEventListener('click', onLogoutSuccessCallback);

    // メッセージ送信
    formEl.addEventListener('submit', onMessageSendCallback);

    // ユーザー名変更
    document.getElementById('editNameBtn').addEventListener('click', () => {
        const currentName = currentUsernameEl.textContent;
        newNameInput.value = currentName;
        unameModalEl.show();
    });
    saveNameBtn.addEventListener('click', () => {
        const newName = newNameInput.value.trim();
        if (newName) {
            onNameUpdateSuccessCallback(newName);
            unameModalEl.hide();
        } else {
            showError('ユーザー名を入力してください。');
        }
    });

    // メッセージ削除確認モーダル
    const deleteMessageModal = new bootstrap.Modal(document.getElementById('deleteMessageModal'));
    let messageToDeleteId = null; // 削除対象のメッセージIDを保持する変数

    messagesEl.addEventListener('click', (event) => {
        const deleteButton = event.target.closest('.delete-message-btn');
        if (deleteButton) {
            messageToDeleteId = deleteButton.dataset.messageId;
            deleteMessageModal.show();
        }
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        if (messageToDeleteId) {
            onDeleteMessageCallback(messageToDeleteId);
            messageToDeleteId = null; // リセット
            deleteMessageModal.hide();
        }
    });

    // 設定関連
    compactModeBtn.addEventListener('click', () => {
        document.body.classList.toggle('compact-mode');
        const isCompact = document.body.classList.contains('compact-mode');
        setCookie('compactMode', isCompact ? 'true' : 'false', 365);
        showSuccess(`コンパクトモードを${isCompact ? '有効' : '無効'}にしました。`);
    });

    fontSizeS.addEventListener('click', () => setFontSize('small'));
    fontSizeM.addEventListener('click', () => setFontSize('medium'));
    fontSizeL.addEventListener('click', () => setFontSize('large'));

    toggleEnterModeBtn.addEventListener('click', () => {
        const currentMode = getCookie('enterSendMode') === 'true';
        setCookie('enterSendMode', !currentMode ? 'true' : 'false', 365);
        showSuccess(`Enterで送信モードを${!currentMode ? '有効' : '無効'}にしました。`);
    });

    notificationToggle.addEventListener('change', (event) => {
        const isEnabled = event.target.checked;
        setCookie('notificationSoundEnabled', isEnabled ? 'true' : 'false', 365);
        initNotify(); // 設定を反映するために再初期化
        showSuccess(`通知音を${isEnabled ? '有効' : '無効'}にしました。`);
    });

    pushNotificationSwitch.addEventListener('change', (event) => {
        onPushNotificationToggle(event.target.checked);
    });

    messageDisplayLimitSelect.addEventListener('change', (event) => {
        onMessageLimitChange(parseInt(event.target.value, 10));
    });

    document.getElementById('colorModeSequential').addEventListener('click', () => onColorModeChange('sequential'));
    document.getElementById('colorModeRandom').addEventListener('click', () => onColorModeChange('random'));
    document.getElementById('colorModeManual').addEventListener('click', () => {
        onColorModeChange('user-selected');
        document.getElementById('userColorPickerContainer').classList.remove('d-none');
    });

    // ユーザーメッセージ色選択
    userColorPicker.addEventListener('click', (event) => {
        const colorOption = event.target.closest('.color-option');
        if (colorOption) {
            const selectedColor = colorOption.dataset.colorClass;
            onUserColorChange(selectedColor);
            // 選択状態のUIを更新
            userColorPicker.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
            colorOption.classList.add('selected');
        }
    });

    resetUserColorBtn.addEventListener('click', () => onResetUserColor());


    // デバッグモードトグル
    toggleDebugModeBtn.addEventListener('click', () => {
        debugInfoEl.classList.toggle('d-none');
        const isDebugMode = !debugInfoEl.classList.contains('d-none');
        setCookie('debugMode', isDebugMode ? 'true' : 'false', 365);
        showSuccess(`デバッグモードを${isDebugMode ? '有効' : '無効'}にしました。`);
    });


    // 初期状態の適用
    applyInitialSettings();
}

/**
 * フォントサイズを設定し、クッキーに保存します。
 * @param {string} size - 'small', 'medium', 'large'
 */
function setFontSize(size) {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add(`font-${size}`);
    setCookie('fontSize', size, 365);
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
    // Enterで送信モード
    if (getCookie('enterSendMode') === 'true') {
        // 特にUI変更は不要だが、script.jsでこの設定が使われる
    }
    // 通知音
    if (getCookie('notificationSoundEnabled') === 'true') {
        notificationToggle.checked = true;
    } else {
        notificationToggle.checked = false;
    }
    // プッシュ通知はFCM初期化時に別途処理
    if (getCookie('pushNotificationEnabled') === 'true') {
        pushNotificationSwitch.checked = true;
    } else {
        pushNotificationSwitch.checked = false;
    }

    // メッセージ表示数
    const savedMessageLimit = getCookie('messageDisplayLimit');
    if (savedMessageLimit) {
        messageDisplayLimitSelect.value = savedMessageLimit;
    }

    // デバッグモード
    if (getCookie('debugMode') === 'true') {
        debugInfoEl.classList.remove('d-none');
    }

    // 背景色モードとユーザーカラー
    const savedColorMode = getCookie('colorAssignmentMode');
    if (savedColorMode) {
        userColorPreference = savedColorMode;
        if (savedColorMode === 'user-selected') {
            document.getElementById('userColorPickerContainer').classList.remove('d-none');
        }
    }
    // ユーザーカラーオプションの動的生成
    const colors = [
        'var(--bs-message-pink)', 'var(--bs-message-lime)', 'var(--bs-message-lilac)',
        'var(--bs-message-lavender)', 'var(--bs-message-aqua)', 'var(--bs-message-mint)',
        'var(--bs-message-yellow)', 'var(--bs-message-green)', 'var(--bs-message-cyan)',
        'var(--bs-message-purple)'
    ];
    const colorClassNames = [
        'bg-user-0', 'bg-user-1', 'bg-user-2', 'bg-user-3', 'bg-user-4',
        'bg-user-5', 'bg-user-6', 'bg-user-7', 'bg-user-8', 'bg-user-9'
    ];
    userColorPicker.innerHTML = ''; // 既存のオプションをクリア
    colors.forEach((color, index) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;
        colorOption.dataset.colorClass = colorClassNames[index];
        userColorPicker.appendChild(colorOption);
    });
}


/**
 * ステータスインジケーターの表示を更新します。
 * @param {string} status - 'online' または 'offline'
 */
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
        console.error('handleImageErrorエラー:', error);
    }
}
