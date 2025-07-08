import { getDatabase, ref, set, onValue, remove } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';

const database = getDatabase();
const typingStatusRef = ref(database, 'typingStatus');

function updateTypingStatus(userId, username, isTyping) {
  if (!userId) return;
  const userTypingRef = ref(database, `typingStatus/${userId}`);
  if (isTyping) {
    set(userTypingRef, {
      username,
      isTyping: true,
      timestamp: Date.now()
    }).catch(error => console.error('入力状態更新エラー:', error));
  } else {
    remove(userTypingRef).catch(error => console.error('入力状態削除エラー:', error));
  }
}

function monitorTypingStatus(typingIndicatorEl) {
  onValue(typingStatusRef, (snapshot) => {
    const typingData = snapshot.val();
    const typingUsers = typingData ? Object.values(typingData).filter(data => 
      data.isTyping && (Date.now() - data.timestamp < 10000) // 10秒以内のデータのみ
    ) : [];
    
    if (typingUsers.length > 0) {
      const usernames = typingUsers.map(data => data.username || '匿名').join(', ');
      typingIndicatorEl.textContent = `${usernames}が入力中...`;
      typingIndicatorEl.classList.remove('d-none');
    } else {
      typingIndicatorEl.textContent = '';
      typingIndicatorEl.classList.add('d-none');
    }
  });
}

function initTypingMonitor(inputEl, typingIndicatorEl, getUser) {
  let typingTimeout = null;
  
  inputEl.addEventListener('input', () => {
    const user = getUser();
    if (!user) return;
    
    updateTypingStatus(user.uid, user.username, true);
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      updateTypingStatus(user.uid, user.username, false);
    }, 5000); // 5秒入力がないと停止
  });
  
  inputEl.addEventListener('blur', () => {
    const user = getUser();
    if (user) {
      updateTypingStatus(user.uid, user.username, false);
    }
  });
  
  monitorTypingStatus(typingIndicatorEl);
}

export { initTypingMonitor };