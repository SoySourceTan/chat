// notifysound.js
let notificationSound = null;
let audioContext = null;
let hasUserInteracted = false;
let isNotificationSoundEnabled = true; // 新しく追加: 通知音の有効/無効状態
const isDebug = true;

// utils.js から showError をインポート
// import { showError } from './utils.js'; // utils.jsがnotifysound.jsと同じディレクトリにあると仮定
import { showError, showSuccess } from './utils.js'; // showSuccess を追加
// クッキー操作関数を notifysound.js 内に一時的に定義
function setCookieLocal(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/`;
    if (isDebug) console.log(`[notifysound.js] クッキー設定: ${name}=${value}`);
}

function getCookieLocal(name) {
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            const value = c.substring(nameEQ.length, c.length);
            if (isDebug) console.log(`[notifysound.js] クッキー取得: ${name}=${decodeURIComponent(value)}`);
            return decodeURIComponent(value);
        }
    }
    if (isDebug) console.log(`[notifysound.js] クッキー取得: ${name} なし`);
    return null;
}

// ユーザーインタラクションを検出するハンドラ
function handleUserInteraction() {
    if (isDebug) console.log('[notifysound.js] handleUserInteraction 呼び出し');
    if (!hasUserInteracted) {
        hasUserInteracted = true;
        setCookieLocal('hasUserInteracted', 'true', 365); // ユーザーインタラクションがあったことをクッキーに保存
        if (isDebug) console.log('[notifysound.js] ユーザーインタラクションを検出しました。');

        // AudioContextの再開を試みる
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                if (isDebug) console.log('[notifysound.js] AudioContext が再開されました。');
            }).catch(error => {
                console.error('[notifysound.js] AudioContext 再開エラー:', error);
                showError('オーディオの再生に問題が発生しました。');
            });
        }
    }
}

// ユーザーインタラクションイベントリスナーをセットアップ
document.addEventListener('mousedown', handleUserInteraction, { once: true });
document.addEventListener('keydown', handleUserInteraction, { once: true });
document.addEventListener('touchstart', handleUserInteraction, { once: true });
// スクロールでもインタラクションと見なす場合
document.addEventListener('scroll', handleUserInteraction, { once: true });

function initNotificationSound() {
    if (!notificationSound) { // notificationSound が未初期化の場合のみ実行
        try {
            if (isDebug) console.log('[notifysound.js] 通知音初期化開始');
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const audioUrl = isLocalhost ? '/learning/english-words/chat/notification.mp3' : '/chat/notification.mp3';
            if (isDebug) console.log('[notifysound.js] audioUrl=', audioUrl);
            notificationSound = new Audio(audioUrl); // notificationSound を初期化
            if (isDebug) console.log('[notifysound.js] Audioオブジェクト作成: src=', notificationSound.src, 'Object:', notificationSound);

            notificationSound.addEventListener('loadeddata', () => {
                if (isDebug) console.log('[notifysound.js] 通知音ファイルがロードされました。readyState:', notificationSound.readyState);
            });
            notificationSound.addEventListener('error', (e) => {
                console.error('[notifysound.js] 通知音ロードエラー:', e);
                showError('通知音ファイルの読み込みに失敗しました。');
            });

            // AudioContextの初期化
            if (!audioContext) {
                try {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    if (isDebug) console.log('[notifysound.js] AudioContext が初期化されました。状態:', audioContext.state);
                    const source = audioContext.createMediaElementSource(notificationSound);
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 1; // 音量、必要に応じて調整
                    source.connect(gainNode).connect(audioContext.destination);
                } catch (e) {
                    console.error('[notifysound.js] AudioContext 初期化エラー:', e);
                    showError('オーディオシステムの初期化に失敗しました。');
                }
            }

        } catch (error) {
            console.error('[notifysound.js] 通知音初期化エラー (try-catch):', error);
            showError('通知音の初期設定に失敗しました。');
        }
    } else {
        if (isDebug) console.log('[notifysound.js] notificationSoundは既に初期化されています。');
    }
}

// 通知音の有効/無効を切り替える関数
function toggleNotificationSound() {
    if (isDebug) console.log('[notifysound.js] toggleNotificationSound呼び出し。現在の状態:', isNotificationSoundEnabled);

    isNotificationSoundEnabled = !isNotificationSoundEnabled;
    setCookieLocal('notificationSoundEnabled', isNotificationSoundEnabled, 365); // 1年間クッキーに保存

    const toggleBtn = document.getElementById('notification-toggle-btn');
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        if (icon) {
            if (isDebug) console.log('[notifysound.js] アイコン要素:', icon);
            if (isNotificationSoundEnabled) {
                icon.classList.remove('fa-bell-slash');
                icon.classList.add('fa-bell');
                toggleBtn.classList.remove('btn-outline-secondary');
                toggleBtn.classList.add('btn-primary'); // ONの時は色を変えるなど
                if (isDebug) console.log('[notifysound.js] 通知音をONにしました。');
                // ONにした際に、まだインタラクションがない場合はインタラクション処理を試みる
                if (!hasUserInteracted) {
                    handleUserInteraction(); // Attempt to resume AudioContext if not already done
                }
            } else {
                icon.classList.remove('fa-bell');
                icon.classList.add('fa-bell-slash');
                toggleBtn.classList.remove('btn-primary');
                toggleBtn.classList.add('btn-outline-secondary'); // OFFの時は元の色に戻すなど
                if (isDebug) console.log('[notifysound.js] 通知音をOFFにしました。');
            }
        } else {
            console.warn('[notifysound.js] トグルボタン内にアイコン要素が見つかりませんでした。');
        }
    }
}

// 新しいトグルボタンのセットアップ関数
function setupInteractionButton() {
    // クッキーから hasUserInteracted の状態をロード
    const storedHasUserInteracted = getCookieLocal('hasUserInteracted');
    if (storedHasUserInteracted === 'true') {
        hasUserInteracted = true;
        if (isDebug) console.log('[notifysound.js] クッキーから hasUserInteracted=true をロードしました。');
    }

    // 修正案: ボタン要素の取得にtry-catchを追加し、より明確なログを出す
    let toggleBtn = null;
    try {
        toggleBtn = document.getElementById('notification-toggle-btn');
    } catch (e) {
        console.error('[notifysound.js] notification-toggle-btn 要素取得エラー:', e);
        showError('通知トグルボタンの初期化に失敗しました。');
    }

    if (isDebug) console.log('[notifysound.js] toggleBtn要素:', toggleBtn);

    if (toggleBtn) {
        // クッキーから通知音の有効状態をロードし、初期状態を設定
        const storedSoundEnabled = getCookieLocal('notificationSoundEnabled');
        if (storedSoundEnabled !== null) {
            isNotificationSoundEnabled = (storedSoundEnabled === 'true');
            if (isDebug) console.log('[notifysound.js] クッキーから isNotificationSoundEnabled=', isNotificationSoundEnabled, 'をロードしました。');
        } else {
            // クッキーにない場合はデフォルトの true を設定し、保存
            setCookieLocal('notificationSoundEnabled', true, 365);
        }

        // 初期表示の更新を現在のisNotificationSoundEnabledに基づいて行う
        const icon = toggleBtn.querySelector('i');
        if (icon) {
            if (isNotificationSoundEnabled) {
                icon.classList.remove('fa-bell-slash');
                icon.classList.add('fa-bell');
                toggleBtn.classList.remove('btn-outline-secondary');
                toggleBtn.classList.add('btn-primary');
            } else {
                icon.classList.remove('fa-bell');
                icon.classList.add('fa-bell-slash');
                toggleBtn.classList.remove('btn-primary');
                toggleBtn.classList.add('btn-outline-secondary');
            }
        }

        // イベントリスナーは一度だけ設定
        toggleBtn.addEventListener('click', () => {
            if (isDebug) console.log('[notifysound.js] 通知トグルボタンがクリックされました。');
            toggleNotificationSound(); // クリックで状態をトグル
            handleUserInteraction(); // クリックされたらインタラクションがあったとみなす
        });
        if (isDebug) console.log('[notifysound.js] 通知音トグルボタンにイベントリスナーを設定しました。');
    } else {
        console.warn('[notifysound.js] "notification-toggle-btn" 要素が見つかりませんでした。イベントリスナーを設定できませんでした。');
    }
}


export function notifyNewMessage({ title, body, iconUrl = null, url = null }) {
    if (isDebug) console.log('[notifysound.js] notifyNewMessage呼び出し');

    // ★修正: notificationSound が未初期化の場合、ここで初期化を試みる
    if (!notificationSound) {
        if (isDebug) console.log('[notifysound.js] notificationSoundが未初期化のため、initNotificationSoundを呼び出します。');
        initNotificationSound(); // ここでAudioオブジェクトとAudioContextを初期化
    }

    // 通知音が有効かつユーザーインタラクションがあった場合のみ再生を試みる
    if (isNotificationSoundEnabled && hasUserInteracted && notificationSound && notificationSound.readyState >= 2) {
        try {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    if (isDebug) console.log('[notifysound.js] AudioContext が再生前に再開されました。');
                    notificationSound.play().then(() => {
                        if (isDebug) console.log('[notifysound.js] 通知音再生成功');
                    }).catch(error => {
                        console.error('[notifysound.js] 通知音再生エラー (play):', error);
                        showError('通知音の再生に失敗しました。');
                    });
                }).catch(error => {
                    console.error('[notifysound.js] AudioContext 再開エラー (再生前):', error);
                    showError('オーディオの再生準備に失敗しました。');
                });
            } else {
                notificationSound.play().then(() => {
                    if (isDebug) console.log('[notifysound.js] 通知音再生成功');
                }).catch(error => {
                    console.error('[notifysound.js] 通知音再生エラー (play):', error);
                    showError('通知音の再生に失敗しました。');
                });
            }
        } catch (error) {
            console.error('[notifysound.js] 通知音再生エラー (try-catch):', error);
            showError('通知音の再生に失敗しました。');
        }
    } else {
        if (isDebug) console.log('[notifysound.js] 通知音再生スキップ: hasUserInteracted=', hasUserInteracted, 'notificationSound存在=', !!notificationSound, 'readyState=', notificationSound?.readyState, 'isNotificationSoundEnabled=', isNotificationSoundEnabled);
        if (!hasUserInteracted) {
             console.warn('[notifysound.js] 通知音を再生できませんでした: ユーザーインタラクションが不足しています。');
        } else if (!isNotificationSoundEnabled) {
            if (isDebug) console.log('[notifysound.js] 通知音は無効です。');
        } else {
             showError('通知音が準備できていません。');
        }
    }

    // Web Notifications APIを使用して通知を表示
    if (Notification.permission === 'granted') {
        const options = {
            body: body,
            icon: iconUrl || 'https://soysourcetan.github.io/chat/favicon.ico', // デフォルトアイコン
            data: { url: url || 'https://soysourcetan.github.io/chat/' }
        };
        const notification = new Notification(title, options);

        notification.onclick = function(event) {
            event.preventDefault(); // デフォルトの動作を防ぐ
            window.focus(); // 現在のタブにフォーカス
            if (notification.data && notification.data.url) {
                window.open(notification.data.url, '_blank'); // 新しいタブでURLを開く
            }
            notification.close();
        };
    } else {
        if (isDebug) console.log('[notifysound.js] 通知パーミッションが拒否されています。');
        // showError('デスクトップ通知の許可が必要です。'); // これは頻繁に出る可能性があるので、必要ならコメントアウト
    }
}

export function initNotify() {
    if (isDebug) console.log('[notifysound.js] initNotify 開始');
    initNotificationSound(); // Audioオブジェクトの準備
    setupInteractionButton(); // ボタンの作成とイベントリスナーの設定
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NEW_MESSAGE') {
            if (isDebug) console.log('[notifysound.js] サービスワーカーからメッセージ受信:', event.data);
            // 通知音が有効な場合にのみ通知を試みる
            if (isNotificationSoundEnabled) {
                notifyNewMessage({
                    title: event.data.title || '新しいメッセージ',
                    body: event.data.body || 'チャットに新着メッセージがあります。',
                    iconUrl: event.data.icon || null,
                    url: event.data.url || null
                });
            } else {
                if (isDebug) console.log('[notifysound.js] サービスワーカーからのメッセージに対して通知音は無効です。');
            }
        }
    });
}