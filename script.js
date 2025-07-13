import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase, ref, push, onChildAdded, set, get, query, orderByChild, limitToLast, endAt, onValue, onDisconnect, remove, update } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { getAuth, GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { initNotifications, notifyNewMessage } from './notify.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js';

async function loadFirebaseConfig() {
    try {
        const response = await fetch('https://trextacy.com/firebase-config.php', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTPエラー: ステータス ${response.status}`);
        }
        const config = await response.json();
        return config;
    } catch (error) {
        throw error;
    }
}

// IPアドレス取得関数
async function getClientIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    return 'unknown';
  }
}

// クッキー設定
function setCookie(name, value, days) {
  const expires = days
    ? `; expires=${new Date(Date.now() + days * 86400000).toUTCString()}`
    : '';
  document.cookie = `${name}=${value}${expires}; path=/; SameSite=Strict`;
}
// クッキー取得
function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  const value = match ? match[2] : null;
  return value;
}
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
try {
    // Firebase設定取得
    const firebaseConfig = await loadFirebaseConfig();
    // Firebase初期化
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    const auth = getAuth(app);
    
    // 通知初期化
    initNotifications();

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
    const navbarRow2 = document.getElementById('navsec');
    // 状態管理
    let isSending = false;
    let isLoggingIn = false;
    let isUserScrolledUp = false;
    let isEnterSendMode = getCookie('enterSendMode') === 'true'; // クッキーから復元
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
    return users;
  } catch (error) {
    return [];
  }
}

async function getUserData(userId) {
  if (!userId || typeof userId !== 'string') {
    return { userId, username: '匿名', photoURL: null };
  }
  if (userCache.has(userId)) {
    const cachedData = userCache.get(userId);
    if (cachedData && cachedData.userId === userId) {
      return cachedData;
    }
    userCache.delete(userId); // 無効なキャッシュを削除
  }
  try {
    const snapshot = await get(ref(database, `users/${userId}`));
    const data = snapshot.val() || { username: '匿名', photoURL: null };
    const userData = { userId, username: '匿名', photoURL: null, ...data }; // userIdを常に含める
    userCache.set(userId, userData);
    if (userCache.size > 100) userCache.clear();
    return userData;
  } catch (error) {
    return { userId, username: '匿名', photoURL: null };
  }
}

function renderOnlineUsers(users) {
  if (!users || users.length === 0) {
    return '<span class="text-muted">オンラインのユーザーはいません</span>';
  }
  return users
    .filter(user => user && user.userId && typeof user.userId === 'string') // 有効なuserIdのみ
    .map(({ userId, username, photoURL }) => {
      const displayUsername = username && typeof username === 'string' ? username : '匿名';
      return `<span class="online-user" title="${displayUsername}" data-user-id="${userId}">
        ${photoURL
          ? `<img src="${photoURL}" alt="${displayUsername}のプロフィール画像" class="profile-img" onerror="this.outerHTML='<div class=\\'avatar\\'>${displayUsername.charAt(0).toUpperCase()}</div>'; 
          console.log('Image load failed for userId: ${userId}, URL: ${photoURL}')">`
          : `<div class="avatar">${displayUsername.charAt(0).toUpperCase()}</div>`}
      </span>`;
    })
    .join('');
}

async function updateOnlineUsers() {
  if (!auth.currentUser) {
    onlineUsersEl.innerHTML = '<span class="text-muted">ログインしてオンライン状況を確認</span>';
    return;
  }
  try {
    const users = await fetchOnlineUsers();
    const limitedUsers = users.slice(0, 50);
    const userDataArray = (await Promise.all(limitedUsers.map(user => getUserData(user.userId))))
      .filter(user => user && user.userId && typeof user.userId === 'string'); // 無効なデータを除外
    onlineUsersEl.innerHTML = renderOnlineUsers(userDataArray);
  } catch (error) {
    onlineUsersEl.innerHTML = '<span class="text-muted">オンライン状況の取得に失敗</span>';
  }
}

onValue(onlineUsersRef, (snapshot) => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(updateOnlineUsers, 1000);
});
  // ユーザーUI更新
async function updateUserUI(user) {
  try {
    let userData;
    if (user) {
      userCache.delete(user.uid); // ログイン時に古いキャッシュをクリア
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
          userId: user.uid,
          username,
          timestamp: Date.now()
        });
        onDisconnect(ref(database, `onlineUsers/${user.uid}`)).remove();
      } catch (error) {
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
});

  // モバイル端末でのメッセージエリアスクロール抑制
inputEl.addEventListener('focus', (e) => {
  e.preventDefault();
  document.body.classList.add('keyboard-active');
  const currentScrollY = window.scrollY;
  setTimeout(() => {
    window.scrollTo({ top: currentScrollY, behavior: 'auto' });
  }, 100);
});

inputEl.addEventListener('blur', () => {
  document.body.classList.remove('keyboard-active');
});

  // メッセージ入力時のエンターキー処理
  inputEl.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter' && ((!e.shiftKey && isEnterSendMode) || (e.shiftKey && !isEnterSendMode))) {
      e.preventDefault();
      formEl.dispatchEvent(new Event('submit'));
    } else if (e.key === 'Enter' && ((e.shiftKey && isEnterSendMode) || (!e.shiftKey && !isEnterSendMode))) {
      e.preventDefault();
      inputEl.value += '\n';
      inputEl.scrollTop = inputEl.scrollHeight;
    }
  });

// メッセージスクロール処理
messagesEl.removeEventListener('scroll', messagesEl._scrollHandler);

// 既存のスクロールイベントリスナーを置き換え
let lastScrollTop = 0; // 最後のスクロール位置を記録

// 新しいスクロールイベントリスナー
let scrollTimeout = null;
window.addEventListener('scroll', () => {
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(async () => {
    const currentScrollTop = window.scrollY;
    isUserScrolledUp = currentScrollTop > 10;
    newMessageBtn.classList.toggle('d-none', !isUserScrolledUp);
    const scrollTopMax = messagesEl.scrollHeight - messagesEl.clientHeight;
    if (messagesEl.scrollTop > scrollTopMax - 200 && !isLoading) {
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
          const userIds = [...new Set(olderMessagesArray.map(([key, msg]) => msg.userId))]; // デストラクチャリングは既に正しい
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
                  ${auth.currentUser && auth.currentUser.uid === userId ? 
                    `<button class="btn btn-sm btn-outline-success ms-2 delete-message" data-message-id="${key}">
                       <i class="fa fa-trash"></i>
                     </button>` : ''}
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
    // ... メッセージ読み込みロジック（変更なし）
  }, 200); // 150ms → 200ms
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

// Twitterログイン認証（script.js:642-689を修正）
twitterLogin.addEventListener('click', async () => {
  if (isLoggingIn) return;
  isLoggingIn = true;
  try {
    const provider = new TwitterAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((currentUser) => {
        if (currentUser && currentUser.uid === user.uid) {
          unsubscribe();
          resolve();
        }
      });
    });

    const token = await user.getIdToken(true);
    const providerId = result.providerId || 'twitter.com';
    const existingUserData = (await get(ref(database, `users/${user.uid}`))).val() || {};
    const username = existingUserData.username || user.displayName || `user${Date.now()}`;
    if (/[.#$/\[\]]/.test(username) || username.length > 50) {
      throw new Error('無効なユーザー名です');
    }
    const ipAddress = await getClientIp();

    const userData = {
      username,
      provider: providerId,
      ipAddress,
      photoURL: user.photoURL || null,
      email: user.email || null,
      emailVerified: user.emailVerified || false
    };
    let retries = 3;
    let success = false;
    let lastError = null;
    while (retries > 0 && !success) {
      try {
        await set(ref(database, `users/${user.uid}`), userData);
        success = true;
      } catch (error) {
        lastError = error;
        retries--;
        console.warn(`書き込み失敗（残りリトライ: ${retries}）:`, { code: error.code, message: error.message });
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    if (!success) {
      throw lastError || new Error('ユーザーデータの保存に失敗しました');
    }

    await push(actionsRef, {
      type: 'connect',
      userId: user.uid,
      username,
      timestamp: Date.now()
    });
    showSuccess('Twitterでログインしました。');
  } catch (error) {
    console.error('Twitterログインエラー:', { code: error.code, message: error.message });
    showError('Twitterログインに失敗しました: ' + error.message);
  } finally {
    isLoggingIn = false;
  }
});

// Googleログイン（script.js:696-736を修正）
googleLogin.addEventListener('click', async () => {
  if (isLoggingIn) return;
  isLoggingIn = true;
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const providerId = result.providerId || 'google.com';
    const existingUserData = (await get(ref(database, `users/${user.uid}`))).val() || {};
    let username = existingUserData.username || user.displayName || `user${Date.now()}`;
    if (!username || typeof username !== 'string' || username.length === 0 || username.length > 50 || /[.#$/\[\]]/.test(username)) {
      console.warn('Invalid username detected, using fallback:', username);
      username = `user${Date.now()}`;
      if (username.length > 50) {
        username = username.slice(0, 50);
      }
    }
    const ipAddress = await getClientIp();
    const userData = {
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
    };

    // リトライロジックの挿入
    let retries = 3;
    let success = false;
    let lastError = null;
    while (retries > 0 && !success) {
      try {
        await set(ref(database, `users/${user.uid}`), userData);
        success = true;
      } catch (error) {
        lastError = error;
        retries--;
        console.warn(`書き込み失敗（残りリトライ: ${retries}）:`, { code: error.code, message: error.message });
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    if (!success) {
      throw lastError || new Error('ユーザーデータの保存に失敗しました');
    }

    await push(actionsRef, {
      type: 'connect',
      userId: user.uid,
      username,
      timestamp: Date.now()
    });
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
    const userData = {
      username: uniqueUsername,
      provider: 'anonymous',
      ipAddress,
      photoURL: null,
      email: null,
      emailVerified: false,
      providerData: []
    };
    let retries = 3;
    let success = false;
    let lastError = null;
    while (retries > 0 && !success) {
      try {
        await set(ref(database, `users/${user.uid}`), userData);
        success = true;
      } catch (error) {
        lastError = error;
        retries--;
        console.warn(`書き込み失敗（残りリトライ: ${retries}）:`, { code: error.code, message: error.message });
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    if (!success) {
      throw lastError || new Error('ユーザーデータの保存に失敗しました');
    }
    await push(actionsRef, {
      type: 'connect',
      userId: user.uid,
      username: uniqueUsername,
      timestamp: Date.now()
    });
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
        showSuccess('ログアウトしました。');
      } catch (error) {
        console.error('ログアウトエラー:', error);
        showError('ログアウトに失敗しました: ' + error.message);
      }
    } else {
      loginModalEl.removeAttribute('inert');
      loginModal.show();
      setTimeout(() => document.getElementById('twitterLogin')?.focus(), 100);
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
  if (!username || username.length === 0) {
    unameInput.classList.add('is-invalid');
    showError('ユーザー名を入力してください。');
    return;
  }
  if (username.length > 20) {
    unameInput.classList.add('is-invalid');
    showError('ユーザー名は20文字以内にしてください。');
    return;
  }
  if (/[.#$/\[\]]/.test(username)) {
    unameInput.classList.add('is-invalid');
    showError('ユーザー名に使用できない文字（. # $ / [ ]）が含まれています。');
    return;
  }
  if (!auth.currentUser) {
    showError('ログインしてください。');
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
      timestamp: Date.now(),
      userId: auth.currentUser.uid
    };
    const actionRef = push(actionsRef);
    updates[`actions/${actionRef.key}`] = {
      type: 'setUsername',
      userId: auth.currentUser.uid,
      username,
      timestamp: Date.now()
    };
    let retries = 3;
    let success = false;
    let lastError = null;
    while (retries > 0 && !success) {
      try {
        await update(ref(database), updates);
        success = true;
      } catch (error) {
        lastError = error;
        retries--;
        console.warn(`ユーザー名設定失敗（残りリトライ: ${retries}）:`, { code: error.code, message: error.message });
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    if (!success) {
      throw lastError || new Error('ユーザー名の保存に失敗しました');
    }
    userInfo.innerHTML = `<span class="status-dot status-active"></span>${username} <i class="fas fa-pencil-alt ms-1"></i>`;
    unameModal.hide();
    unameInput.classList.remove('is-invalid');
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
  formEl.removeEventListener('submit', formEl._submitHandler); // 既存リスナーを削除
formEl._submitHandler = async (e) => {
  e.preventDefault();
  if (!formEl.checkValidity()) {
    e.stopPropagation();
    formEl.classList.add('was-validated');
    return;
  }
  if (!auth.currentUser) {
    showError('ログインしてください。');
    return;
  }
  const banned = (await get(ref(database, `bannedUsers/${auth.currentUser.uid}`))).val();
  if (banned) {
    showError('あなたはBANされています。メッセージを送信できません。');
    return;
  }
  const message = inputEl.value.trim();
  if (message.length === 0) {
    showError('メッセージを入力してください。');
    return;
  }
  if (isSending) {
    console.warn('メッセージ送信連打防止');
    return;
  }
  isSending = true;
  let tempMessageId;
  try {
    const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
    const username = userInfo.textContent.replace(/<[^>]+>/g, '').trim();
    const timestamp = Date.now();
    tempMessageId = `temp-${timestamp}-${Math.random().toString(36).slice(2)}`;
    const li = document.createElement('li');
    li.className = `list-group-item p-0 m-0 border shadow-sm mb-3 d-flex justify-content-start align-items-start border-0 fade-in latest-message pulse mb-3`;
    li.setAttribute('data-message-id', tempMessageId);
    li.setAttribute('data-user-id', auth.currentUser.uid);
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
          <button class="btn btn-sm btn-outline-success ms-2 delete-message" data-message-id="${tempMessageId}">
            <i class="fa fa-trash" aria-hidden="true"></i>
          </button>
        </div>
        <div class="col-12 message-body mt-2">
          ${formattedMessage}
        </div>
      </div>`;
    messagesEl.prepend(li);
    setTimeout(() => li.classList.add('show'), 10);
    const messageRef = await push(messagesRef, {
      username,
      message,
      timestamp,
      userId: auth.currentUser.uid,
      ipAddress: userData.ipAddress || 'github'
    });
    const tempMessage = messagesEl.querySelector(`[data-message-id="${tempMessageId}"]`);
    if (tempMessage) {
      tempMessage.setAttribute('data-message-id', messageRef.key);
      const deleteButton = tempMessage.querySelector('.delete-message');
      if (deleteButton) {
        deleteButton.setAttribute('data-message-id', messageRef.key);
      }
    }
    // 一時メッセージを削除して、setupMessageListener に任せる
    if (tempMessage) {
      tempMessage.classList.remove('show');
      setTimeout(() => tempMessage.remove(), 300);
    }
    await push(actionsRef, {
      type: 'sendMessage',
      userId: auth.currentUser.uid,
      username,
      timestamp
    });
    inputEl.value = '';
    formEl.classList.remove('was-validated');
    isUserScrolledUp = false;
    newMessageBtn.classList.add('d-none');
  } catch (error) {
    console.error('メッセージ送信エラー:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    showError(`メッセージの送信に失敗しました: ${error.message}`);
    const tempMessage = messagesEl.querySelector(`[data-message-id="${tempMessageId}"]`);
    if (tempMessage) {
      tempMessage.classList.remove('show');
      setTimeout(() => tempMessage.remove(), 300);
    }
  } finally {
    isSending = false;
  }
};
  formEl.addEventListener('submit', formEl._submitHandler);
}

  // テキストエリアの自動リサイズ
inputEl.addEventListener('focus', (e) => {
  e.preventDefault();
  const currentScrollY = window.scrollY;
  setTimeout(() => {
    window.scrollTo({ top: currentScrollY, behavior: 'auto' });
  }, 100); // キーボード表示の遅延を考慮
});

  // 初期メッセージ読み込み
async function loadInitialMessages() {
  if (!auth.currentUser) {
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
            ${auth.currentUser && auth.currentUser.uid === userId ? 
              `<button class="btn btn-sm btn-outline-success ms-2 delete-message" data-message-id="${key}">
                 <i class="fa fa-trash"></i>
               </button>` : ''}
          </div>
          <div class="col-12 message-body mt-2">
            ${formattedMessage}
          </div>
        </div>`;
      messagesEl.prepend(li);
      setTimeout(() => li.classList.add('show'), 10);
    }
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
// setupMessageListener (script.js:1036-1099)
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
      // 重複チェック
      if (messagesEl.querySelector(`[data-message-id="${key}"]`)) {
        return;
      }
      const userData = userCache.has(userId) ? userCache.get(userId) : (await get(ref(database, `users/${userId}`))).val() || {};
      userCache.set(userId, userData);
      if (userCache.size > 100) userCache.clear();
      const photoURL = userData.photoURL;
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
      li.setAttribute('data-user-id', userId);
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
            ${auth.currentUser && auth.currentUser.uid === userId ? 
              `<button class="btn btn-sm btn-outline-success ms-2 delete-message" data-message-id="${key}">
                 <i class="fa fa-trash" aria-hidden="true"></i>
               </button>` : ''}
          </div>
          <div class="col-12 message-body mt-2">
            ${formattedMessage}
          </div>
        </div>`;
      messagesEl.prepend(li);
      setTimeout(() => li.classList.add('show'), 10);
      if (auth.currentUser?.uid !== userId) {
        notifyNewMessage({ username, message });
      }
      if (!isUserScrolledUp) {
        requestAnimationFrame(() => {
          messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
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

// 削除処理（formEl.addEventListener の後に追加）
messagesEl.addEventListener('click', async (e) => {
  if (e.target.closest('.delete-message')) {
    const button = e.target.closest('.delete-message');
    const messageId = button.getAttribute('data-message-id');
    if (!messageId) {
      console.warn('メッセージIDが見つかりません');
      showError('メッセージの削除に失敗しました: IDが見つかりません');
      return;
    }
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    deleteModal.show();
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    confirmDeleteBtn.focus(); // フォーカスを明示的に設定
    confirmDeleteBtn.onclick = async () => {
      try {
        const messageRef = ref(database, `messages/${messageId}`);
        const snapshot = await get(messageRef);
        if (!snapshot.exists()) {
          console.warn('メッセージが存在しません: messageId=', messageId);
          showError('メッセージが見つかりません');
          return;
        }
        if (snapshot.val().userId !== auth.currentUser.uid) {
          console.warn('権限エラー: 自分のメッセージではありません', { messageId, userId: snapshot.val().userId });
          showError('自分のメッセージのみ削除できます');
          return;
        }
        await remove(messageRef);
        console.log('メッセージ削除成功: messageId=', messageId);
        const messageEl = messagesEl.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
          messageEl.classList.remove('show');
          setTimeout(() => messageEl.remove(), 300);
        } else {
          console.warn('UIメッセージが見つかりません: messageId=', messageId);
        }
        await push(actionsRef, {
          type: 'deleteMessage',
          userId: auth.currentUser.uid,
          username: userInfo.textContent.replace(/<[^>]+>/g, '').trim(),
          messageId,
          timestamp: Date.now()
        });
        showSuccess('メッセージを削除しました。');
      } catch (error) {
        console.error('メッセージ削除エラー:', error);
        showError(`メッセージの削除に失敗しました: ${error.message}`);
      } finally {
        deleteModal.hide();
        inputEl.focus(); // モーダル閉じた後にフォーカスを戻す
      }
    };
  }
});


  // 認証状態監視
  auth.onAuthStateChanged(async (user) => {
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
  });

  loginModalEl.addEventListener('hidden.bs.modal', () => {
    loginModalEl.setAttribute('inert', '');
    loginBtn.focus();
  });

  // 新着メッセージボタン
newMessageBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    isUserScrolledUp = false;
    newMessageBtn.classList.add('d-none');
});
  // フォーム初期化（クローンを削除）
window.onload = () => {
  document.body.style.overscrollBehaviorY = 'contain'; // 追加
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
    new bootstrap.Tooltip(el);
  });

// 仮想キーボードの抑制
window.visualViewport.addEventListener('resize', () => {
  if (document.activeElement === inputEl) {
    window.scrollTo({ top: window.scrollY, behavior: 'auto' });
  }
});

  // モードボタンのUIをクッキーの状態に同期
  toggleModeBtn.innerHTML = isEnterSendMode ? '<i class="fas fa-paper-plane"></i>' : '<i class="fas fa-level-down-alt fa-rotate-90"></i>';
  const newTitle = isEnterSendMode ? '送信モード' : '改行モード';
  toggleModeBtn.setAttribute('data-bs-title', newTitle);
  toggleModeBtn.setAttribute('aria-label', isEnterSendMode ? '送信モードに切り替え' : '改行モードに切り替え');
  if (!formEl) {
    console.error('window.onload: formElが見つかりません。ID="messageForm"の要素を確認してください。');
  } else {
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
