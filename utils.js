/**
 * エラーメッセージを画面に表示します。指定されたDOM要素（デフォルトは`error-alert`）にメッセージをセットし、6秒後に非表示にします。
 * @param {string} message - 表示するエラーメッセージ。
 * @param {HTMLElement} [errorAlertElement=document.getElementById('error-alert')] - エラーメッセージを表示するDOM要素。
 * @returns {void}
 * @example
 * showError('ログインに失敗しました', document.getElementById('error-alert'));
 * @remarks
 * - `script.js`で定義された`errorAlert`要素に依存。要素がない場合、コンソールに警告をログ。
 * - アクセシビリティのため、`role=alert`を付与し、フォーカスを設定。
 * - 主に認証エラーやメッセージ送信失敗時に使用。
 * @throws {Error} DOM操作中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function showError(message, errorAlertElement = document.getElementById('error-alert')) {
  try {
    if (errorAlertElement) {
      errorAlertElement.textContent = message;
      errorAlertElement.classList.remove('d-none');
      errorAlertElement.setAttribute('role', 'alert');
      errorAlertElement.focus();
      setTimeout(() => {
        errorAlertElement.classList.add('d-none');
        errorAlertElement.removeAttribute('role');
      }, 6000); // 修正: 000 -> 6000
    } else {
      console.warn('[utils.js] error-alert要素が見つかりませんでした。');
    }
  } catch (error) {
    console.error('[utils.js] showErrorエラー:', error);
  }
}

/**
 * 成功メッセージを画面に表示します。指定されたDOM要素（デフォルトは`success-toast`）にメッセージをセットし、3秒後に非表示にします。
 * @param {string} message - 表示する成功メッセージ。
 * @param {HTMLElement} [successToastElement=document.getElementById('success-toast')] - 成功メッセージを表示するDOM要素。
 * @returns {void}
 * @example
 * showSuccess('メッセージを送信しました');
 * @remarks
 * - `script.js`で定義された`success-toast`要素に依存。要素がない場合、コンソールに警告をログ。
 * - BootstrapのToastコンポーネントを使用。
 * @throws {Error} DOM操作中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function showSuccess(message, successToastElement = document.getElementById('success-toast')) {
  try {
    if (successToastElement) {
      const toastBody = successToastElement.querySelector('.toast-body');
      if (toastBody) {
        toastBody.textContent = message;
        const toast = new bootstrap.Toast(successToastElement, {
          autohide: true,
          delay: 3000
        });
        toast.show();
      } else {
        console.warn('[utils.js] success-toastの.toast-body要素が見つかりませんでした。');
      }
    } else {
      console.warn('[utils.js] success-toast要素が見つかりませんでした。');
    }
  } catch (error) {
    console.error('[utils.js] showSuccessエラー:', error);
  }
}

/**
 * トーストメッセージを表示します。
 * @param {string} message - 表示するメッセージ。
 * @param {string} [type='info'] - メッセージの種類 ('info', 'success', 'warning', 'danger')。
 */
export function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container'); // toast-container がHTMLにあると仮定
    if (!toastContainer) {
        console.warn('[utils.js] toast-container要素が見つかりませんでした。');
        // Fallback to showError if toast-container is not available
        if (type === 'danger' || type === 'warning') {
            showError(message);
        } else {
            showSuccess(message); // showSuccessはtoast-bodyに依存するため、完全な代替ではない
        }
        return;
    }

    const toastEl = document.createElement('div');
    toastEl.classList.add('toast', `bg-${type}`, 'text-white', 'border-0');
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    toastContainer.appendChild(toastEl);

    const toast = new bootstrap.Toast(toastEl, {
        autohide: true,
        delay: 3000
    });
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

/**
 * クッキーから値を取得します。
 * @param {string} name - 取得するクッキーの名前。
 * @returns {string|null} クッキーの値、または見つからない場合はnull。
 */
export function getCookie(name) {
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            const value = c.substring(nameEQ.length, c.length);
            try {
                return decodeURIComponent(value);
            } catch (e) {
                console.error(`[utils.js] クッキーのデコードエラー: ${e}`);
                return value;
            }
        }
    }
    return null;
}

/**
 * クッキーに値を設定します。
 * @param {string} name - 設定するクッキーの名前。
 * @param {string} value - 設定する値。
 * @param {number} [days] - クッキーの有効期限（日数）。指定しない場合はセッションクッキー。
 */
export function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/`;
}

/**
 * ユーザーのIPアドレスを取得します。
 * @returns {Promise<string>} IPアドレスのPromise。
 */
export async function getClientIp() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || '不明';
    } catch (error) {
        console.warn('[utils.js] IPアドレスの取得に失敗しました:', error);
        return '不明';
    }
}

/**
 * モバイルデバイスかどうかを判定します。
 * @returns {boolean} モバイルデバイスであればtrue。
 */
export function isMobileDevice() {
    return /Mobi|Android/i.test(navigator.userAgent);
}

/**
 * HTML属性として安全な文字列にエスケープします。
 * @param {string} str - エスケープする文字列。
 * @returns {string} エスケープされた文字列。
 */
export function escapeHTMLAttribute(str) {
    if (typeof str !== 'string') {
        return '';
    }
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * プロフィール画像のURLをクリーンアップし、絶対URLに変換します。
 * TwitterやGoogleの画像URLのサイズ調整を行います。
 * @param {string} url - プロフィール画像のURL。
 * @returns {string|null} クリーンアップされた絶対URL、または無効な場合はnull。
 */
export function cleanPhotoURL(url) {
    if (!url || typeof url !== 'string') {
        console.warn('[utils.js] cleanPhotoURL: 無効なURL入力:', url);
        return null;
    }

    let processedUrl = url.split('?')[0]; // クエリパラメータを削除

    // Twitterの画像URL処理
    if (processedUrl.includes('pbs.twimg.com/profile_images/')) {
        // サイズ指定を _400x400 に統一（_normal, _bigger, _mini などを置換）
        processedUrl = processedUrl.replace(/(_normal|_bigger|_mini)?(\.[a-zA-Z0-9]+)$/, '_400x400$2');
    }
    // Googleの画像URL処理
    else if (processedUrl.includes('googleusercontent.com/a/')) {
        processedUrl = processedUrl.replace(/=s\d+(-\w)?/, '=s400');
    }

    // 絶対URLかどうかをチェック
    try {
        // すでに絶対URLの場合、そのまま返す
        const urlObj = new URL(processedUrl);
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
            console.log('[utils.js] cleanPhotoURL: 絶対URLをそのまま使用:', processedUrl);
            return processedUrl;
        }
    } catch (e) {
        // 相対URLの場合、baseUrlを適用
        console.log('[utils.js] cleanPhotoURL: 相対URLとして処理:', processedUrl);
    }

    // baseUrlの構築
    let baseUrl = window.location.origin;
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        const pathParts = window.location.pathname.split('/');
        const chatIndex = pathParts.indexOf('chat');
        if (chatIndex > -1) {
            baseUrl += pathParts.slice(0, chatIndex + 1).join('/') + '/';
        } else {
            baseUrl += window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        }
    } else if (baseUrl.includes('github.io') || baseUrl.includes('trextacy.com')) {
        baseUrl += '/chat/';
    }

    try {
        const absoluteUrl = new URL(processedUrl, baseUrl).href;
        console.log('[utils.js] cleanPhotoURL: 変換後URL:', absoluteUrl);
        return absoluteUrl;
    } catch (e) {
        console.error(`[utils.js] cleanPhotoURL: URL変換エラー - URL: ${processedUrl}, ベース: ${baseUrl}, エラー: ${e}`);
        return null;
    }
}

/**
 * ユーザー名をクリーンアップします。
 * - 改行コード、タブ、連続する空白を除去し、単一の空白にまとめます。
 * - 前後の空白をトリムします。
 * @param {string} username - クリーンアップするユーザー名。
 * @returns {string} クリーンアップされたユーザー名。
 */
export function cleanUsername(username) {
    if (typeof username !== 'string' || username.trim() === '') {
        return '匿名';
    }
    // 改行コード、タブをスペースに置き換え、連続するスペースを単一のスペースにまとめる
    let cleaned = username.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
    // 「?」やその他の特殊文字を除去
    cleaned = cleaned.replace(/[?¿¡]+/g, '');
    // 絵文字や制御文字など、Unicodeの文字と数字、スペース以外の文字を除去
    cleaned = cleaned.replace(/[^\p{L}\p{N}\s]/gu, '');
    // 長さが0の場合は「匿名」を返す
    return cleaned.length > 0 ? cleaned : '匿名';
}