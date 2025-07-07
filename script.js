import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase, ref, push, onChildAdded, set, get, query, orderByChild, limitToLast, endAt, onValue, onDisconnect, remove } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { getAuth, GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

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

try {
  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const auth = getAuth(app);
  console.log('Firebase初期化成功');
  const messagesRef = ref(database, 'messages');
  const usersRef = ref(database, 'users');
  const actionsRef = ref(database, 'actions');
  const bannedUsersRef = ref(database, 'bannedUsers');
  const onlineUsersRef = ref(database, 'onlineUsers');

  const formEl = document.getElementById('messageForm');
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

  let isSending = false;
  let isLoggingIn = false;
  let isUserScrolledUp = false;
  let isEnterSendMode = true;
  let isLoading = false;
  let lastTimestamp = null;
  let isCompactMode = false;
  let lastActivity = Date.now();
  const userCache = new Map(); // ユーザー情報のキャッシュ

  function showError(message) {
    errorAlert.textContent = message;
    errorAlert.classList.remove('d-none');
    setTimeout(() => errorAlert.classList.add('d-none'), 3000);
  }

  function showSuccess(message) {
    const successAlert = document.createElement('div');
    successAlert.className = 'alert alert-success';
    successAlert.setAttribute('role', 'alert');
    successAlert.textContent = message;
    document.body.appendChild(successAlert);
    setTimeout(() => successAlert.remove(), 3000);
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'alert alert-info position-fixed bottom-0 end-0 m-3';
    toast.style.zIndex = '2000';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function updateStatusIndicator() {
    const statusDot = userInfo.querySelector('.status-dot');
    if (statusDot) {
      const now = Date.now();
      statusDot.classList.toggle('status-active', now - lastActivity < 5 * 60 * 1000);
      statusDot.classList.toggle('status-away', now - lastActivity >= 5 * 60 * 1000);
    }
  }

  async function updateOnlineUsers() {
    try {
      const snapshot = await get(onlineUsersRef);
      const users = snapshot.val() ? Object.values(snapshot.val()) : [];
      onlineUsersEl.innerHTML = users.map(user => 
        `<span class="online-user" title="${user.username}">${user.username.charAt(0).toUpperCase()}</span>`
      ).join('');
    } catch (error) {
      console.error('オンラインユーザー取得エラー:', error);
      showError('オンラインユーザーの取得に失敗しました。');
    }
  }

  async function updateUserUI(user) {
    try {
      if (user) {
        const userData = await get(ref(database, `users/${user.uid}`));
        const userDataVal = userData.val() || {};
        const username = userDataVal.username || user.displayName || 'ゲスト';
        userInfo.innerHTML = `<span class="status-dot status-active"></span>${username} <i class="fas fa-pencil-alt ms-1"></i>`;
        loginBtn.textContent = 'ログアウト';
        loginModal.hide();
        loginModalEl.setAttribute('inert', '');
        if ((user.isAnonymous || !userDataVal.username) && !isLoggingIn) {
          unameInput.value = userDataVal.username || '';
          unameModalEl.removeAttribute('inert');
          unameModal.show();
          setTimeout(() => unameInput.focus(), 100);
        }
        lastActivity = Date.now();
        try {
          await set(ref(database, `onlineUsers/${user.uid}`), {
            username,
            timestamp: Date.now()
          });
          onDisconnect(ref(database, `onlineUsers/${user.uid}`)).remove();
        } catch (error) {
          console.warn('オンラインステータス更新エラー:', error);
        }
        updateStatusIndicator();
      } else {
        userInfo.innerHTML = `<span class="status-dot status-away"></span>ゲスト <i class="fas fa-pencil-alt ms-1"></i>`;
        loginBtn.textContent = 'ログイン';
        unameModalEl.setAttribute('inert', '');
        loginModalEl.removeAttribute('inert');
        loginModal.show();
        setTimeout(() => document.getElementById('twitterLogin')?.focus(), 100);
      }
      await updateOnlineUsers();
    } catch (error) {
      console.error('ユーザーUI更新エラー:', error);
      showError('ユーザー情報の更新に失敗しました。');
    }
  }

  ['click', 'keydown', 'mousemove'].forEach(event => {
    document.addEventListener(event, () => {
      lastActivity = Date.now();
      updateStatusIndicator();
    });
  });

  setInterval(updateStatusIndicator, 60000);

  function disposeTooltip(element) {
    const tooltip = bootstrap.Tooltip.getInstance(element);
    if (tooltip) {
      tooltip.dispose();
    }
  }

  function showTooltip(element, title) {
    disposeTooltip(element);
    new bootstrap.Tooltip(element, { title });
    const tooltip = bootstrap.Tooltip.getInstance(element);
    tooltip.show();
    setTimeout(() => {
      tooltip.hide();
    }, 1000);
  }

  compactModeBtn.addEventListener('click', () => {
    isCompactMode = !isCompactMode;
    messagesEl.classList.toggle('compact-mode', isCompactMode);
    compactModeBtn.innerHTML = isCompactMode ? '<i class="fas fa-expand"></i>' : '<i class="fas fa-compress"></i>';
    const newTitle = isCompactMode ? '通常モード' : 'コンパクトモード';
    compactModeBtn.setAttribute('aria-label', isCompactMode ? '通常モードに切り替え' : 'コンパクトモードに切り替え');
    compactModeBtn.setAttribute('title', newTitle);
    showTooltip(compactModeBtn, newTitle);
  });

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

  toggleModeBtn.addEventListener('click', () => {
    isEnterSendMode = !isEnterSendMode;
    toggleModeBtn.innerHTML = isEnterSendMode ? '<i class="fas fa-paper-plane"></i>' : '<i class="fas fa-level-down-alt fa-rotate-90"></i>';
    const newTitle = isEnterSendMode ? '送信モード' : '改行モード';
    toggleModeBtn.setAttribute('data-bs-title', newTitle);
    toggleModeBtn.setAttribute('aria-label', isEnterSendMode ? '送信モードに切り替え' : '改行モードに切り替え');
    showTooltip(toggleModeBtn, newTitle);
    console.log('モード切り替え:', isEnterSendMode ? '送信モード' : '改行モード');
  });

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

  messagesEl.addEventListener('scroll', async () => {
    const scrollBottom = messagesEl.scrollHeight - messagesEl.clientHeight - messagesEl.scrollTop;
    isUserScrolledUp = messagesEl.scrollTop > 10;
    newMessageBtn.classList.toggle('d-none', !isUserScrolledUp);
    if (scrollBottom < 100 && !isLoading) {
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
          const userStartTime = performance.now();
          const userDataPromises = userIds.map(async userId => {
            if (userCache.has(userId)) return { userId, data: userCache.get(userId) };
            const snapshot = await get(ref(database, `users/${userId}`));
            const data = snapshot.val() || {};
            userCache.set(userId, data);
            return { userId, data };
          });
          const userDataArray = await Promise.all(userDataPromises);
          console.log(`過去メッセージユーザー情報取得時間: ${(performance.now() - userStartTime).toFixed(2)}ms, ユーザー数: ${userIds.length}`);
          const userDataMap = Object.fromEntries(userDataArray.map(({ userId, data }) => [userId, data]));
          for (const [key, { username, message, timestamp, userId, ipAddress }] of olderMessagesArray) {
            if (messagesEl.querySelector(`[data-message-id="${key}"]`)) continue;
            const provider = userDataMap[userId]?.provider || 'anonymous';
            const iconClass = provider === 'twitter.com' ? 'fa-brands fa-x-twitter' :
                             provider === 'google.com' ? 'fa-brands fa-google' :
                             'fa-solid fa-user-secret';
            const li = document.createElement('li');
            li.className = `list-group-item d-flex justify-content-start align-items-start border-0 fade-in`;
            li.setAttribute('data-message-id', key);
            li.setAttribute('role', 'listitem');
            li.setAttribute('data-timestamp', timestamp);
            const date = timestamp ? new Date(timestamp).toLocaleString('ja-JP') : '不明';
            li.innerHTML = `
              <div class="message bg-transparent p-3">
                <div class="message-header d-flex align-items-center">
                  <i class="${iconClass} me-2 provider-icon"></i>
                  <strong>${username || '匿名'}</strong>
                  <small class="text-muted ms-2">${date}</small>
                </div>
                <div class="message-body">
                  ${message ? message.replace(/\n/g, '<br>') : 'メッセージなし'}
                </div>
              </div>`;
            messagesEl.appendChild(li);
            setTimeout(() => li.classList.add('show'), 10);
          }
          console.log(`過去メッセージロード完了: メッセージ数=${olderMessagesArray.length}, 総処理時間: ${(performance.now() - startTime).toFixed(2)}ms`);
          showToast(`過去の${olderMessagesArray.length}件のメッセージを読み込みました`);
        }
      } catch (error) {
        console.error('過去メッセージ取得エラー:', error);
        showError('過去メッセージの取得に失敗しました。');
      } finally {
        isLoading = false;
        loadingIndicator.textContent = '読み込み中...';
        loadingIndicator.style.display = 'none';
      }
    }
  });

  twitterLogin.addEventListener('click', async () => {
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
      const provider = new TwitterAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const providerId = result.providerId || 'twitter.com';
      const existingUserData = (await get(ref(database, `users/${user.uid}`))).val() || {};
      const username = existingUserData.username || user.displayName || `user${Date.now()}`;
      await set(ref(database, `users/${user.uid}`), {
        username,
        provider: providerId,
        ipAddress: 'github'
      });
      await push(actionsRef, {
        type: 'connect',
        userId: user.uid,
        username,
        timestamp: Date.now()
      });
      console.log('Xログイン成功:', user.displayName);
      await updateUserUI(user);
      showSuccess('Xでログインしました。');
    } catch (error) {
      console.error('Xログインエラー:', error);
      showError('Xログインに失敗しました: ' + error.message);
    } finally {
      isLoggingIn = false;
    }
  });

  googleLogin.addEventListener('click', async () => {
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const providerId = result.providerId || 'google.com';
      const existingUserData = (await get(ref(database, `users/${user.uid}`))).val() || {};
      const username = existingUserData.username || user.displayName || `user${Date.now()}`;
      await set(ref(database, `users/${user.uid}`), {
        username,
        provider: providerId,
        ipAddress: 'github'
      });
      await push(actionsRef, {
        type: 'connect',
        userId: user.uid,
        username,
        timestamp: Date.now()
      });
      console.log('Googleログイン成功:', user.displayName);
      await updateUserUI(user);
      showSuccess('Googleでログインしました。');
    } catch (error) {
      console.error('Googleログインエラー:', error);
      showError('Googleログインに失敗しました: ' + error.message);
    } finally {
      isLoggingIn = false;
    }
  });

  anonymousLogin.addEventListener('click', async () => {
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
      const result = await signInAnonymously(auth);
      const user = result.user;
      const uniqueUsername = `anon${Date.now()}`;
      await set(ref(database, `users/${user.uid}`), {
        username: uniqueUsername,
        provider: 'anonymous',
        ipAddress: 'github'
      });
      await push(actionsRef, {
        type: 'connect',
        userId: user.uid,
        username: uniqueUsername,
        timestamp: Date.now()
      });
      console.log('匿名ログイン成功');
      await updateUserUI(user);
      showSuccess('匿名でログインしました。');
    } catch (error) {
      console.error('匿名ログインエラー:', error);
      showError('匿名ログインに失敗しました: ' + error.message);
    } finally {
      isLoggingIn = false;
    }
  });

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
    const username = unameInput.value.trim();
    if (username === '') {
      unameInput.classList.add('is-invalid');
      console.log('ユーザー名エラー: 空文字');
      return;
    }
    if (!auth.currentUser) {
      showError('ログインしてください。');
      console.log('ユーザー名エラー: 未ログイン');
      return;
    }
    try {
      const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
      await set(ref(database, `users/${auth.currentUser.uid}`), {
        username,
        provider: userData.provider || 'anonymous',
        ipAddress: userData.ipAddress || 'github'
      });
      try {
        await set(ref(database, `onlineUsers/${auth.currentUser.uid}`), {
          username,
          timestamp: Date.now()
        });
      } catch (error) {
        console.warn('オンラインステータス更新エラー:', error);
      }
      await push(actionsRef, {
        type: 'setUsername',
        userId: auth.currentUser.uid,
        username,
        timestamp: Date.now()
      });
      userInfo.innerHTML = `<span class="status-dot status-active"></span>${username} <i class="fas fa-pencil-alt ms-1"></i>`;
      unameModal.hide();
      unameInput.classList.remove('is-invalid');
      console.log('ユーザー名設定成功:', username);
      showSuccess('ユーザー名を更新しました。');
    } catch (error) {
      console.error('ユーザー名設定エラー:', error);
      showError('ユーザー名の保存に失敗しました: ' + error.message);
    }
  });

  formEl.addEventListener('submit', async (e) => {
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
    try {
      const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
      const timestamp = Date.now();
      await push(messagesRef, {
        username: userInfo.textContent.replace(/<[^>]+>/g, '').trim(),
        message,
        timestamp,
        userId: auth.currentUser.uid,
        ipAddress: userData.ipAddress || 'github'
      });
      await push(actionsRef, {
        type: 'sendMessage',
        userId: auth.currentUser.uid,
        username: userInfo.textContent.replace(/<[^>]+>/g, '').trim(),
        timestamp
      });
      inputEl.value = '';
      inputEl.focus();
      formEl.classList.remove('was-validated');
      isUserScrolledUp = false;
      messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
      newMessageBtn.classList.add('d-none');
      console.log('メッセージ送信成功: スクロール位置=', messagesEl.scrollTop);
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      showError('メッセージの送信に失敗しました: ' + error.message);
    } finally {
      isSending = false;
    }
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
  });

  async function loadInitialMessages() {
    try {
      loadingIndicator.textContent = '最新の10件のメッセージを読み込み中...';
      loadingIndicator.style.display = 'block';
      const startTime = performance.now();
      const initialMessagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(10));
      const snapshot = await get(initialMessagesQuery);
      const messages = snapshot.val() ? Object.entries(snapshot.val()).sort((a, b) => a[1].timestamp - b[1].timestamp) : [];
      console.log(`初期メッセージ取得時間: ${(performance.now() - startTime).toFixed(2)}ms, メッセージ数: ${messages.length}`);
      
      const userIds = [...new Set(messages.map(([_, msg]) => msg.userId))];
      const userStartTime = performance.now();
      const userDataPromises = userIds.map(async userId => {
        if (userCache.has(userId)) return { userId, data: userCache.get(userId) };
        const snapshot = await get(ref(database, `users/${userId}`));
        const data = snapshot.val() || {};
        userCache.set(userId, data);
        return { userId, data };
      });
      const userDataArray = await Promise.all(userDataPromises);
      console.log(`初期メッセージユーザー情報取得時間: ${(performance.now() - userStartTime).toFixed(2)}ms, ユーザー数: ${userIds.length}`);
      const userDataMap = Object.fromEntries(userDataArray.map(({ userId, data }) => [userId, data]));
      
      messagesEl.innerHTML = '';
      const renderStartTime = performance.now();
      for (const [key, { username, message, timestamp, userId, ipAddress }] of messages) {
        const isLatest = key === messages[messages.length - 1]?.[0];
        const provider = userDataMap[userId]?.provider || 'anonymous';
        const iconClass = provider === 'twitter.com' ? 'fa-brands fa-x-twitter' :
                         provider === 'google.com' ? 'fa-brands fa-google' :
                         'fa-solid fa-user-secret';
        const li = document.createElement('li');
        li.className = `list-group-item d-flex justify-content-start align-items-start border-0 ${isLatest ? 'latest-message pulse' : ''} fade-in`;
        li.setAttribute('data-message-id', key);
        li.setAttribute('role', 'listitem');
        li.setAttribute('data-timestamp', timestamp);
        const date = timestamp ? new Date(timestamp).toLocaleString('ja-JP') : '不明';
        li.innerHTML = `
          <div class="message bg-transparent p-3">
            <div class="message-header d-flex align-items-center">
              <i class="${iconClass} me-2 provider-icon"></i>
              <strong>${username || '匿名'}</strong>
              <small class="text-muted ms-2">${date}</small>
            </div>
            <div class="message-body">
              ${message ? message.replace(/\n/g, '<br>') : 'メッセージなし'}
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
      loadingIndicator.textContent = '読み込み中...';
      loadingIndicator.style.display = 'none';
    }
  }

  loadInitialMessages();

  onChildAdded(messagesRef, async (snapshot) => {
    try {
      const { username, message, timestamp, userId, ipAddress } = snapshot.val();
      const key = snapshot.key;
      if (messagesEl.querySelector(`[data-message-id="${key}"]`)) return;
      const userData = userCache.has(userId) ? userCache.get(userId) : (await get(ref(database, `users/${userId}`))).val() || {};
      userCache.set(userId, userData);
      const provider = userData.provider || 'anonymous';
      const iconClass = provider === 'twitter.com' ? 'fa-brands fa-x-twitter' :
                       provider === 'google.com' ? 'fa-brands fa-google' :
                       'fa-solid fa-user-secret';
      const li = document.createElement('li');
      li.className = `list-group-item d-flex justify-content-start align-items-start border-0 fade-in latest-message pulse`;
      li.setAttribute('data-message-id', key);
      li.setAttribute('role', 'listitem');
      li.setAttribute('data-timestamp', timestamp);
      const date = timestamp ? new Date(timestamp).toLocaleString('ja-JP') : '不明';
      li.innerHTML = `
        <div class="message bg-transparent p-3">
          <div class="message-header d-flex align-items-center">
            <i class="${iconClass} me-2 provider-icon"></i>
            <strong>${username || '匿名'}</strong>
            <small class="text-muted ms-2">${date}</small>
          </div>
          <div class="message-body">
            ${message ? message.replace(/\n/g, '<br>') : 'メッセージなし'}
          </div>
        </div>`;
      messagesEl.prepend(li);
      setTimeout(() => li.classList.add('show'), 10);
      if (!isUserScrolledUp) {
        messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
        newMessageBtn.classList.add('d-none');
      } else {
        newMessageBtn.classList.remove('d-none');
      }
    } catch (error) {
      console.error('新メッセージ追加エラー:', error);
      showError('メッセージの取得に失敗しました。');
    }
  });

  onValue(onlineUsersRef, () => {
    updateOnlineUsers();
  });

  auth.onAuthStateChanged(async (user) => {
    try {
      await updateUserUI(user);
    } catch (error) {
      console.error('認証状態変更エラー:', error);
      showError('認証状態の更新に失敗しました: ' + error.message);
    }
  });

  unameModalEl.addEventListener('hidden.bs.modal', () => {
    document.getElementById('login-btn')?.focus();
    unameModalEl.setAttribute('inert', '');
    console.log('unameModal非表示: フォーカスをlogin-btnに移動');
  });

  loginModalEl.addEventListener('hidden.bs.modal', () => {
    document.getElementById('login-btn')?.focus();
    loginModalEl.setAttribute('inert', '');
    console.log('loginModal非表示: フォーカスをlogin-btnに移動');
  });

  newMessageBtn.addEventListener('click', () => {
    messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
    isUserScrolledUp = false;
    newMessageBtn.classList.add('d-none');
    console.log('newMessageBtnクリック: 最上部にスクロール');
  });

  window.onload = () => {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      new bootstrap.Tooltip(el);
    });
  };
} catch (error) {
  console.error('Firebase初期化エラー:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  showError(`Firebaseの初期化に失敗しました: ${error.message}`);
}