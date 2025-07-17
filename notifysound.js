let notificationSound = null;
let audioContext = null;
let hasUserInteracted = false;
const isDebug = true;

function showError(message) {
    const errorAlert = document.getElementById('error-alert');
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.classList.remove('d-none');
        errorAlert.setAttribute('role', 'alert');
        setTimeout(() => {
            errorAlert.classList.add('d-none');
            errorAlert.removeAttribute('role');
        }, 6000);
    } else {
        console.warn('[notifysound.js] エラーアラート要素が見つかりません');
    }
}

function initNotificationSound() {
    if (!notificationSound) {
        try {
            if (isDebug) console.log('[notifysound.js] 通知音初期化開始');
            const isLocalhost = window.location.hostname === 'localhost';
            const audioUrl = isLocalhost ? '/learning/english-words/chat/notification.mp3' : '/chat/notification.mp3';
            if (isDebug) console.log('[notifysound.js] audioUrl=', audioUrl);
            notificationSound = new Audio(audioUrl);
            if (isDebug) console.log('[notifysound.js] Audioオブジェクト作成: src=', notificationSound.src);
            notificationSound.load();
            if (isDebug) console.log('[notifysound.js] 通知音ロード開始');
            notificationSound.addEventListener('loadeddata', () => {
                if (isDebug) console.log('[notifysound.js] 通知音ロード完了: readyState=', notificationSound.readyState);
            });
            notificationSound.addEventListener('error', (error) => {
                console.error('[notifysound.js] 通知音ロードエラー:', error);
                notificationSound = null;
                showError('通知音のロードに失敗しました。');
            });
        } catch (error) {
            console.error('[notifysound.js] 通知音の初期化エラー:', error);
            notificationSound = null;
            showError('通知音の初期化に失敗しました。');
        }
    }
}

function initAudioContext() {
    if (isDebug) console.log('[notifysound.js] AudioContext初期化開始');
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                if (isDebug) console.log('[notifysound.js] AudioContextがsuspended状態');
            } else {
                if (isDebug) console.log('[notifysound.js] AudioContext既に実行中');
            }
        } catch (error) {
            console.error('[notifysound.js] AudioContext初期化エラー:', error);
            showError('音声コンテキストの初期化に失敗しました。');
        }
    }
}

function handleUserInteraction() {
    if (!hasUserInteracted && audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            if (isDebug) console.log('[notifysound.js] AudioContext 再開成功');
            hasUserInteracted = true;
            if (notificationSound && notificationSound.readyState >= 2) {
                notificationSound.play().then(() => {
                    if (isDebug) console.log('[notifysound.js] テスト再生成功');
                    notificationSound.currentTime = 0;
                }).catch(error => {
                    console.error('[notifysound.js] テスト再生エラー:', error);
                    showError('通知音のテスト再生に失敗しました。');
                });
            }
            const interactionButton = document.getElementById('interaction-button');
            if (interactionButton) interactionButton.classList.add('d-none');
        }).catch(error => {
            console.error('[notifysound.js] AudioContext 再開エラー:', error);
            showError('音声の有効化に失敗しました。もう一度クリックしてください。');
        });
    }
}

function setupInteractionButton() {
    const interactionButton = document.createElement('button');
    interactionButton.id = 'interaction-button';
    interactionButton.className = 'btn btn-primary position-fixed top-0 start-0 m-3';
    interactionButton.textContent = '通知音を有効にするためにクリック';
    interactionButton.style.zIndex = '1000';
    document.body.appendChild(interactionButton);
    interactionButton.addEventListener('click', handleUserInteraction);
    document.addEventListener('click', handleUserInteraction, { once: true });
}

export function notifyNewMessage({ title = '新しいメッセージ', body = '', messageId = '', userId = '', timestamp = '', username = '匿名' }) {
    if (isDebug) console.log('[notifysound.js] notifyNewMessage 呼び出し:', { title, body, messageId, userId, timestamp, username });
    try {
        if (hasUserInteracted && notificationSound && notificationSound.readyState >= 2) {
            if (isDebug) console.log('[notifysound.js] 通知音再生試行: readyState=', notificationSound.readyState);
            notificationSound.play().then(() => {
                if (isDebug) console.log('[notifysound.js] 通知音を再生');
                notificationSound.currentTime = 0;
            }).catch(error => {
                console.error('[notifysound.js] 通知音再生エラー:', error);
                showError('通知音の再生に失敗しました。ブラウザの通知設定を確認してください。');
            });
        } else {
            if (isDebug) console.log('[notifysound.js] 通知音スキップ: hasUserInteracted=', hasUserInteracted, 'notificationSound=', !!notificationSound, 'readyState=', notificationSound?.readyState);
            if (!hasUserInteracted) {
                showError('通知音を有効にするには、ページをクリックしてください。');
            } else {
                showError('通知音が準備できていません。');
            }
        }
    } catch (error) {
        console.error('[notifysound.js] 通知音再生エラー:', error);
        showError('通知音の再生に失敗しました。');
    }
}

export function initNotify() {
    if (isDebug) console.log('[notifysound.js] initNotify 開始');
    initNotificationSound();
    initAudioContext();
    setupInteractionButton();
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NEW_MESSAGE') {
            if (isDebug) console.log('[notifysound.js] サービスワーカーからメッセージ受信:', event.data);
            notifyNewMessage({
                title: event.data.title || '新しいメッセージ',
                body: event.data.body,
                messageId: event.data.messageId,
                userId: event.data.userId || '',
                timestamp: event.data.timestamp || '',
                username: event.data.username || '匿名'
            });
        }
    });
}