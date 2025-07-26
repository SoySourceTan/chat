// notifysound.js
// ★修正: isDebugの定義を最上位に移動
const isDebug = true; // debugフラグをファイルの先頭で定義

// 必要なモジュールをインポート
import { showError, showToast } from './utils.js';

let notificationSound = null;
let audioContext;
let hasUserInteracted = false;
// クッキーから初期状態を読み込む。クッキーがなければ 'true' (ON) をデフォルトとする。
let isNotificationSoundEnabled = getCookieLocal('notificationSoundEnabled') === 'false' ? false : true;

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
            try {
                return decodeURIComponent(value);
            } catch (e) {
                console.error(`[notifysound.js] クッキーのデコードエラー: ${e}`);
                return value;
            }
        }
    }
    return null;
}

// ユーザーインタラクションを検出する関数
function handleUserInteraction() {
    if (!hasUserInteracted) {
        hasUserInteracted = true;
        setCookieLocal('hasUserInteracted', 'true', 365); // ユーザーインタラクションをクッキーに保存
        if (isDebug) console.log('[notifysound.js] ユーザーインタラクションを検出しました。');
        // AudioContextが中断されている場合、ここで再開を試みる
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                if (isDebug) console.log('[notifysound.js] AudioContextが再開されました。');
            }).catch(error => {
                console.error('[notifysound.js] AudioContextの再開エラー:', error);
            });
        }
    }
}

// ユーザーインタラクションイベントリスナー
['click', 'keydown', 'touchstart'].forEach(eventType => {
    document.addEventListener(eventType, handleUserInteraction, { once: true });
});


// Audioオブジェクトを初期化し、ロードを待つPromiseを返す
async function initNotificationSound() {
    if (notificationSound) {
        if (isDebug) console.log('[notifysound.js] notificationSoundは既に存在します。');
        // 既にロード済みであれば、即座に解決するPromiseを返す
        if (notificationSound.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            return Promise.resolve();
        }
    }

    if (isDebug) console.log('[notifysound.js] 通知音初期化開始');
    const audioUrl = getBasePath() + 'notification.mp3'; // notification.mp3のパス
    notificationSound = new Audio(audioUrl);
    notificationSound.preload = 'auto'; // プリロード設定
    notificationSound.volume = 0.5; // 音量設定 (任意)

    if (isDebug) console.log(`[notifysound.js] Audioオブジェクト作成: src= ${audioUrl} Object:`, notificationSound);

    // AudioContextの初期化
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (isDebug) console.log('[notifysound.js] AudioContext が初期化されました。状態:', audioContext.state);
        } catch (e) {
            console.error('[notifysound.js] AudioContextの初期化に失敗しました:', e);
            showError('通知音の再生に必要なオーディオ機能が利用できません。');
            return Promise.reject(new Error('AudioContext not available'));
        }
    }

    return new Promise((resolve, reject) => {
        const onCanPlayThrough = () => {
            if (isDebug) console.log('[notifysound.js] 通知音ファイルがロードされ、再生可能です。readyState:', notificationSound.readyState);
            notificationSound.removeEventListener('canplaythrough', onCanPlayThrough);
            notificationSound.removeEventListener('error', onError);
            resolve();
        };

        const onError = (e) => {
            console.error('[notifysound.js] 通知音のロードエラー:', e);
            notificationSound.removeEventListener('canplaythrough', onCanPlayThrough);
            notificationSound.removeEventListener('error', onError);
            showError('通知音ファイルの読み込みに失敗しました。');
            reject(new Error('Audio file load error'));
        };

        notificationSound.addEventListener('canplaythrough', onCanPlayThrough);
        notificationSound.addEventListener('error', onError);

        // ロードをトリガーするためにロードを試みる
        // Chromeなどの一部ブラウザでは、ユーザーインタラクションなしにload()を呼び出すとエラーになる場合があるため、
        // AudioContextのresumeと合わせて考慮する必要がある。
        // ただし、preload="auto" があれば通常は自動でロードが始まる。
        // ここでは明示的にload()を呼び出す必要はないが、もしロードが始まらない場合は検討する。
        // notificationSound.load(); 
    });
}

// 通知音を再生する関数
export async function notifyNewMessage({ title, body, iconUrl = `${getBasePath()}images/icon.png` }) {
    if (isDebug) console.log('[notifysound.js] notifyNewMessage呼び出し');

    if (!isNotificationSoundEnabled) {
        if (isDebug) console.log('[notifysound.js] 通知音は無効です。');
        return;
    }

    // notificationSoundが未初期化の場合、初期化を待つ
    if (!notificationSound || notificationSound.readyState < 2) {
        if (isDebug) console.log('[notifysound.js] notificationSoundが未初期化のため、initNotificationSoundを呼び出します。');
        try {
            await initNotificationSound();
        } catch (error) {
            console.error('[notifysound.js] 通知音の初期化に失敗しました:', error);
            showError('通知音の準備中にエラーが発生しました。');
            return;
        }
    }

    if (hasUserInteracted && notificationSound && notificationSound.readyState >= 2) {
        notificationSound.play().then(() => {
            if (isDebug) console.log('[notifysound.js] 通知音再生成功 (internal)');
        }).catch(error => {
            console.error('[notifysound.js] 通知音再生エラー (internal play):', error);
            showError('通知音の再生に失敗しました。');
        });
    } else {
        if (isDebug) console.warn(`[notifysound.js] 内部通知音再生スキップ: hasUserInteracted=${hasUserInteracted}, notificationSound存在=${!!notificationSound}, readyState=${notificationSound?.readyState}, isNotificationSoundEnabled=${isNotificationSoundEnabled}`);
        // showError('通知音が準備できていません。'); // これをコメントアウトまたは削除して、ユーザーに不必要なアラートを出さない
    }
}

// ベースパスを取得するヘルパー関数
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
    return '/chat/'; // For deployed versions (GitHub Pages, trextacy.com)
}

export function initNotify() {
    if (isDebug) console.log('[notifysound.js] initNotify 開始');
    // initNotificationSound(); // Audioオブジェクトの準備 - ここでは呼び出さない（notifyNewMessageで必要に応じて呼び出す）
    setupInteractionButton(); // ボタンの作成とイベントリスナーの設定
}

// 通知音の有効/無効を切り替えるボタンのセットアップ
function setupInteractionButton() {
    const notificationToggleBtn = document.getElementById('notification-toggle-btn');
    if (notificationToggleBtn) {
        updateNotificationToggleButtonUI(isNotificationSoundEnabled); // 初期UI設定

        notificationToggleBtn.addEventListener('click', () => {
            isNotificationSoundEnabled = !isNotificationSoundEnabled;
            setCookieLocal('notificationSoundEnabled', isNotificationSoundEnabled.toString(), 365);
            updateNotificationToggleButtonUI(isNotificationSoundEnabled);
            showToast(`通知音を${isNotificationSoundEnabled ? '有効' : '無効'}にしました。`);
            if (isDebug) console.log(`[notifysound.js] 通知音設定変更: ${isNotificationSoundEnabled ? '有効' : '無効'}`);

            // 通知音を有効にした場合、AudioContextの再開を試みる
            if (isNotificationSoundEnabled && audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    if (isDebug) console.log('[notifysound.js] AudioContextが再開されました (トグルボタン経由)。');
                }).catch(error => {
                    console.error('[notifysound.js] AudioContextの再開エラー (トグルボタン経由):', error);
                });
            }
        });
    } else {
        console.warn('[notifysound.js] notification-toggle-btn要素が見つかりませんでした。');
    }
}

// 通知音トグルボタンのUIを更新する関数
function updateNotificationToggleButtonUI(enabled) {
    const notificationToggleBtn = document.getElementById('notification-toggle-btn');
    if (notificationToggleBtn) {
        if (enabled) {
            notificationToggleBtn.classList.remove('btn-outline-primary');
            notificationToggleBtn.classList.add('btn-primary');
            notificationToggleBtn.innerHTML = '<i class="fas fa-bell"></i>';
            notificationToggleBtn.title = '通知音を無効にする';
        } else {
            notificationToggleBtn.classList.remove('btn-primary');
            notificationToggleBtn.classList.add('btn-outline-primary');
            notificationToggleBtn.innerHTML = '<i class="fas fa-bell-slash"></i>';
            notificationToggleBtn.title = '通知音を有効にする';
        }
    }
}


// Service Workerからのメッセージを受信した際の処理
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NEW_MESSAGE') {
            if (isDebug) console.log('[notifysound.js] サービスワーカーからメッセージ受信:', event.data);
            // 通知音が有効な場合にのみ通知を試みる
            if (isNotificationSoundEnabled) {
                notifyNewMessage({
                    title: event.data.title || '新しいメッセージ',
                    body: event.data.body || 'チャットに新着メッセージがあります。',
                    iconUrl: event.data.iconUrl || `${getBasePath()}images/icon.png`
                });
            } else {
                if (isDebug) console.log('[notifysound.js] 通知音は無効のため、サービスワーカーからのメッセージに対して音を鳴らしません。');
            }
        }
    });
}
