let notificationSound = null;
const isDebug = false; // デバッグログを制御（falseでログを抑制）

// 通知許可をリクエスト
function requestNotificationPermission() {
  if (!("Notification" in window)) {
    if (isDebug) console.warn("このブラウザは通知をサポートしていません。");
    return Promise.resolve("denied");
  }
  return Notification.requestPermission().then(permission => {
    if (isDebug) console.log("通知許可ステータス:", permission);
    return permission;
  }).catch(error => {
    console.error("通知許可リクエストエラー:", error);
    return "denied";
  });
}

// 通知音の初期化
function initNotificationSound() {
  if (!notificationSound) {
    try {
      notificationSound = new Audio("./notification.mp3");
      notificationSound.load();
      if (isDebug) console.log("通知音を初期化: ./notification.mp3");
    } catch (error) {
      console.error("通知音の初期化エラー:", error);
      notificationSound = null;
    }
  }
}

// 通知と音を再生
function showNotification({ title, body, icon }) {
  if (document.visibilityState === "hidden" && Notification.permission === "granted") {
    const notification = new Notification(title, {
      body,
      icon: icon || undefined,
      badge: icon || undefined,
      timestamp: Date.now(),
    });
    if (isDebug) console.log("通知を表示:", title);
    
    if (notificationSound) {
      notificationSound.play().then(() => {
        if (isDebug) console.log("通知音を再生");
      }).catch(error => {
        console.warn("通知音再生エラー:", error);
      });
    }
  } else {
    if (isDebug) console.log("通知スキップ: タブがアクティブまたは許可なし");
  }
}

// 新メッセージ通知
function notifyNewMessage(messageData) {
  const { username, message } = messageData;
  showNotification({
    title: `新メッセージ from ${username || "匿名"}`,
    body: message || "新しいメッセージが投稿されました",
  });
}

// 初期化
function initNotifications() {
  initNotificationSound();
  requestNotificationPermission();
}

// エクスポート
export { initNotifications, notifyNewMessage, initNotificationSound };