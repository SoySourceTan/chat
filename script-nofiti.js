import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase, ref, push, onChildAdded, set, get, query, orderByChild, limitToLast, endAt, onValue, onDisconnect, remove, update, onChildRemoved } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { getAuth, GoogleAuthProvider, TwitterAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { initNotifications, notifyNewMessage, sendNotification } from './notify.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js';

// ... (既存のコードはそのまま)

// メッセージ送信
if (formEl) {
    formEl.removeEventListener('submit', formEl._submitHandler);
    formEl._submitHandler = async (e) => {
        try {
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
            const userData = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
            const username = userInfo.textContent.replace(/<[^>]+>/g, '').trim();
            const timestamp = Date.now();
            const tempMessageId = `temp-${timestamp}-${Math.random().toString(36).slice(2)}`;
            const li = document.createElement('li');
            li.className = `list-group-item p-0 m-0 border shadow-sm mb-3 d-flex justify-content-start align-items-start border-0 fade-in latest-message pulse mb-3`;
            li.setAttribute('data-message-id', tempMessageId);
            li.setAttribute('data-user-id', auth.currentUser.uid);
            li.setAttribute('role', 'listitem');
            li.setAttribute('data-timestamp', timestamp);
            const date = new Date(timestamp).toLocaleString('ja-JP');
            const formattedMessage = formatMessage(message);
            li.innerHTML = `
                <div class="message bg-transparent p-2 row">
                    <div class="col-auto profile-icon">
                        ${userData.photoURL ? 
                            `<img src="${escapeHTMLAttribute(userData.photoURL)}" alt="${escapeHTMLAttribute(username)}のプロフィール画像" class="profile-img" onerror="handleImageError(this, '${escapeHTMLAttribute(auth.currentUser.uid)}', '${escapeHTMLAttribute(username)}', '${escapeHTMLAttribute(userData.photoURL)}')">` :
                            `<div class="avatar">${username.charAt(0).toUpperCase()}</div>`}
                    </div>
                    <div class="col-auto message-header p-0 m-0 d-flex align-items-center">
                        <strong>${escapeHTMLAttribute(username)}</strong>
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const messageRef = await push(messagesRef, {
                username,
                message,
                timestamp,
                userId: auth.currentUser.uid,
                ipAddress: userData.ipAddress || 'unknown'
            });
            const tempMessage = messagesEl.querySelector(`[data-message-id="${tempMessageId}"]`);
            if (tempMessage) {
                tempMessage.setAttribute('data-message-id', messageRef.key);
                const deleteButton = tempMessage.querySelector('.delete-message');
                if (deleteButton) {
                    deleteButton.setAttribute('data-message-id', messageRef.key);
                }
            }
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
            // 通知送信
            try {
                const notificationTitle = `新しいメッセージ from ${username}`;
                const notificationBody = message.length > 50 ? message.substring(0, 47) + '...' : message;
                await sendNotification(
                    null, // 全ユーザー対象
                    notificationTitle,
                    notificationBody,
                    { url: 'https://trextacy.com/chat' },
                    auth.currentUser.uid // 送信者ID
                );
                console.log('通知送信成功:', { title: notificationTitle, body: notificationBody });
            } catch (notificationError) {
                console.error('通知送信エラー:', notificationError);
                showError('通知の送信に失敗しました。');
            }
            inputEl.value = '';
            formEl.classList.remove('was-validated');
            isUserScrolledUp = false;
            newMessageBtn.classList.add('d-none');
            if ('virtualKeyboard' in navigator) {
                navigator.virtualKeyboard.hide();
                formEl.style.bottom = '10px';
                messagesEl.style.maxHeight = '';
            }
            requestAnimationFrame(() => {
                messagesEl.scrollTo({ top: 0, behavior: 'smooth' });
                console.log('メッセージ送信後: トップにスクロール');
            });
            setTimeout(() => inputEl.focus(), 100);
        } catch (error) {
            console.error('メッセージ送信エラー:', error);
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

// ... (残りのコードはそのまま)