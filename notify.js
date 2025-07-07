let notificationSound = null;

// 通知許可をリクエスト
function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("このブラウザは通知をサポートしていません。");
    return Promise.resolve("denied");
  }
  return Notification.requestPermission().then(permission => {
    console.log("通知許可ステータス:", permission);
    return permission;
  }).catch(error => {
    console.error("通知許可リクエストエラー:", error);
    return "denied";
  });
}

// 通知音の初期化
function initNotificationSound() {
  if (!notificationSound) {
    notificationSound = new Audio("./notification.mp3");
    notificationSound.load(); // 事前ロード
    console.log("通知音を初期化: ./notification.mp3");
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
    console.log("通知を表示:", title);
    
    // 通知音再生
    if (notificationSound) {
      notificationSound.play().then(() => {
        console.log("通知音を再生");
      }).catch(error => {
        console.warn("通知音再生エラー:", error);
        // モバイルでのエラーは無視（ユーザー操作が必要な場合が多い）
      });
    }
  } else {
    console.log("通知スキップ: タブがアクティブまたは許可なし");
  }
}

// 新メッセージ通知
function notifyNewMessage(messageData) {
  const { username, message } = messageData;
  showNotification({
    title: `新メッセージ from ${username || "匿名"}`,
    body: message || "新しいメッセージが投稿されました",
    icon: "./favicon.ico" // アイコンがあれば指定
  });
}

// 初期化
function initNotifications() {
  initNotificationSound();
  requestNotificationPermission();
}

// エクスポート
export { initNotifications, notifyNewMessage };