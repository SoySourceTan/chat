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
    console.error('[utils.js] showError関数内でエラー:', error);
  }
}

/**
 * 成功メッセージを画面に表示します。指定されたDOM要素（デフォルトは`success-alert`）にメッセージをセットし、3秒後に非表示にします。
 * @param {string} message - 表示する成功メッセージ。
 * @param {HTMLElement} [successAlertElement=document.getElementById('success-alert')] - 成功メッセージを表示するDOM要素。
 * @returns {void}
 */
export function showSuccess(message, successAlertElement = document.getElementById('success-alert')) {
  try {
    if (successAlertElement) {
      successAlertElement.textContent = message;
      successAlertElement.classList.remove('d-none');
      setTimeout(() => {
        successAlertElement.classList.add('d-none');
      }, 3000);
    } else {
      console.warn('[utils.js] success-alert要素が見つかりませんでした。');
    }
  } catch (error) {
    console.error('[utils.js] showSuccess関数内でエラー:', error);
  }
}

/**
 * 短いトーストメッセージを画面に表示します。
 * @param {string} message - 表示するメッセージ。
 */
export function showToast(message) {
  try {
    // ★修正点: toast-container が存在しない場合、動的に作成するロジックを追加
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(toastContainer);
      console.log('[utils.js] toast-container要素を動的に作成しました。');
    }

    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-white bg-primary border-0 fade show';
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

    // BootstrapのToastインスタンスを作成し表示
    const bsToast = new bootstrap.Toast(toastEl, {
      delay: 3000
    });
    bsToast.show();

    // トーストが非表示になったらDOMから削除
    toastEl.addEventListener('hidden.bs.toast', () => {
      toastEl.remove();
    });
  } catch (error) {
    console.error('[utils.js] showToast関数内でエラー:', error);
  }
}


/**
 * クッキーを設定します。
 * @param {string} name - クッキーの名前。
 * @param {string} value - クッキーの値。
 * @param {number} days - クッキーの有効期限（日数）。
 */
export function setCookie(name, value, days) {
  try {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
  } catch (error) {
    console.error('[utils.js] setCookie関数内でエラー:', error);
  }
}

/**
 * クッキーの値を取得します。
 * @param {string} name - 取得するクッキーの名前。
 * @returns {string|null} クッキーの値。見つからない場合はnull。
 */
export function getCookie(name) {
  try {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  } catch (error) {
    console.error('[utils.js] getCookie関数内でエラー:', error);
    return null;
  }
}

/**
 * クライアントのIPアドレスを取得します。
 * @returns {Promise<string>} クライアントのIPアドレス。
 */
export async function getClientIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) {
      throw new Error(`HTTPエラー: ステータス ${response.status}`);
    }
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.warn('[utils.js] IPアドレス取得エラー:', error);
    return 'unknown';
  }
}

/**
 * モバイルデバイスかどうかを判定します。
 * @returns {boolean} モバイルデバイスであればtrue、そうでなければfalse。
 */
export function isMobileDevice() {
  try {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  } catch (error) {
    console.error('[utils.js] isMobileDevice関数内でエラー:', error);
    return false;
  }
}

/**
 * HTML属性として安全な文字列にエスケープします。
 * @param {string} str - エスケープする文字列。
 * @returns {string} エスケープされた文字列。
 */
export function escapeHTMLAttribute(str) {
  try {
    if (typeof str !== 'string') {
      console.warn('[utils.js] escapeHTMLAttribute: 文字列以外の値が渡されました:', str);
      return ''; // 文字列以外は空文字列を返すか、適切なデフォルト値を返す
    }
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  } catch (error) {
    console.error('[utils.js] escapeHTMLAttribute関数内でエラー:', error);
    return '';
  }
}

/**
 * プロフィール画像のURLをクリーンアップし、絶対パスに変換します。
 * 無効なURLの場合、現在のアプリケーションのベースパスに基づいたデフォルトのアイコンパスを返します。
 * @param {string} photoURL - クリーンアップするプロフィール画像のURL。
 * @returns {string} クリーンアップされた絶対URL、またはデフォルトのアイコンURL。
 */
export function cleanPhotoURL(photoURL) {
    // ★修正点: ベースパスの決定ロジックをより堅牢に
    // 常に window.location.origin をベースに、pathParts を正しく結合する
    function getAppBasePath() {
        let baseUrl = window.location.origin;
        const pathParts = window.location.pathname.split('/');
        const chatIndex = pathParts.indexOf('chat');

        if (chatIndex > -1) {
            // 例: https://localhost/learning/english-words/chat/
            // 結果: https://localhost/learning/english-words/chat/
            baseUrl += pathParts.slice(0, chatIndex + 1).join('/') + '/';
        } else {
            // 'chat' がパスに含まれない場合のフォールバック（例: ルート直下など）
            // 例: http://localhost/index.html -> http://localhost/
            // 例: http://localhost/some/page.html -> http://localhost/some/
            baseUrl += window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        }
        return baseUrl;
    }

    const basePath = getAppBasePath();

    // photoURLが有効な文字列でない場合は、デフォルトのアイコンパスを生成して返す
    if (typeof photoURL !== 'string' || photoURL.trim() === '') {
        console.warn('[utils.js] cleanPhotoURL: URLが無効または空です。デフォルト画像を使用します:', photoURL);
        return basePath + 'images/icon.png'; // デフォルトのアイコンパス
    }

    // 相対URLを絶対URLに変換
    if (photoURL.startsWith('./') || photoURL.startsWith('../')) {
        const absoluteUrl = new URL(photoURL, basePath).href;
        console.log('[utils.js] cleanPhotoURL: 相対URLとして処理:', photoURL, '変換後URL:', absoluteUrl);
        return absoluteUrl;
    }

    // ルート相対パス（例: /chat/images/icon.png）の場合
    if (photoURL.startsWith('/')) {
        const absoluteUrl = window.location.origin + photoURL;
        console.log('[utils.js] cleanPhotoURL: ルート相対URLとして処理:', photoURL, '変換後URL:', absoluteUrl);
        return absoluteUrl;
    }

    // 絶対URLはそのまま使用
    if (photoURL.startsWith('http://') || photoURL.startsWith('https://')) {
        console.log('[utils.js] cleanPhotoURL: 絶対URLをそのまま使用:', photoURL);
        return photoURL;
    }

    // その他の不明な形式の場合も、ベースパスを付与して試みる
    console.warn('[utils.js] cleanPhotoURL: 不明なURL形式です。ベースパスを付与して試みます:', photoURL);
    return basePath + photoURL;
}


/**
 * ユーザー名をクリーンアップします。
 * - 改行コード、タブ、連続する空白、および特定の特殊文字を除去し、単一の空白にまとめます。
 * - 前後の空白をトリムします。
 * - ユーザー名の中間にあるスペースも除去し、完全に連結された名前にします。
 * @param {string} username - クリーンアップするユーザー名。
 * @returns {string} クリーンアップされたユーザー名。
 */
export function cleanUsername(username) {
    if (typeof username !== 'string' || username.trim() === '') {
        return '匿名';
    }

    let cleaned = username;

    // 1. HTMLタグを除去（もし含まれている場合）
    cleaned = cleaned.replace(/<[^>]+>/g, '');

    // 2. 改行コード、タブ、連続する空白をすべて除去（単一のスペースにもしない）
    //    これにより「み みちこ」が「みちこ」になる
    cleaned = cleaned.replace(/[\n\t\s]+/g, '');

    // 3. 特定の「ゴミ」文字を除去
    //    例えば「?」や括弧など、ユーザー名に含めたくない文字をここに追加
    //    例: `?`, `(`, `)`, `[`, `]`, `{`, `}`, `@`, `#`, `$`, `%`, `^`, `&`, `*`, `+`, `=`, `|`, `\`, `<`, `>`, `,`, `.`, `/`, `~`, `!`
    //    今回はログで確認された「?」と、一般的な不要文字をいくつか追加します。
    //    必要に応じてこの正規表現を調整してください。
    cleaned = cleaned.replace(/[?!()\[\]{}@#$%^&*+=|\\<>,./~`!]/g, '');

    // 4. 前後の空白をトリム
    cleaned = cleaned.trim();

    // 5. 長すぎるユーザー名を短縮
    if (cleaned.length > 20) { // 例: 20文字以上は短縮
        cleaned = cleaned.substring(0, 20) + '...';
    }

    // 最終チェック: 空になった場合は「匿名」を返す
    if (cleaned === '') {
        return '匿名';
    }

    return cleaned;
}
