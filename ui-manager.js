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
// export let notificationToggle; // HTMLに存在しないため削除またはコメントアウト
// export let pushNotificationSwitch; // HTMLに存在しないため削除またはコメントアウト
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
export let notificationButton; // ★変更: notificationToggle の代わりに notificationButton を追加

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
    // onPushNotificationToggle, // HTMLに該当要素がないため引数から削除
    onMessageLimitChange,
    onColorModeChange,
    onUserColorChange,
    onResetUserColor
) {
    // DOM要素の参照を取得
    formEl = document.getElementById('messageForm'); // HTMLのIDは messageForm でした
    inputEl = document.getElementById('m'); // HTMLのIDは m でした
    messagesEl = document.getElementById('messages');
    loginBtn = document.getElementById('login-btn'); // HTMLのIDは login-btn でした
    errorAlert = document.getElementById('error-alert');
    onlineUsersCountEl = document.getElementById('online-users-count'); // HTMLにはonline-users-countがないが、online-usersはある
    onlineUsersListEl = document.getElementById('online-users-list'); // HTMLには存在しない
    compactModeBtn = document.getElementById('compactModeBtn');
    fontSizeS = document.getElementById('fontSizeS');
    fontSizeM = document.getElementById('fontSizeM');
    fontSizeL = document.getElementById('fontSizeL');
    toggleEnterModeBtn = document.getElementById('toggleModeBtn'); // HTMLのIDは toggleModeBtn でした
    newNameInput = document.getElementById('uname'); // HTMLのIDは uname でした
    saveNameBtn = document.getElementById('confirmName'); // HTMLのIDは confirmName でした
    logoutBtn = document.getElementById('signOut'); // HTMLのIDは signOut でした
    avatarEl = document.querySelector('.profile-img-small'); // HTMLのavatarはprofile-img-smallクラスを持つimg
    currentUsernameEl = document.getElementById('current-username-display'); // HTMLのIDは current-username-display でした
    userIdEl = document.getElementById('user-id-display'); // HTMLには存在しない
    toggleDebugModeBtn = document.getElementById('toggleDebugModeBtn'); // HTMLには存在しない
    debugInfoEl = document.getElementById('debug-info'); // HTMLには存在しない
    notificationButton = document.getElementById('notification-toggle-btn'); // ★変更: ここで正しいIDを参照
    // notificationToggle = document.getElementById('notificationToggle'); // 削除またはコメントアウト
    // pushNotificationSwitch = document.getElementById('pushNotificationSwitch'); // HTMLに存在しないため削除またはコメントアウト
    messageDisplayLimitSelect = document.getElementById('messageDisplayLimitSelect'); // HTMLには存在しない
    loginDropdown = document.getElementById('loginDropdown'); // HTMLには存在しない
    messageLoadingSpinner = document.querySelector('#loading-message-div .spinner-border'); // HTMLには存在しない
    loadingMessageDiv = document.getElementById('loading-message-div'); // HTMLには存在しない
    newMessageBtn = document.getElementById('newMessageBtn');

    // colorPicker の select 要素を取得
    userColorPicker = document.getElementById('userColorSelect'); // userColorOptions の代わりに userColorSelect を参照
    resetUserColorBtn = document.getElementById('resetUserColorBtn'); // HTMLには存在しない
    userColorDisplay = document.getElementById('user-color-display'); // HTMLには存在しない

    // モーダル要素の取得と初期化
    // loginModalEl = new bootstrap.Modal(document.getElementById('loginModal')); // id="loginModal" はHTMLに存在するが、変数に export されていないためコメントアウト
    unameModalEl = new bootstrap.Modal(document.getElementById('unameModal')); // HTMLのIDは unameModal でした

    // イベントリスナーの設定
    // ログイン関連
    // HTMLには id="googleLoginBtn", "twitterLoginBtn", "anonymousLoginBtn" はなく、
    // それぞれ "googleLogin", "twitterLogin", "anonymousLogin" があります。
    // loginBtn は id="login-btn" です。
    // 適切なIDに修正
    document.getElementById('googleLogin').addEventListener('click', () => onLoginSuccessCallback('google'));
    document.getElementById('twitterLogin').addEventListener('click', () => onLoginSuccessCallback('twitter'));
    document.getElementById('anonymousLogin').addEventListener('click', () => onLoginSuccessCallback('anonymous'));
    
    if (logoutBtn) { // logoutBtn が取得できた場合のみイベントリスナーを設定
        logoutBtn.addEventListener('click', onLogoutSuccessCallback);
    } else {
        console.warn('[ui-manager.js] logoutBtn 要素が見つかりませんでした。');
    }

    if (formEl) { // formEl が取得できた場合のみイベントリスナーを設定
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

            console.log('[ui-manager.js] ユーザー名更新処理開始。onNameUpdateSuccessCallbackを呼び出します。'); // ★追加
            try {
                await onNameUpdateSuccessCallback(newUsername);
                console.log('[ui-manager.js] onNameUpdateSuccessCallbackが完了しました。モーダルを非表示にします。'); // ★追加
                if (unameModalEl) {
                    console.log('[ui-manager.js] unameModalElが存在します。hide()を呼び出します。', unameModalEl); // ★追加
                    unameModalEl.hide();
                    console.log('[ui-manager.js] unameModalEl.hide()が呼び出されました。'); // ★追加
                } else {
                    console.warn('[ui-manager.js] unameModalEl が見つかりません。モーダルを閉じられません。'); // ★追加
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
    // HTMLには id="deleteMessageModal" はなく、deleteConfirmModal があります。
    const deleteMessageModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    let messageToDeleteId = null; // 削除対象のメッセージIDを保持する変数

    if (messagesEl) { // messagesEl が取得できた場合のみイベントリスナーを設定
        messagesEl.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('.delete-message'); // HTMLのクラスは delete-message でした
            if (deleteButton) {
                messageToDeleteId = deleteButton.dataset.messageId;
                deleteMessageModal.show();
            }
        });
    } else {
        console.warn('[ui-manager.js] messages 要素が見つかりませんでした。');
    }

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) { // confirmDeleteBtn が取得できた場合のみイベントリスナーを設定
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
    if (compactModeBtn) { // compactModeBtn が取得できた場合のみイベントリスナーを設定
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


    if (toggleEnterModeBtn) { // toggleEnterModeBtn が取得できた場合のみイベントリスナーを設定
        toggleEnterModeBtn.addEventListener('click', () => {
            const currentMode = getCookie('enterSendMode') === 'true';
            setCookie('enterSendMode', !currentMode ? 'true' : 'false', 365);
            showSuccess(`Enterで送信モードを${!currentMode ? '有効' : '無効'}にしました。`);
        });
    } else {
        console.warn('[ui-manager.js] toggleModeBtn (EnterMode) 要素が見つかりませんでした。');
    }

    // pushNotificationSwitch はHTMLにないので、関連するイベントリスナーもコメントアウト
    // if (pushNotificationSwitch) {
    //     pushNotificationSwitch.addEventListener('change', (event) => {
    //         onPushNotificationToggle(event.target.checked);
    //     });
    // } else {
    //      console.warn('[ui-manager.js] pushNotificationSwitch 要素が見つかりませんでした。');
    // }

    // messageDisplayLimitSelect はHTMLにないので、関連するイベントリスナーもコメントアウト
    // if (messageDisplayLimitSelect) {
    //     messageDisplayLimitSelect.addEventListener('change', (event) => {
    //         onMessageLimitChange(parseInt(event.target.value, 10));
    //     });
    // } else {
    //      console.warn('[ui-manager.js] messageDisplayLimitSelect 要素が見つかりませんでした。');
    // }
    
    // colorModeSequential, colorModeRandom, userColorPickerContainer, userColorPicker はHTMLに存在しない
    // HTMLのid="userColorSelect" を利用
    const userColorSelect = document.getElementById('userColorSelect');
    if (userColorSelect) {
        // 現在のHTML構造に合わせてイベントリスナーを調整
        userColorSelect.addEventListener('change', (event) => {
            const selectedColorClass = event.target.value;
            // '色' オプションが選択された場合は処理しない
            if (selectedColorClass === '色') {
                showToast('メッセージの色を選択してください。', 'info');
                return;
            }
            onUserColorChange(selectedColorClass);
            // 選択状態のUI更新はselect要素なので不要
        });
    } else {
        console.warn('[ui-manager.js] userColorSelect 要素が見つかりませんでした。');
    }
    
    // resetUserColorBtn はHTMLに存在しない
    // if (resetUserColorBtn) {
    //     resetUserColorBtn.addEventListener('click', () => onResetUserColor());
    // } else {
    //     console.warn('[ui-manager.js] resetUserColorBtn 要素が見つかりませんでした。');
    // }


    // デバッグモードトグル
    if (toggleDebugModeBtn && debugInfoEl) { // 両方の要素が存在する場合のみイベントリスナーを設定
        toggleDebugModeBtn.addEventListener('click', () => {
            debugInfoEl.classList.toggle('d-none');
            const isDebugMode = !debugInfoEl.classList.contains('d-none');
            setCookie('debugMode', isDebugMode ? 'true' : 'false', 365);
            showSuccess(`デバッグモードを${isDebugMode ? '有効' : '無効'}にしました。`);
        });
    } else {
        console.warn('[ui-manager.js] toggleDebugModeBtn または debugInfoEl 要素が見つかりませんでした。');
    }


    // 初期状態の適用
    applyInitialSettings();
}

/**
 * フォントサイズを設定し、クッキーに保存します。
 * @param {string} size - 'small', 'medium', 'large'
 */
function setFontSize(size) {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    // messagesEl のフォントサイズクラスを更新
    if (messagesEl) {
        messagesEl.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        messagesEl.classList.add(`font-size-${size}`); // HTMLのmessages要素のクラスは font-size-medium
    }
    setCookie('fontSize', size, 365);
    // アクティブボタンの更新 (HTMLの .btn-group)
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
    // Enterで送信モード
    // toggleEnterModeBtn のUIはここでは更新しない。必要であれば script.js で処理。
    if (getCookie('enterSendMode') === 'true') {
        // ここでは特にUI変更は不要だが、script.jsでこの設定が使われる
    }
    
    // ★ここから修正: 通知音の初期状態をUIに適用
    const isSoundEnabled = getCookie('notificationSoundEnabled') === 'true';
    updateNotificationButtonUI(isSoundEnabled); // ボタンのUIを初期化

    // プッシュ通知はFCM初期化時に別途処理 (HTMLに要素がないためコメントアウト)
    // if (getCookie('pushNotificationEnabled') === 'true') {
    //     if (pushNotificationSwitch) pushNotificationSwitch.checked = true;
    // } else {
    //     if (pushNotificationSwitch) pushNotificationSwitch.checked = false;
    // }

    // メッセージ表示数 (HTMLに要素がないためコメントアウト)
    // const savedMessageLimit = getCookie('messageDisplayLimit');
    // if (savedMessageLimit) {
    //     if (messageDisplayLimitSelect) messageDisplayLimitSelect.value = savedMessageLimit;
    // }

    // デバッグモード
    if (getCookie('debugMode') === 'true') {
        if (debugInfoEl) debugInfoEl.classList.remove('d-none');
    }

    // 背景色モードとユーザーカラー (HTMLに該当する要素が少ないため調整)
    const savedColorMode = getCookie('colorAssignmentMode');
    if (savedColorMode) {
        userColorPreference = savedColorMode;
        // HTMLに userColorPickerContainer がないので、関連する処理はコメントアウト
        // if (savedColorMode === 'user-selected') {
        //     document.getElementById('userColorPickerContainer').classList.remove('d-none');
        // }
    }
    // ユーザーカラーオプションの動的生成は HTMLの <select> になったため、不要。
    // 代わりに、userColorSelect の選択状態を設定する必要がある場合ここにロジックを追加。
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
    // HTMLには id="status-indicator" はなく、status-dot というクラスがあります。
    const statusDot = document.querySelector('.status-dot');
    if (statusDot) {
        statusDot.classList.remove('status-online', 'status-away'); // 既存のステータスクラスを削除
        statusDot.classList.add(`status-${status}`);
        // HTMLに title 属性を付与する要素がないため、ここでは特に何も行いません。
        // 必要であれば、親要素（status-infoなど）にtitleを付与することを検討してください。
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

/**
 * 通知音トグルボタンのUIを更新します。
 * @param {boolean} isEnabled - 通知音が有効な場合は true、無効な場合は false。
 */
export function updateNotificationButtonUI(isEnabled) {
    if (notificationButton) { // ui-manager.js の export let notificationButton を参照
        const icon = notificationButton.querySelector('i.fas');
        if (icon) {
            if (isEnabled) {
                icon.classList.remove('fa-bell-slash');
                icon.classList.add('fa-bell');
                notificationButton.setAttribute('aria-label', '通知音を無効にする');
                notificationButton.classList.remove('btn-outline-secondary'); // 必要に応じてスタイルを変更
                notificationButton.classList.add('btn-primary');
            } else {
                icon.classList.remove('fa-bell');
                icon.classList.add('fa-bell-slash');
                notificationButton.setAttribute('aria-label', '通知音を有効にする');
                notificationButton.classList.remove('btn-primary'); // 必要に応じてスタイルを変更
                notificationButton.classList.add('btn-outline-secondary');
            }
        }
    } else {
        console.warn('[ui-manager.js] updateNotificationButtonUI: notificationButton 要素が見つかりません。');
    }
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