let notificationSound = null;
const isDebug = true;
const processedMessageIds = new Set(); // 2重再生防止用

// 通知音の初期化
function initNotificationSound() {
    if (!notificationSound) {
        try {
            if (isDebug) console.log("notifysound.js: 通知音初期化開始");
            const audioUrl = 'notification.mp3';
            if (isDebug) console.log("notifysound.js: audioUrl=", audioUrl);
            notificationSound = new Audio(audioUrl);
            if (isDebug) console.log("notifysound.js: Audioオブジェクト作成: src=", notificationSound.src);
            notificationSound.load();
            if (isDebug) console.log("notifysound.js: 通知音ロード開始");
            notificationSound.addEventListener('loadeddata', () => {
                if (isDebug) console.log("notifysound.js: 通知音ロード完了: readyState=", notificationSound.readyState);
            });
            notificationSound.addEventListener('error', (error) => {
                console.error("notifysound.js: 通知音ロードエラー:", error, "src=", notificationSound.src, "code=", notificationSound.error?.code, "message=", notificationSound.error?.message);
                notificationSound = null;
            });
        } catch (error) {
            console.error("notifysound.js: 通知音の初期化エラー:", error);
            notificationSound = null;
        }
    }
}

// 通知音再生
function notifyNewMessage({ title, body, messageId }) {
    if (isDebug) console.log("notifysound.js: notifyNewMessage 呼び出し: title=", title, "body=", body, "messageId=", messageId);
    if (messageId && processedMessageIds.has(messageId)) {
        if (isDebug) console.log("notifysound.js: メッセージ重複: messageId=", messageId);
        return;
    }
    if (messageId) {
        processedMessageIds.add(messageId);
    }
    if (document.visibilityState === "hidden") {
        if (isDebug) console.log("notifysound.js: 通知音再生条件: バックグラウンド");
        if (notificationSound && notificationSound.readyState >= 2) {
            if (isDebug) console.log("notifysound.js: 通知音再生試行: readyState=", notificationSound.readyState);
            notificationSound.play().then(() => {
                if (isDebug) console.log("notifysound.js: 通知音を再生");
                notificationSound.currentTime = 0;
            }).catch(error => {
                console.error("notifysound.js: 通知音再生エラー:", error);
            });
        } else {
            if (isDebug) console.warn("notifysound.js: 通知音が準備できていません: notificationSound=", notificationSound, "readyState=", notificationSound?.readyState);
        }
    } else {
        if (isDebug) console.log("notifysound.js: 通知音スキップ: タブがアクティブ");
    }
}

// オートプレイポリシー解除
function unlockAudio() {
    if (isDebug) console.log("notifysound.js: オートプレイポリシー解除開始");
    if (notificationSound) {
        notificationSound.play().then(() => {
            notificationSound.pause();
            notificationSound.currentTime = 0;
            if (isDebug) console.log("notifysound.js: ポリシー解除成功");
        }).catch(error => {
            console.error("notifysound.js: ポリシー解除エラー:", error);
        });
    } else {
        if (isDebug) console.warn("notifysound.js: notificationSoundが未初期化");
    }
}

// 初期化
function initNotify() {
    if (isDebug) console.log("notifysound.js: initNotify 開始");
    initNotificationSound();
}

// サービスワーカーからのメッセージ受信
navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NEW_MESSAGE') {
        if (isDebug) console.log("notifysound.js: サービスワーカーからメッセージ受信:", event.data);
        notifyNewMessage({
            title: event.data.title || "新しいメッセージ",
            body: event.data.body,
            messageId: event.data.messageId
        });
    }
});

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', () => {
    if (isDebug) console.log("notifysound.js: DOMContentLoadedでinitNotifyを実行");
    initNotify();
});

// グローバルスコープに公開
window.unlockAudio = unlockAudio;
export { initNotify, notifyNewMessage, unlockAudio };