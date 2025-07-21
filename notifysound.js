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
            
            // 音声ファイルのロード状況をログで追跡
            notificationSound.addEventListener('loadeddata', () => {
                if (isDebug) console.log('[notifysound.js] 通知音ロード完了: readyState=', notificationSound.readyState);
            });
            notificationSound.addEventListener('error', (error) => {
                console.error('[notifysound.js] 通知音ロードエラー:', error);
                notificationSound = null;
                showError('通知音のロードに失敗しました。');
            });
            notificationSound.load(); // ロードを開始
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
    const interactionButton = document.getElementById('interaction-button');

    // 既にインタラクト済みの場合や、AudioContextが既にactive状態の場合は、ボタンを非表示にして終了
    if (hasUserInteracted || !audioContext || audioContext.state !== 'suspended') {
        if (isDebug) {
            if (hasUserInteracted) console.log('[notifysound.js] handleUserInteraction: 既にインタラクト済み。');
            else if (!audioContext) console.log('[notifysound.js] handleUserInteraction: AudioContextが未初期化。');
            else console.log('[notifysound.js] handleUserInteraction: AudioContextはsuspended状態ではない (state: ' + audioContext.state + ')。');
        }
        if (interactionButton) interactionButton.classList.add('d-none');
        return;
    }

    // AudioContextの再開を試みる
    audioContext.resume().then(() => {
        if (isDebug) console.log('[notifysound.js] AudioContext 再開成功');
        hasUserInteracted = true; // 成功時にフラグを立てる

        // テスト再生（AudioContext再開後のみ）
        if (notificationSound && notificationSound.readyState >= 2) {
            notificationSound.play().then(() => {
                if (isDebug) console.log('[notifysound.js] テスト再生成功');
                notificationSound.currentTime = 0;
            }).catch(error => {
                console.error('[notifysound.js] テスト再生エラー (ブラウザの自動再生ポリシーによるものか):', error);
                // テスト再生に失敗しても、AudioContextは再開されたのでhasUserInteractedはtrueのまま
                // ボタンは消えるべき
                showError('通知音のテスト再生に失敗しました。ブラウザの自動再生設定を確認してください。');
            });
        } else {
            if (isDebug) console.log('[notifysound.js] 通知音オブジェクトが準備できていないためテスト再生スキップ');
        }

        // AudioContextの再開が成功したら、ボタンを非表示にする
        if (interactionButton) {
            interactionButton.classList.add('d-none');
            if (isDebug) console.log('[notifysound.js] interactionButtonを非表示にしました。');
        }

    }).catch(error => {
        console.error('[notifysound.js] AudioContext 再開エラー:', error);
        showError('音声の有効化に失敗しました。もう一度クリックしてください。');
        // AudioContextの再開に失敗した場合は、hasUserInteractedはfalseのままで、ボタンは表示したままにする
        if (interactionButton) {
            interactionButton.classList.remove('d-none'); // 念のため再表示
            if (isDebug) console.log('[notifysound.js] AudioContext再開エラーのためinteractionButtonを再表示します。');
        }
    });
}

function setupInteractionButton() {
    // 既存のボタンがないことを確認し、なければ作成
    let interactionButton = document.getElementById('interaction-button');
    if (!interactionButton) {
        interactionButton = document.createElement('button');
        interactionButton.id = 'interaction-button';
        interactionButton.className = 'btn btn-primary position-fixed top-0 start-0 m-3'; // Bootstrapクラス
        interactionButton.textContent = '通知音を有効にするためにクリック';
        interactionButton.style.zIndex = '1000'; // 他の要素の上に表示
        document.body.appendChild(interactionButton);
        if (isDebug) console.log('[notifysound.js] interactionButtonをDOMに作成し追加しました。');
    } else {
        if (isDebug) console.log('[notifysound.js] interactionButtonは既に存在します。');
        // 念のため、初期状態では表示されていることを確認
        interactionButton.classList.remove('d-none');
    }

    // ボタンにのみクリックイベントを追加
    interactionButton.addEventListener('click', handleUserInteraction);
    if (isDebug) console.log('[notifysound.js] interactionButtonにクリックリスナーを追加しました。');

    // 不要なdocumentレベルのリスナーは削除
    // document.addEventListener('click', handleUserInteraction, { once: true });
    // この行を削除することで、ボタン以外の場所をクリックしても発火しないようにします。
    // hasUserInteractedフラグで二重処理を防ぐ目的は、handleUserInteraction内で既にカバーされています。
}

export function notifyNewMessage({ title = '新しいメッセージ', body = '', messageId = '', userId = '', timestamp = '', username = '匿名' }) {
    if (isDebug) console.log('[notifysound.js] notifyNewMessage 呼び出し:', { title, body, messageId, userId, timestamp, username });
    try {
        // hasUserInteracted が true で、かつ notificationSound が準備できている場合のみ再生を試みる
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
            // ユーザーインタラクションがない場合のメッセージは、ボタンがあるときに表示されるべきで、
            // 毎回notifyNewMessageが呼ばれるたびに表示するのは適切ではないため、コメントアウト
            // if (!hasUserInteracted) {
            //     showError('通知音を有効にするには、ページをクリックしてください。');
            // } else {
            //     showError('通知音が準備できていません。');
            // }
        }
    } catch (error) {
        console.error('[notifysound.js] 通知音再生エラー (try-catch):', error);
        showError('通知音の再生に失敗しました。');
    }
}

export function initNotify() {
    if (isDebug) console.log('[notifysound.js] initNotify 開始');
    initNotificationSound(); // Audioオブジェクトの準備
    initAudioContext(); // AudioContextの準備
    setupInteractionButton(); // ボタンの作成とイベントリスナーの設定
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