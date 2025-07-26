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
 * 成功メッセージを画面にトーストとして表示します。
 * @param {string} message - 表示する成功メッセージ。
 * @returns {void}
 * @example
 * showSuccess('メッセージを送信しました！');
 * @remarks
 * - BootstrapのToastコンポーネントを使用。
 * - `script.js`で定義された`successToast`要素に依存。要素がない場合、コンソールに警告をログ。
 * - 主にメッセージ送信成功、ユーザー名更新成功時に使用。
 * @throws {Error} DOM操作中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function showSuccess(message) {
  try {
    const successToastEl = document.getElementById('successToast');
    if (successToastEl) {
      const toastBody = successToastEl.querySelector('.toast-body');
      if (toastBody) {
        toastBody.textContent = message;
        const successToast = new bootstrap.Toast(successToastEl);
        successToast.show();
      } else {
        console.warn('[utils.js] successToastのbody要素が見つかりませんでした。');
      }
    } else {
      console.warn('[utils.js] successToast要素が見つかりませんでした。');
    }
  } catch (error) {
    console.error('[utils.js] showSuccessエラー:', error);
  }
}

/**
 * 画面下部に短時間表示されるトーストメッセージを表示します。
 * @param {string} message - 表示するメッセージ。
 * @returns {void}
 * @example
 * showToast('アイテムが追加されました！');
 * @remarks
 * - BootstrapのToastコンポーネントを使用。
 * - `liveToast`というIDの要素に依存。
 * - ユーザーへの軽いフィードバックに使用。
 * @throws {Error} DOM操作中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function showToast(message) {
  try {
    const toastEl = document.getElementById('liveToast');
    if (toastEl) {
      const toastBody = toastEl.querySelector('.toast-body');
      if (toastBody) {
        toastBody.textContent = message;
        const toast = new bootstrap.Toast(toastEl, { delay: 2000 }); // 2秒表示
        toast.show();
      } else {
        console.warn('[utils.js] liveToastのbody要素が見つかりませんでした。');
      }
    } else {
      console.warn('[utils.js] liveToast要素が見つかりませんでした。');
    }
  } catch (error) {
    console.error('[utils.js] showToastエラー:', error);
  }
}

/**
 * クライアントのIPアドレスを取得します。
 * @returns {Promise<string>} IPアドレスの文字列。取得失敗時は'unknown'。
 * @example
 * const ip = await getClientIp();
 * console.log(ip); // '192.0.2.1'
 * @remarks
 * - 外部API (`https://api.ipify.org?format=json`) を使用してIPアドレスを取得。
 * - ネットワークエラーやAPIからの不正なレスポンスを考慮。
 * - 主にユーザーのアクションログ記録に使用。
 * @throws {Error} fetch操作中にエラーが発生した場合、コンソールにエラーをログ。
 */
export async function getClientIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status}`);
    }
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.error('[utils.js] IPアドレス取得エラー:', error);
    return 'unknown';
  }
}

/**
 * クッキーを設定します。
 * @param {string} name - クッキーの名前。
 * @param {string} value - クッキーの値。
 * @param {number} days - クッキーの有効期限（日数）。
 * @returns {void}
 * @example
 * setCookie('username', 'JohnDoe', 7); // 7日間有効なusernameクッキーを設定
 * @remarks
 * - `encodeURIComponent`を使用して値が正しくエンコードされるようにします。
 * - 有効期限はUTCで設定。
 * @throws {Error} クッキー設定中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function setCookie(name, value, days) {
  try {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/`;
    console.log(`[utils.js] クッキー設定: ${name}=${value}`);
  } catch (error) {
    console.error('[utils.js] クッキー設定エラー:', error);
  }
}

/**
 * クッキーの値を取得します。
 * @param {string} name - 取得するクッキーの名前。
 * @returns {string|null} クッキーの値。見つからない場合はnull。
 * @example
 * const username = getCookie('username');
 * console.log(username); // 'JohnDoe' または null
 * @remarks
 * - `decodeURIComponent`を使用して値が正しくデコードされるようにします。
 * - クッキー文字列を分割して目的のクッキーを検索。
 * @throws {Error} クッキー取得中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function getCookie(name) {
  try {
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        const value = c.substring(nameEQ.length, c.length);
        console.log(`[utils.js] クッキー取得: ${name}=${value}`);
        return decodeURIComponent(value);
      }
    }
    console.log(`[utils.js] クッキー取得: ${name}=null`);
    return null;
  } catch (error) {
    console.error('[utils.js] クッキー取得エラー:', error);
    return null;
  }
}

/**
 * ユーザーのデバイスがモバイルかどうかを判定します。
 * @returns {boolean} モバイルデバイスの場合はtrue、それ以外の場合はfalse。
 * @example
 * if (isMobileDevice()) { console.log('モバイルデバイスです'); }
 * @remarks
 * - `navigator.userAgent`を基に、一般的なモバイルデバイスのパターンを検出。
 * - UI調整（例：仮想キーボードの処理）やレスポンシブデザインに使用。
 * - 正規表現でAndroid, iOS, その他のモバイルデバイスを判定。
 * @throws {Error} ユーザーエージェントの解析中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function isMobileDevice() {
  try {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  } catch (error) {
    console.error('[utils.js] デバイス判定エラー:', error);
    return false;
  }
}

/**
 * HTML属性値およびJavaScript文字列リテラルとして安全になるように文字列をエスケープします。
 * 主に `onerror="handleFunction(..., 'escapedString')"` のようにHTML属性内のJSコードで文字列を扱う際に使用します。
 * @param {string} str - エスケープする文字列。
 * @returns {string} エスケープされた文字列。入力が無効な場合は空文字。
 * @example
 * const safeStr = escapeHTMLAttribute('<script>alert("XSS")</script>');
 * @remarks
 * - `&`, `<`, `>`, `"`, `'`, `/`, `` ` `` をHTMLエンティティまたはJavaScriptセーフな形式に変換。
 * - DOMPurifyなどのライブラリと組み合わせて使用することで、より強固なセキュリティを実現。
 * @throws {Error} 文字列エスケープ中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function escapeHTMLAttribute(str) {
    try {
        if (typeof str !== 'string') {
            console.warn('[utils.js] escapeHTMLAttribute: 文字列以外の入力が検出されました。', str);
            return ''; // 文字列以外は空文字を返す
        }
        // HTML属性値およびJavaScript文字列リテラルとして安全になるようにエスケープする
        return str
            .replace(/&/g, '&amp;')    // & を &amp; に
            .replace(/"/g, '&quot;')   // " を &quot; に
            .replace(/'/g, '&#39;')    // ' を &#39; に (HTML属性内のJS文字列リテラル向け)
            .replace(/</g, '&lt;')     // < を &lt; に
            .replace(/>/g, '&gt;')     // > を &gt; に
            .replace(/\//g, '&#x2F;')  // / を &#x2F; に (XSS対策)
            .replace(/`/g, '&#96;');   // ` を &#96; に (テンプレートリテラル対策)
    } catch (error) {
        console.error('[utils.js] escapeHTMLAttributeエラー:', error);
        return '';
    }
}

/**
 * URLからクエリパラメータを削除します。
 * @param {string} url - クエリパラメータを削除するURL。
 * @returns {string} クエリパラメータが削除されたURL。無効なURLの場合は元のURLを返します。
 * @example
 * cleanPhotoURL('https://example.com/image.jpg?size=small&t=123'); // 'https://example.com/image.jpg'
 * @remarks
 * - URLオブジェクトを使用して、安全かつ正確にクエリパラメータを操作します。
 * - `URL`コンストラクタが例外をスローする可能性があるため、try-catchブロックで囲んでいます。
 */
export function cleanPhotoURL(url) {
  try {
    if (typeof url !== 'string' || url.trim() === '') {
      console.warn('[utils.js] cleanPhotoURL: 無効なURLが検出されました。', url);
      return url; // 無効なURLの場合はそのまま返すか、空文字などを返す
    }

    let absoluteUrl = url;
    // 相対URLの場合、絶対URLに変換
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      // 適切なベースURLを決定 (例: window.location.origin)
      // 環境に応じて 'https://soysourcetan.github.io/chat/' や 'https://localhost/learning/english-words/chat/' を動的に構築
      let baseUrl = window.location.origin;
      if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
          // ローカルホストの場合、パスの調整が必要かもしれない
          // 例: http://localhost/learning/english-words/chat/images/icon.png
          // window.location.pathname を利用して '/learning/english-words/chat/' の部分を取得する
          const pathParts = window.location.pathname.split('/');
          const chatIndex = pathParts.indexOf('chat');
          if (chatIndex > -1) {
              baseUrl += pathParts.slice(0, chatIndex + 1).join('/');
          } else {
              // chat がパスに含まれない場合、現在のパスをそのまま使う
              baseUrl += window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
          }
      } else if (baseUrl.includes('github.io')) {
          baseUrl += '/chat/';
      } else if (baseUrl.includes('trextacy.com')) {
          baseUrl += '/chat/';
      }

      try {
        absoluteUrl = new URL(url, baseUrl).href;
      } catch (e) {
        console.error(`[utils.js] cleanPhotoURL: 相対URLを絶対URLに変換中にエラーが発生しました。URL: ${url}, ベース: ${baseUrl}, エラー: ${e}`);
        return url; // 変換失敗時は元のURLを返す
      }
    }

    const urlObj = new URL(absoluteUrl);
    urlObj.search = ''; // クエリパラメータを削除
    return urlObj.href;
  } catch (error) {
    console.error('[utils.js] cleanPhotoURLエラー:', error);
    return url;
  }
}