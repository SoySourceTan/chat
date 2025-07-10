import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase, ref, push, onChildAdded, set, get, query, orderByChild, limitToLast, endAt, onValue, onDisconnect, remove, update } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { getAuth, GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { initNotifications, notifyNewMessage } from './notify.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js';

// IPアドレス取得関数
async function getClientIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('IP取得エラー:', error);
    return 'unknown';
  }
}

const firebaseConfig = {
  apiKey: "AIzaSyBLMySLkXyeiL2_QLCdolHTOOA6W3TSfYc",
  authDomain: "gentle-brace-458923-k9.firebaseapp.com",
  databaseURL: "https://gentle-brace-458923-k9-default-rtdb.firebaseio.com",
  projectId: "gentle-brace-458923-k9",
  storageBucket: "gentle-brace-458923-k9.firebasestorage.app",
  messagingSenderId: "426876531009",
  appId: "1:426876531009:web:021b23c449bce5d72031c0",
  measurementId: "G-2B5KWNHYED"
};

// クッキー設定
function setCookie(name, value, days) {
  const expires = days
    ? `; expires=${new Date(Date.now() + days * 86400000).toUTCString()}`
    : '';
  document.cookie = `${name}=${value}${expires}; path=/; SameSite=Strict`;
  console.log(`クッキー設定: ${name}=${value}, expires=${expires}`);
}
// クッキー取得
function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  const value = match ? match[2] : null;
  console.log(`クッキー取得: ${name}=${value}`);
  return value;
}

try {
  // Firebase初期化
  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const auth = getAuth(app);
  console.log('Firebase初期化成功');
  
  // 通知初期化
  initNotifications();
  console.log('通知システム初期化');

  // データベース参照
  const messagesRef = ref(database, 'messages');
  const usersRef = ref(database, 'users');
  const actionsRef = ref(database, 'actions');
  const bannedUsersRef = ref(database, 'bannedUsers');
  const onlineUsersRef = ref(database, 'onlineUsers');

  // DOM要素
  let formEl = document.getElementById('messageForm');
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('m');
  const errorAlert = document.getElementById('error-alert');
  const loginBtn = document.getElementById('login-btn');
  const twitterLogin = document.getElementById('twitterLogin');
  const googleLogin = document.getElementById('googleLogin');
  const anonymousLogin = document.getElementById('anonymousLogin');
  const userInfo = document.getElementById('user-info');
  const unameModalEl = document.getElementById('unameModal');
  const unameModal = new bootstrap.Modal(unameModalEl);
  const loginModalEl = document.getElementById('loginModal');
  const loginModal = new bootstrap.Modal(loginModalEl);
  const unameInput = document.getElementById('uname');
  const confirmName = document.getElementById('confirmName');
  const onlineUsersEl = document.getElementById('online-users');
  const compactModeBtn = document.getElementById('compactModeBtn');
  const fontSizeS = document.getElementById('fontSizeS');
  const fontSizeM = document.getElementById('fontSizeM');
  const fontSizeL = document.getElementById('fontSizeL');
  const signOutBtn = document.getElementById('signOut');
  const newMessageBtn = document.getElementById('newMessageBtn');
  const toggleModeBtn = document.getElementById('toggleModeBtn');
  const loadingIndicator = document.getElementById('loading-indicator');
  const progressOverlay = document.getElementById('progress-overlay');

// 状態管理
let isSending = false;
let isLoggingIn = false;
let isUserScrolledUp = false;
let isEnterSendMode = getCookie('enterSendMode') === 'true'  // クッキーから復元
let isLoading = false;
let lastTimestamp = null;
let latestInitialTimestamp = null;
let isCompactMode = false;
let lastActivity = Date.now();
const userCache = new Map();
let debounceTimeout = null;

  // エラーメッセージ表示
  function showError(message) {
    errorAlert.textContent = message;
    errorAlert.classList.remove('d-none');
    errorAlert.setAttribute('role', 'alert');
    errorAlert.focus();
    setTimeout(() => {
      errorAlert.classList.add('d-none');
      errorAlert.removeAttribute('role');
    }, 6000);
    console.log('エラーメッセージ表示:', message);
  }

  // 成功メッセージ表示
  function showSuccess(message) {
    const successAlert = document.createElement('div');
    successAlert.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x m-3';
    successAlert.style.zIndex = '2000';
    successAlert.setAttribute('role', 'alert');
    successAlert.textContent = message;
    document.body.appendChild(successAlert);
    setTimeout(() => successAlert.remove(), 3000);
    console.log('成功メッセージ表示:', message);
  }

  // トースト通知
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'alert alert-info position-fixed bottom-0 end-0 m-3';
    toast.style.zIndex = '2000';
    toast.setAttribute('role', 'alert');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
    console.log('トースト通知表示:', message);
  }

  // ステータスインジケーター更新
  function updateStatusIndicator() {
    const statusDot = userInfo.querySelector('.status-dot');
    if (statusDot) {
      const now = Date.now();
      statusDot.classList.toggle('status-active', now - lastActivity < 5 * 60 * 1000);
      statusDot.classList.toggle('status-away', now - lastActivity >= 5 * 60 * 1000);
    }
  }


async function fetchOnlineUsers() {
  try {
    const snapshot = await get(onlineUsersRef);
    const users = snapshot.val()
      ? Object.entries(snapshot.val())
          .filter(([uid, user]) => uid && user && typeof user === 'object')
          .map(([uid, user]) => ({
            userId: uid,
            username: user.username && typeof user.username === 'string' ? user.username : '匿名',
            photoURL: user.photoURL && typeof user.photoURL === 'string' ? user.photoURL : null
          }))
      : [];
    console.log('Fetched online users:', users);
    return users;
  } catch (error) {
    console.error('オンラインユーザー取得エラー:', error);
    return [];
  }
}

async function getUserData(userId) {
  if (!userId || typeof userId !== 'string') {
    console.warn('Invalid userId in getUserData:', userId);
    return null; // 無効な場合はnullを返す
  }
  if (userCache.has(userId)) {
    const cachedData = userCache.get(userId);
    if (cachedData.userId === userId) {
      return cachedData;
    }
    console.warn('Invalid cached data for userId:', userId, cachedData);
  }
  try {
    const snapshot = await get(ref(database, `users/${userId}`));
    const data = snapshot.val() || { username: '匿名', photoURL: null };
    const userData = { userId, ...data };
    userCache.set(userId, userData);
    if (userCache.size > 100) userCache.clear();
    console.log('Fetched user data:', userData);
    return userData;
  } catch (error) {
    console.error('ユーザー データ取得エラー:', error);
    return { userId, username: '匿名', photoURL: null };
  }
}

function renderOnlineUsers(users) {
  if (!users || users.length === 0) {
    console.log('No online users to render');
    return '<span class="text-muted">オンラインのユーザーはいません</span>';
  }
  return users
    .filter(user => user && user.userId && typeof user.userId === 'string') // 有効なuserIdのみ
    .map(({ userId, username, photoURL }) => {
      const displayUsername = username && typeof username === 'string' ? username : '匿名';
      console.log(`Rendering user - userId: ${userId}, photoURL: ${photoURL}`);
      return `<span class="online-user" title="${displayUsername}" data-user-id="${userId}">
        ${photoURL
          ? `<img src="${photoURL}" alt="${displayUsername}のプロフィール画像" class="profile-img" onerror="this.outerHTML='<div class=\\'avatar\\'>${displayUsername.charAt(0).toUpperCase()}</div>'; console.log('Image load failed for userId: ${userId}, URL: ${photoURL}')">`
          : `<div class="avatar">${displayUsername.charAt(0).toUpperCase()}</div>`}
      </span>`;
    })
    .join('');
}

async function updateOnlineUsers() {
  if (!auth.currentUser) {
    console.log('未ログインのため、オンラインステータスをスキップ');
    onlineUsersEl.innerHTML = '<span class="text-muted">ログインしてオンライン状況を確認</span>';
    return;
  }
  try {
    const users = await fetchOnlineUsers();
    const limitedUsers = users.slice(0, 50);
    const userDataArray = (await Promise.all(limitedUsers.map(user => getUserData(user.userId))))
      .filter(user => user && user.userId && typeof user.userId === 'string'); // 無効なデータを除外
    console.log('Valid user data array:', userDataArray);
    onlineUsersEl.innerHTML = renderOnlineUsers(userDataArray);
  } catch (error) {
    console.warn('オンラインユーザー取得エラー:', error);
    onlineUsersEl.innerHTML = '<span class="text-muted">オンライン状況の取得に失敗</span>';
  }
}

onValue(onlineUsersRef, (snapshot) => {
  console.log('onValue triggered at:', new Date().toISOString(), 'Data:', snapshot.val());
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(updateOnlineUsers, 1000);
});
  // ユーザーUI更新
  async function updateUserUI(user) {
  try {
    let userData;
    if (user) {
      userData = (await get(ref(database, `users/${user.uid}`))).val() || {};
      let username = userData.username || user.displayName || 'ゲスト';
      username = username.length > 7 ? username.substring(0, 7) + "..." : username;
      userInfo.innerHTML = `<span class="status-dot status-active"></span>${username}<i class="fas fa-pencil-alt ms-1"></i>`;
      loginBtn.innerHTML = '<i class="fa fa-sign-out"></i>';
      loginModal.hide();
      loginModalEl.setAttribute('inert', '');
      if ((user.isAnonymous || !userData.username) && !isLoggingIn) {
        unameInput.value = userData.username || '';
        unameModalEl.removeAttribute('inert');
        unameModal.show();
        setTimeout(() => unameInput.focus(), 100);
      }
      lastActivity = Date.now();
      try {
        await set(ref(database, `onlineUsers/${user.uid}`), {
          userId: user.uid, // userIdを明示的に追加
          username,
          timestamp: Date.now()
        });
        onDisconnect(ref(database, `onlineUsers/${user.uid}`)).remove();
      } catch (error) {
        console.warn('オンラインステータス更新エラー:', error);
      }
      updateStatusIndicator();
      await updateOnlineUsers();
      await loadInitialMessages();
    } else {
      userInfo.innerHTML = `<span class="status-dot status-away"></span>ゲスト <i class="fas fa-pencil-alt ms-1"></i>`;
      loginBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i>`;
      unameModalEl.setAttribute('inert', '');
      loginModalEl.removeAttribute('inert');
      loginModal.show();
      setTimeout(() => document.getElementById('twitterLogin')?.focus(), 100);
      if (progressOverlay) progressOverlay.classList.add('d-none');
      await updateOnlineUsers();
    }
  } catch (error) {
    console.error('ユーザーUI更新エラー:', error);
    showError('ユーザー情報の更新に失敗しました。');
  }
}

  // オンラインユーザー監視
  onValue(onlineUsersRef, () => updateOnlineUsers());

  // ユーザーアクティビティ監視
  ['click', 'keydown', 'mousemove'].forEach(event => {
    document.addEventListener(event, () => {
      lastActivity = Date.now();
      updateStatusIndicator();
    });
  });
  setInterval(updateStatusIndicator, 60000);

  // ツールチップ管理
  function disposeTooltip(element) {
    const tooltip = bootstrap.Tooltip.getInstance(element);
    if (tooltip) tooltip.dispose();
  }

  function showTooltip(element, title) {
    disposeTooltip(element);
    new bootstrap.Tooltip(element, { title });
    const tooltip = bootstrap.Tooltip.getInstance(element);
    tooltip.show();
    setTimeout(() => tooltip.hide(), 1000);
  }

  // コンパクトモード切り替え
  compactModeBtn.addEventListener('click', () => {
    isCompactMode = !isCompactMode;
    messagesEl.classList.toggle('compact-mode', isCompactMode);
    compactModeBtn.innerHTML = isCompactMode ? '<i class="fas fa-expand"></i>' : '<i class="fas fa-compress"></i>';
    const newTitle = isCompactMode ? '通常モード' : 'コンパクトモード';
    compactModeBtn.setAttribute('aria-label', isCompactMode ? '通常モードに切り替え' : 'コンパクトモードに切り替え');
    compactModeBtn.setAttribute('title', newTitle);
    showTooltip(compactModeBtn, newTitle);
  });

  // フォントサイズ切り替え
  fontSizeS.addEventListener('click', () => {
    messagesEl.classList.remove('font-size-medium', 'font-size-large');
    messagesEl.classList.add('font-size-small');
    fontSizeS.classList.add('active');
    fontSizeM.classList.remove('active');
    fontSizeL.classList.remove('active');
  });

  fontSizeM.addEventListener('click', () => {
    messagesEl.classList.remove('font-size-small', 'font-size-large');
    messagesEl.classList.add('font-size-medium');
    fontSizeM.classList.add('active');
    fontSizeS.classList.remove('active');
    fontSizeL.classList.remove('active');
  });

  fontSizeL.addEventListener('click', () => {
    messagesEl.classList.remove('font-size-small', 'font-size-medium');
    messagesEl.classList.add('font-size-large');
    fontSizeL.classList.add('active');
    fontSizeS.classList.remove('active');
    fontSizeM.classList.remove('active');
  });

  // 送信/改行モード切り替え
toggleModeBtn.addEventListener('click', () => {
  isEnterSendMode = !isEnterSendMode;
  toggleModeBtn.innerHTML = isEnterSendMode ? '<i class="fas fa-paper-plane"></i>' : '<i class="fas fa-level-down-alt fa-rotate-90"></i>';
  const newTitle = isEnterSendMode ? '送信モード' : '改行モード';
  toggleModeBtn.setAttribute('data-bs-title', newTitle);
  toggleModeBtn.setAttribute('aria-label', isEnterSendMode ? '送信モードに切り替え' : '改行モードに切り替え');
  setCookie('enterSendMode', isEnterSendMode, 365); // クッキーに保存（1年）
  showTooltip(toggleModeBtn, newTitle);
  console.log('モード切り替え:', isEnterSendMode ? '送信モード' : '改行モード');
});

  // メッセージ入力時のエンターキー処理
  inputEl.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter' && ((!e.shiftKey && isEnterSendMode) || (e.shiftKey && !isEnterSendMode))) {
      e.preventDefault();
      console.log('Enterキー押下: フォーム送信');
      formEl.dispatchEvent(new Event('submit'));
    } else if (e.key === 'Enter' && ((e.shiftKey && isEnterSendMode) || (!e.shiftKey && !isEnterSendMode))) {
      e.preventDefault();
      inputEl.value += '\n';
      inputEl.scrollTop = inputEl.scrollHeight;
    }
  });

  // メッセージスクロール処理
// 既存のリスナーを削除（念のため）
messagesEl.removeEventListener('scroll', messagesEl._scrollHandler);

// 既存のスクロールイベントリスナーを置き換え
let lastScrollTop = 0; // 最後のスクロール位置を記録

// 新しいスクロールイベントリスナー
window.addEventListener('scroll', async () => {
  const navbar = document.querySelector('nav.navbar-slide');
  const currentScrollTop = window.scrollY;
  const scrollBottom = document.documentElement.scrollHeight - window.innerHeight - currentScrollTop;

  // ナビゲーションバーの表示/非表示
  if (currentScrollTop > 100) {
    // 100px以上スクロールダウン
    if (currentScrollTop > lastScrollTop) {
      // スクロールダウン中
      navbar.classList.add('hidden');
    } else {
      // スクロールアップ中
      navbar.classList.remove('hidden');
    }
  } else {
    // 100px未満では常に表示
    navbar.classList.remove('hidden');
  }
  lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop; // 負のスクロールを防ぐ

  // 既存のスクロール処理（メッセージ読み込みなど）
  isUserScrolledUp = currentScrollTop > 10;
  newMessageBtn.classList.toggle('d-none', !isUserScrolledUp);
const scrollTopMax = messagesEl.scrollHeight - messagesEl.clientHeight;
if (messagesEl.scrollTop > scrollTopMax - 100 && !isLoading) {
    console.log('ローディング開始');
    isLoading = true;
    loadingIndicator.textContent = '過去の10件のメッセージを読み込み中...';
    loadingIndicator.style.display = 'block';
    try {
      const startTime = performance.now();
      const messages = messagesEl.querySelectorAll('[data-timestamp]');
      lastTimestamp = messages.length ? Math.min(...Array.from(messages).map(m => Number(m.getAttribute('data-timestamp')))) : null;
      if (lastTimestamp) {
        const olderMessages = await get(query(messagesRef, orderByChild('timestamp'), endAt(lastTimestamp - 1), limitToLast(10)));
        const olderMessagesArray = olderMessages.val() ? Object.entries(olderMessages.val()).sort((a, b) => b[1].timestamp - a[1].timestamp) : [];
        const userIds = [...new Set(olderMessagesArray.map(([_, msg]) => msg.userId))];
        const userDataPromises = userIds.map(async userId => {
          if (userCache.has(userId)) return { userId, data: userCache.get(userId) };
          const snapshot = await get(ref(database, `users/${userId}`));
          const data = snapshot.val() || {};
          userCache.set(userId, data);
          return { userId, data };
        });
        const userDataArray = await Promise.all(userDataPromises);
        const userDataMap = Object.fromEntries(userDataArray.map(({ userId, data }) => [userId, data]));
        for (const [key, { username, message, timestamp, userId, ipAddress }] of olderMessagesArray) {
          if (messagesEl.querySelector(`[data-message-id="${key}"]`)) continue;
          const photoURL = userDataMap[userId]?.photoURL;
          const li = document.createElement('li');
          li.className = `list-group-item p-0 m-0 border shadow-sm mb-3 d-flex justify-content-start align-items-start border-0 fade-in`;
          li.setAttribute('data-message-id', key);
          li.setAttribute('role', 'listitem');
          li.setAttribute('data-timestamp', timestamp);
          const date = timestamp ? new Date(timestamp).toLocaleString('ja-JP') : '不明';
          li.innerHTML = `
            <div class="message bg-transparent p-2 row">
<div class="col-auto profile-icon">
  ${photoURL ? 
    `<img src="${photoURL}" alt="${username}のプロフィール画像" class="profile-img">` :
    `<div class="avatar">${username.charAt(0).toUpperCase()}</div>`}
</div>
              <div class="col-auto message-header p-0 m-0 d-flex align-items-center">
                <strong>${username || '匿名'}</strong>
                <small class="text-muted ms-2">${date}</small>
              </div>
              <div class="col-12 message-body mt-2">
                ${message ? message.replace(/\n/g, '<br>') : 'メッセージなし'}
              </div>
            </div>`;
          messagesEl.appendChild(li);
          setTimeout(() => li.classList.add('show'), 10);
        }
      }
    } catch (error) {
      console.error('過去メッセージ取得エラー:', error);
      showError('過去のメッセージが取得できませんでした。');
    } finally {
      isLoading = false;
      loadingIndicator.textContent = 'ロード中...';
      loadingIndicator.style.display = 'none';
    }
  }
});

// クライアント側でIPアドレスを取得
async function getClientIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('IP取得エラー:', error);
    return null;
  }
}


// Twitterログイン
twitterLogin.addEventListener('click', async () => {
  if (isLoggingIn) return;
  isLoggingIn = true;
  try {
    const provider = new TwitterAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log('Twitter user info:', { 
      uid: user.uid, 
      displayName: user.displayName, 
      photoURL: user.photoURL, 
      email: user.email, 
      emailVerified: user.emailVerified, 
      providerData: user.providerData 
    }); // デバッグ
    const providerId = result.providerId || 'twitter.com';
    const existingUserData = (await get(ref(database, `users/${user.uid}`))).val() || {};
    const username = existingUserData.username || user.displayName || `user${Date.now()}`;
    const ipAddress = await getClientIp();
    await set(ref(database, `users/${user.uid}`), {
      username,
      provider: providerId,
      ipAddress,
      photoURL: user.photoURL || null,
      email: user.email || null,
      emailVerified: user.emailVerified || false,
      providerData: user.providerData.map(data => ({
        providerId: data.providerId,
        uid: data.uid,
        displayName: data.displayName,
        photoURL: data.photoURL,
        email: data.email
      }))
    });
    console.log('Twitter user data saved:', { username, photoURL: user.photoURL, email: user.email, ipAddress }); // デバッグ
    await push(actionsRef, {
      type: 'connect',
      userId: user.uid,
      username,
      timestamp: Date.now()
    });
    console.log('Twitterログイン成功:', user.displayName);
    showSuccess('Twitterでログインしました。');
  } catch (error) {
    console.error('Twitterログインエラー:', { code: error.code, message: error.message });
    showError('Twitterログインに失敗しました: ' + error.message);
  } finally {
    isLoggingIn = false;
  }
});

// Googleログイン（script.js:507-539を更新）
googleLogin.addEventListener('click', async () => {
  if (isLoggingIn) return;
  isLoggingIn = true;
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log('Google user info:', { 
      uid: user.uid, 
      displayName: user.displayName, 
      photoURL: user.photoURL, 
      email: user.email, 
      emailVerified: user.emailVerified, 
      providerData: user.providerData 
    });
    const providerId = result.providerId || 'google.com';
    const existingUserData = (await get(ref(database, `users/${user.uid}`))).val() || {};
    let username = existingUserData.username || user.displayName || `user${Date.now()}`;
    // usernameのバリデーション
    if (!username || typeof username !== 'string' || username.length === 0 || username.length > 50 || /[.#$/\[\]]/.test(username)) {
      console.warn('Invalid username detected, using fallback:', username);
      username = `user${Date.now()}`; // フォールバック
      if (username.length > 50) {
        username = username.slice(0, 50); // 長さ制限
      }
    }
    const ipAddress = await getClientIp();
    const userData = {
      username,
      provider: providerId,
      ipAddress: ipAddress || null,
      photoURL: user.photoURL || null,
      email: user.email || null,
      emailVerified: user.emailVerified || false,
      providerData: user.providerData.map(data => ({
        providerId: data.providerId,
        uid: data.uid,
        displayName: data.displayName,
        photoURL: data.photoURL,
        email: data.email
      }))
    };
    console.log('Writing user data to /users/$uid:', { uid: user.uid, ...userData }); // 詳細なログ
    await set(ref(database, `users/${user.uid}`), userData);
    console.log('Google user data saved:', { username, photoURL: user.photoURL, email: user.email, ipAddress });
    await push(actionsRef, {
      type: 'connect',
      userId: user.uid,
      username,
      timestamp: Date.now()
    });
    console.log('Googleログイン成功:', user.displayName);
    showSuccess('Googleでログインしました。');
  } catch (error) {
    console.error('Googleログインエラー:', { code: error.code, message: error.message, stack: error.stack });
    showError('Googleログインに失敗しました: ' + error.message);
  } finally {
    isLoggingIn = false;
  }
});

// 匿名ログイン
anonymousLogin.addEventListener('click', async () => {
  if (isLoggingIn) return;
  isLoggingIn = true;
  try {
    const result = await signInAnonymously(auth);
    const user = result.user;
    const uniqueUsername = `anon${Date.now()}`;
    const ipAddress = await getClientIp();
    await set(ref(database, `users/${user.uid}`), {
      username: uniqueUsername,
      provider: 'anonymous',
      ipAddress,
      photoURL: null,
      email: null,
      emailVerified: false,
      providerData: []
    });
    console.log('Anonymous user data saved:', { username: uniqueUsername, ipAddress }); // デバッグ
    await push(actionsRef, {
      type: 'connect',
      userId: user.uid,
      username: uniqueUsername,
      timestamp: Date.now()
    });
    console.log('匿名ログイン成功');
    showSuccess('匿名でログインしました。');
  } catch (error) {
    console.error('匿名ログインエラー:', { code: error.code, message: error.message });
    showError('匿名ログインに失敗しました: ' + error.message);
  } finally {
    isLoggingIn = false;
  }
});

  // ログアウト
  loginBtn.addEventListener('click', async () => {
    if (auth.currentUser) {
      try {
        await push(actionsRef, {
          type: 'logout',
          userId: auth.currentUser.uid,
          username: userInfo.textContent.replace(/<[^>]+>/g, '').trim(),
          timestamp: Date.now()
        });
        await remove(ref(database, `onlineUsers/${auth.currentUser.uid}`));
        await signOut(auth);
        console.log('ログアウト成功');
        showSuccess('ログアウトしました。');
      } catch (error) {
        console.error('ログアウトエラー:', error);
        showError('ログアウトに失敗しました: ' + error.message);
      }
    } else {
      loginModalEl.removeAttribute('inert');
      loginModal.show();
      setTimeout(() => document.getElementById('twitterLogin')?.focus(), 100);
      console.log('ログインモーダル表示');
    }
  });

  signOutBtn.addEventListener('click', async () => {
    try {
      await push(actionsRef, {
        type: 'logout',
        userId: auth.currentUser.uid,
        username: userInfo.textContent.replace(/<[^>]+>/g, '').trim(),
        timestamp: Date.now()
      });
      await remove(ref(database, `onlineUsers/${auth.currentUser.uid}`));
      await signOut(auth);
      unameModal.hide();
      unameModalEl.setAttribute('inert', '');
      document.getElementById('login-btn').focus();
      console.log('ログアウト成功');
      showSuccess('ログアウトしました。');
    } catch (error) {
      console.error('ログアウトエラー:', error);
      showError('ログアウトに失敗しました: ' + error.message);
    }
  });

  // ユーザー名変更
  userInfo.addEventListener('click', async () => {
    if (auth.currentUser) {
      try {
        const userData = await get(ref(database, `users/${auth.currentUser.uid}`));
        unameInput.value = userData.val()?.username || '';
        unameModalEl.removeAttribute('inert');
        unameModal.show();
        setTimeout(() => unameInput.focus(), 100);
        console.log('unameModal表示: uname入力欄にフォーカス');
      } catch (error) {
        console.error('ユーザー名取得エラー:', error);
        showError('ユーザー名の取得に失敗しました。');
      }
    } else {
      showError('ログインしてください。');
    }
  });

  confirmName.addEventListener('click', async () => {
    const rawInput = unameInput.value;
    const username = rawInput.trim();
    console.log('ユーザー名入力: raw=', rawInput, 'trimmed=', username);
    if (!username || username.length === 0) {
      unameInput.classList.add('is-invalid');
      console.log('ユーザー名エラー: 空文字または無効な入力');
      showError('ユーザー名を入力してください。');
      return;
    }
    if (username.length > 20) {
      unameInput.classList.add('is-invalid');
      console.log('ユーザー名エラー: 文字数超過');
      showError('ユーザー名は20文字以内にしてください。');
      return;
    }
    if (/[.#$/\[\]]/.test(username)) {
      unameInput.classList.add('is-invalid');
      console.log('ユーザー名エラー: 無効な文字');
      showError('ユーザー名に使用できない文字（. # $ / [ ]）が含まれています。');
      return;
    }
    if (!auth.currentUser) {
      showError('ログインしてください。');
      console.log('ユーザー名エラー: 未ログイン');
      return;
    }
    try {
      const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
      const updates = {};
      updates[`users/${auth.currentUser.uid}`] = {
        username,
        provider: userData.provider || 'anonymous',
        ipAddress: userData.ipAddress || 'github'
      };
      updates[`onlineUsers/${auth.currentUser.uid}`] = {
        username,
        timestamp: Date.now()
      };
      const actionRef = push(actionsRef);
      updates[`actions/${actionRef.key}`] = {
        type: 'setUsername',
        userId: auth.currentUser.uid,
        username,
        timestamp: Date.now()
      };
      console.log('ユーザー名設定開始: username=', username, 'userId=', auth.currentUser.uid);
      await update(ref(database), updates);
      userInfo.innerHTML = `<span class="status-dot status-active"></span>${username} <i class="fas fa-pencil-alt ms-1"></i>`;
      unameModal.hide();
      unameInput.classList.remove('is-invalid');
      console.log('ユーザー名設定成功:', username);
      showSuccess('ユーザー名を更新しました。');
      await updateOnlineUsers();
    } catch (error) {
      console.error('ユーザー名設定エラー:', error);
      showError(`ユーザー名の保存に失敗しました: ${error.message}`);
      unameInput.classList.add('is-invalid');
    }
  });

  // メッセージ送信
if (!formEl) {
  console.error('formElが見つかりません。ID="messageForm"の要素を確認してください。');
} else {
  console.log('formElを初期化: ID=messageForm');
  formEl.removeEventListener('submit', formEl._submitHandler);
formEl._submitHandler = async (e) => {
  e.preventDefault();
  console.log('フォーム送信開始');
  if (!formEl.checkValidity()) {
    e.stopPropagation();
    formEl.classList.add('was-validated');
    console.log('バリデーション失敗');
    return;
  }
  if (!auth.currentUser) {
    showError('ログインしてください。');
    console.log('送信失敗: 未ログイン');
    return;
  }
  const banned = (await get(ref(database, `bannedUsers/${auth.currentUser.uid}`))).val();
  if (banned) {
    showError('あなたはBANされています。メッセージを送信できません。');
    console.log('送信失敗: ユーザーがBANされています');
    return;
  }
  const message = inputEl.value.trim();
  if (message.length === 0) {
    showError('メッセージを入力してください。');
    console.log('送信失敗: 空メッセージ');
    return;
  }
  if (isSending) {
    console.warn('メッセージ送信連打防止');
    return;
  }
  isSending = true;
  console.log('メッセージ送信処理開始: message=', message);
  try {
    const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
    const username = userInfo.textContent.replace(/<[^>]+>/g, '').trim();
    const timestamp = Date.now();
    const tempMessageId = `temp-${timestamp}`;
    const li = document.createElement('li');
    li.className = `list-group-item p-0 m-0 border shadow-sm mb-3 d-flex justify-content-start align-items-start border-0 fade-in latest-message pulse mb-3`;
    li.setAttribute('data-message-id', tempMessageId);
    li.setAttribute('role', 'listitem');
    li.setAttribute('data-timestamp', timestamp);
    const date = new Date(timestamp).toLocaleString('ja-JP');
    const codeRegex = /```(\w+)?\s*([\s\S]*?)\s*```/g;
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    let formattedMessage = message;
    const codePlaceholder = '___CODE_BLOCK___';
    const codeBlocks = [];
    formattedMessage = formattedMessage.replace(codeRegex, (_, lang, code) => {
      const cleanCode = code.replace(/\n$/, '');
      codeBlocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${cleanCode}</code></pre>`);
      return codePlaceholder + (codeBlocks.length - 1);
    });
    formattedMessage = formattedMessage
      .replace(/\n/g, '<br>')
      .replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    formattedMessage = formattedMessage.replace(new RegExp(`${codePlaceholder}(\\d+)`, 'g'), (_, index) => codeBlocks[index]);
    formattedMessage = DOMPurify.sanitize(formattedMessage, { ADD_ATTR: ['target'], ADD_TAGS: ['pre', 'code'] });
    li.innerHTML = `
      <div class="message bg-transparent p-2 row">
        <div class="col-auto profile-icon">
          ${userData.photoURL ? 
            `<img src="${userData.photoURL}" alt="${username}のプロフィール画像" class="profile-img">` :
            `<div class="avatar">${username.charAt(0).toUpperCase()}</div>`}
        </div>
        <div class="col-auto message-header p-0 m-0 d-flex align-items-center">
          <strong>${username}</strong>
          <small class="text-muted ms-2">${date}</small>
        </div>
        <div class="col-12 message-body mt-2">
          ${formattedMessage}
        </div>
      </div>`;
    messagesEl.prepend(li);
    setTimeout(() => li.classList.add('show'), 10);
    console.log('ローカルメッセージ表示: tempMessageId=', tempMessageId);
    const messageRef = await push(messagesRef, {
      username,
      message,
      timestamp,
      userId: auth.currentUser.uid,
      ipAddress: userData.ipAddress || 'github'
    });
    console.log('Firebaseメッセージ送信成功: key=', messageRef.key);
    const tempMessage = messagesEl.querySelector(`[data-message-id="${tempMessageId}"]`);
    if (tempMessage) {
      tempMessage.setAttribute('data-message-id', messageRef.key);
      console.log('ローカルメッセージID更新: newId=', messageRef.key);
    } else {
      console.warn('ローカルメッセージが見つかりません: tempMessageId=', tempMessageId);
    }
    await push(actionsRef, {
      type: 'sendMessage',
      userId: auth.currentUser.uid,
      username,
      timestamp
    });
    inputEl.value = '';
    inputEl.focus();
    formEl.classList.remove('was-validated');
    isUserScrolledUp = false;
    messagesEl.scrollTop = 0; // 初期化
function adjustScrollForKeyboard() {
  if (window.visualViewport) {
    const viewportHeight = window.visualViewport.height;
    const offset = window.innerHeight - viewportHeight; // キーボードの高さ
    window.scrollTo({ top: offset, behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
inputEl.addEventListener('focus', adjustScrollForKeyboard);
formEl.addEventListener('submit', adjustScrollForKeyboard);
    newMessageBtn.classList.add('d-none');
    console.log('メッセージ送信成功: スクロール位置=', messagesEl.scrollTop);
    await updateOnlineUsers();
  } catch (error) {
    console.error('メッセージ送信エラー:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    showError(`メッセージの送信に失敗しました: ${error.message}`);
    const tempMessage = messagesEl.querySelector(`[data-message-id="temp-${timestamp}"]`);
    if (tempMessage) tempMessage.remove();
  } finally {
    isSending = false;
    console.log('メッセージ送信処理終了');
  }
};
formEl.addEventListener('submit', formEl._submitHandler);
  console.log('formElにsubmitリスナーを設定');
}

  // テキストエリアの自動リサイズ
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
  });

  // 初期メッセージ読み込み
async function loadInitialMessages() {
  if (!auth.currentUser) {
    console.log('未ログインのためメッセージ読み込みをスキップ');
    return;
  }
  if (!progressOverlay) {
    console.warn('progress-overlay要素が見つかりません。index.htmlに<div id="progress-overlay">が含まれているか確認してください。');
    return;
  }
  try {
    progressOverlay.classList.remove('d-none');
    const startTime = performance.now();
    const initialMessagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(10));
    const snapshot = await get(initialMessagesQuery);
    const messages = snapshot.val() ? Object.entries(snapshot.val()).sort((a, b) => a[1].timestamp - b[1].timestamp) : [];
    console.log(`初期メッセージ取得時間: ${(performance.now() - startTime).toFixed(2)}ms, メッセージ数: ${messages.length}`);
    
    const userIds = [...new Set(messages.map(([_, msg]) => msg.userId))];
    const userDataPromises = userIds.map(async userId => {
      if (userCache.has(userId)) return { userId, data: userCache.get(userId) };
      const snapshot = await get(ref(database, `users/${userId}`));
      const data = snapshot.val() || {};
      userCache.set(userId, data);
      return { userId, data };
    });
    const userDataArray = await Promise.all(userDataPromises);
    const userDataMap = Object.fromEntries(userDataArray.map(({ userId, data }) => [userId, data]));
    
    messagesEl.innerHTML = '';
    latestInitialTimestamp = messages.length ? Math.max(...messages.map(([_, msg]) => msg.timestamp)) : null;
    const renderStartTime = performance.now();
    for (const [key, { username, message, timestamp, userId, ipAddress }] of messages) {
      const isLatest = key === messages[messages.length - 1]?.[0];
      const provider = userDataMap[userId]?.provider || 'anonymous';
      const photoURL = userDataMap[userId]?.photoURL;
      const li = document.createElement('li');
      li.className = `list-group-item p-0 m-0 border shadow-sm mb-3 d-flex justify-content-start align-items-start border-0 ${isLatest ? 'latest-message pulse' : ''} fade-in`;
      li.setAttribute('data-message-id', key);
      li.setAttribute('role', 'listitem');
      li.setAttribute('data-timestamp', timestamp);
      const date = timestamp ? new Date(timestamp).toLocaleString('ja-JP') : '不明';
      // URLとコードブロックを処理
      const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
      const codeRegex = /```([\s\S]*?)```/g;
      let formattedMessage = message
        ? message
            .replace(/\n/g, '<br>')
            .replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(codeRegex, '<pre><code>$1</code></pre>')
        : 'メッセージなし';
      formattedMessage = DOMPurify.sanitize(formattedMessage, { ADD_ATTR: ['target'], ADD_TAGS: ['pre', 'code'] });
      li.innerHTML = `
        <div class="message bg-transparent p-2 row">
          <div class="col-auto profile-icon">
            ${photoURL ? 
              `<img src="${photoURL}" alt="${username}のプロフィール画像" class="profile-img">` :
              `<div class="avatar">${username.charAt(0).toUpperCase()}</div>`}
          </div>
          <div class="col-auto message-header p-0 m-0 d-flex align-items-center">
            <strong>${username || '匿名'}</strong>
            <small class="text-muted ms-2">${date}</small>
          </div>
          <div class="col-12 message-body mt-2">
            ${formattedMessage}
          </div>
        </div>`;
      messagesEl.prepend(li);
      setTimeout(() => li.classList.add('show'), 10);
    }
    console.log(`初期メッセージ描画完了: メッセージ数=${messages.length}, 描画時間: ${(performance.now() - renderStartTime).toFixed(2)}ms, 総処理時間: ${(performance.now() - startTime).toFixed(2)}ms`);
    showToast(`最新の${messages.length}件のメッセージを読み込みました`);
    messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error('初期メッセージ読み込みエラー:', error);
    showError('メッセージの読み込みに失敗しました。');
  } finally {
    if (progressOverlay) progressOverlay.classList.add('d-none');
  }
}

  // 新しいメッセージの監視
  let messageListener = null;
function setupMessageListener() {
  if (messageListener) {
    messageListener();
  }
  messageListener = onChildAdded(messagesRef, async (snapshot) => {
    try {
      const { username, message, timestamp, userId, ipAddress } = snapshot.val();
      const key = snapshot.key;
      if (timestamp <= latestInitialTimestamp) {
        return;
      }
      if (messagesEl.querySelector(`[data-message-id="${key}"]`) || 
          messagesEl.querySelector(`[data-message-id="temp-${timestamp}"]`)) {
        console.log('重複メッセージ検出: key=', key, 'timestamp=', timestamp);
        return;
      }
      const userData = userCache.has(userId) ? userCache.get(userId) : (await get(ref(database, `users/${userId}`))).val() || {};
      userCache.set(userId, userData);
      if (userCache.size > 100) userCache.clear();
      const photoURL = userData.photoURL;
      // コードブロックとURLを処理
      const codeRegex = /```(\w+)?\s*([\s\S]*?)\s*```/g;
      const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
      let formattedMessage = message;
      const codePlaceholder = '___CODE_BLOCK___';
      const codeBlocks = [];
      formattedMessage = formattedMessage.replace(codeRegex, (_, lang, code) => {
        const cleanCode = code.replace(/\n$/, '');
        codeBlocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${cleanCode}</code></pre>`);
        return codePlaceholder + (codeBlocks.length - 1);
      });
      formattedMessage = formattedMessage
        .replace(/\n/g, '<br>')
        .replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
      formattedMessage = formattedMessage.replace(new RegExp(`${codePlaceholder}(\\d+)`, 'g'), (_, index) => codeBlocks[index]);
      formattedMessage = DOMPurify.sanitize(formattedMessage, { ADD_ATTR: ['target'], ADD_TAGS: ['pre', 'code'] });
      const li = document.createElement('li');
      li.className = `list-group-item p-0 m-0 border shadow-sm mb-3 d-flex justify-content-start align-items-start border-0 fade-in latest-message pulse mb-3`;
      li.setAttribute('data-message-id', key);
      li.setAttribute('role', 'listitem');
      li.setAttribute('data-timestamp', timestamp);
      const date = timestamp ? new Date(timestamp).toLocaleString('ja-JP') : '不明';
      li.innerHTML = `
        <div class="message bg-transparent p-2 row">
          <div class="col-auto profile-icon">
            ${photoURL ? 
              `<img src="${photoURL}" alt="${username}のプロフィール画像" class="profile-img">` :
              `<div class="avatar">${username.charAt(0).toUpperCase()}</div>`}
          </div>
          <div class="col-auto message-header p-0 m-0 d-flex align-items-center">
            <strong>${username || '匿名'}</strong>
            <small class="text-muted ms-2">${date}</small>
          </div>
          <div class="col-12 message-body mt-2">
            ${formattedMessage}
          </div>
        </div>`;
      messagesEl.prepend(li);
      setTimeout(() => li.classList.add('show'), 10);
      console.log('新メッセージ表示: key=', key, 'formattedMessage=', formattedMessage);
      if (auth.currentUser?.uid !== userId) {
        notifyNewMessage({ username, message });
        console.log('新メッセージ通知送信: username=', username, 'message=', message);
      }
if (!isUserScrolledUp) {
  requestAnimationFrame(() => {
    messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
    console.log('新メッセージでスクロール: scrollTop=', messagesEl.scrollTop);
  });
  newMessageBtn.classList.add('d-none');
} else {
  newMessageBtn.classList.remove('d-none');
}
    } catch (error) {
      console.error('新メッセージ追加エラー:', error);
      showError('メッセージの取得に失敗しました。');
    }
  });
}

  // 認証状態監視
  auth.onAuthStateChanged(async (user) => {
    console.log('authStateChanged:', user ? `ユーザー ${user.uid} (${user.isAnonymous ? '匿名' : '認証済み'})` : '未ログイン');
    try {
      latestInitialTimestamp = null; // リセット
      await updateUserUI(user);
      setupMessageListener(); // リスナーを再設定
    } catch (error) {
      console.error('認証状態変更エラー:', error);
      showError('認証状態の更新に失敗しました。ページをリロードしてください。');
      userInfo.innerHTML = `<span class="status-dot status-away"></span>ゲスト <i class="fas fa-pencil-alt ms-1"></i>`;
      loginBtn.textContent = `<i class="fas fa-sign-in-alt"></i>`;
      loginModal.show();
      loginModalEl.removeAttribute('inert');
      unameModalEl.setAttribute('inert', '');
      if (progressOverlay) progressOverlay.classList.add('d-none');
    }
  });

  // モーダル非表示時のフォーカス管理
  unameModalEl.addEventListener('hidden.bs.modal', () => {
    unameModalEl.setAttribute('inert', '');
    loginBtn.focus();
    console.log('unameModal非表示: フォーカスをlogin-btnに移動');
  });

  loginModalEl.addEventListener('hidden.bs.modal', () => {
    loginModalEl.setAttribute('inert', '');
    loginBtn.focus();
    console.log('loginModal非表示: フォーカスをlogin-btnに移動');
  });

  // 新着メッセージボタン
newMessageBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    isUserScrolledUp = false;
    newMessageBtn.classList.add('d-none');
    console.log('newMessageBtnクリック: ページの最上部にスクロール');
});
  // フォーム初期化（クローンを削除）
window.onload = () => {
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
    new bootstrap.Tooltip(el);
  });
  // モードボタンのUIをクッキーの状態に同期
  toggleModeBtn.innerHTML = isEnterSendMode ? '<i class="fas fa-paper-plane"></i>' : '<i class="fas fa-level-down-alt fa-rotate-90"></i>';
  const newTitle = isEnterSendMode ? '送信モード' : '改行モード';
  toggleModeBtn.setAttribute('data-bs-title', newTitle);
  toggleModeBtn.setAttribute('aria-label', isEnterSendMode ? '送信モードに切り替え' : '改行モードに切り替え');
  console.log('初期モード:', isEnterSendMode ? '送信モード' : '改行モード');
  if (!formEl) {
    console.error('window.onload: formElが見つかりません。ID="messageForm"の要素を確認してください。');
  } else {
    console.log('window.onload: formElにsubmitリスナーを再設定');
    formEl.removeEventListener('submit', formEl._submitHandler);
    formEl.addEventListener('submit', formEl._submitHandler);
  }
};
} catch (error) {
  console.error('Firebase初期化エラー:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  showError(`Firebaseの初期化に失敗しました: ${error.message}`);
}