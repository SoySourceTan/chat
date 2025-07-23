/**
 * エラーメッセージを画面に表示します。指定されたDOM要素（デフォルトは`error-alert`）にメッセージをセットし、6秒後に非表示にします。
 * @param {string} message - 表示するエラーメッセージ。
 * @param {HTMLElement} [errorAlertElement=document.getElementById('error-alert')] - エラーメッセージを表示するDOM要素。
 * @returns {void}
 * @example
 *   showError('ログインに失敗しました', document.getElementById('error-alert'));
 * @remarks
 *   - `script.js`で定義された`errorAlert`要素に依存。要素がない場合、コンソールに警告をログ。
 *   - アクセシビリティのため、`role=alert`を付与し、フォーカスを設定。
 *   - 主に認証エラーやメッセージ送信失敗時に使用。
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
      console.warn('[utils.js] error-alert要素が見つかりません');
    }
  } catch (error) {
    console.error('[utils.js] エラーメッセージ表示エラー:', error);
  }
}

/**
 * 成功メッセージを画面中央上部に一時的に表示します。3秒後に自動で消滅。
 * @param {string} message - 表示する成功メッセージ。
 * @returns {void}
 * @example
 *   showSuccess('ログインに成功しました');
 * @remarks
 *   - Bootstrapの`alert-success`クラスを使用し、固定位置で表示。
 *   - ログイン成功やユーザー名更新成功時に使用。
 *   - 動的に`div`要素を作成し、DOMに追加後、自動削除。
 * @throws {Error} DOM操作中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function showSuccess(message) {
  try {
    const successAlert = document.createElement('div');
    successAlert.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x m-3';
    successAlert.style.zIndex = '2000';
    successAlert.setAttribute('role', 'alert');
    successAlert.textContent = message;
    document.body.appendChild(successAlert);
    setTimeout(() => successAlert.remove(), 3000);
  } catch (error) {
    console.error('[utils.js] 成功メッセージ表示エラー:', error);
  }
}

/**
 * 情報通知を画面右下にトースト形式で表示します。3秒後に自動で消滅。
 * @param {string} message - 表示する通知メッセージ。
 * @returns {void}
 * @example
 *   showToast('メッセージが削除されました');
 * @remarks
 *   - Bootstrapの`alert-info`クラスを使用し、右下に固定表示。
 *   - メッセージ削除や軽微な通知に使用。
 *   - 動的に`div`要素を作成し、DOMに追加後、自動削除。
 * @throws {Error} DOM操作中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function showToast(message) {
  try {
    const toast = document.createElement('div');
    toast.className = 'alert alert-info position-fixed bottom-0 end-0 m-3';
    toast.style.zIndex = '2000';
    toast.setAttribute('role', 'alert');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  } catch (error) {
    console.error('[utils.js] トースト通知エラー:', error);
  }
}

/**
 * クライアントのIPアドレスを外部APIから取得します。
 * @returns {Promise<string>} 取得したIPアドレス（失敗時は'unknown'）。
 * @example
 *   const ip = await getClientIp(); // '192.168.0.1' または 'unknown'
 * @remarks
 *   - `https://api.ipify.org`を使用。CORS対応のため`mode: 'cors'`を指定。
 *   - ユーザー認証やログ記録（例：ログイン時の`actionsRef`）で使用。
 *   - ネットワークエラーやAPI制限に備え、'unknown'をフォールバックとして返す。
 * @throws {Error} ネットワークエラーやAPI応答エラーが発生した場合、コンソールにエラーをログ。
 */
export async function getClientIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json', { mode: 'cors' });
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.error('[utils.js] IP取得エラー:', error);
    return 'unknown';
  }
}

/**
 * クッキーを設定します。指定した日数で有効期限を管理。
 * @param {string} name - クッキーの名前。
 * @param {string} value - クッキーの値。
 * @param {number} [days] - クッキーの有効期限（日数）。未指定時はセッションクッキー。
 * @returns {void}
 * @example
 *   setCookie('enterSendMode', 'true', 365);
 * @remarks
 *   - `SameSite=Strict`でセキュリティを強化。
 *   - ユーザー設定（例：`colorAssignmentMode`, `enterSendMode`）の永続化に使用。
 *   - 値は`encodeURIComponent`でエスケープし、特殊文字を安全に処理。
 * @throws {Error} クッキー設定中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function setCookie(name, value, days) {
  try {
    const expires = days ? `; expires=${new Date(Date.now() + days * 86400000).toUTCString()}` : '';
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Strict`;
    console.log(`[utils.js] クッキー設定: ${name}=${value}, expires=${expires}`);
  } catch (error) {
    console.error('[utils.js] クッキー設定エラー:', error);
  }
}

/**
 * 指定した名前のクッキーを取得します。
 * @param {string} name - 取得するクッキーの名前。
 * @returns {string|null} クッキーの値。存在しない場合はnull。
 * @example
 *   const mode = getCookie('enterSendMode'); // 'true' または null
 * @remarks
 *   - ユーザー設定の読み込み（例：背景色モード、送信モード）に使用。
 *   - 値は`decodeURIComponent`でデコードし、特殊文字を復元。
 *   - クッキーが存在しない、または無効な場合はnullを返す。
 * @throws {Error} クッキー取得中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function getCookie(name) {
  try {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    const value = match ? decodeURIComponent(match[2]) : null;
    console.log(`[utils.js] クッキー取得: ${name}=${value}`);
    return value;
  } catch (error) {
    console.error('[utils.js] クッキー取得エラー:', error);
    return null;
  }
}

/**
 * ユーザーのデバイスがモバイルかどうかを判定します。
 * @returns {boolean} モバイルデバイスの場合はtrue、それ以外の場合はfalse。
 * @example
 *   if (isMobileDevice()) { console.log('モバイルデバイスです'); }
 * @remarks
 *   - `navigator.userAgent`を基に、一般的なモバイルデバイスのパターンを検出。
 *   - UI調整（例：仮想キーボードの処理）やレスポンシブデザインに使用。
 *   - 正規表現でAndroid, iOS, その他のモバイルデバイスを判定。
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
 * HTML属性用の文字列をエスケープします。セキュリティを確保し、XSSを防止。
 * @param {string} str - エスケープする文字列。
 * @returns {string} エスケープされた文字列。入力が無効な場合は空文字。
 * @example
 *   const safeStr = escapeHTMLAttribute('<script>alert("XSS")</script>'); // '<script>alert("XSS")</script>'
 * @remarks
 *   - シングルクォート、ダブルクォート、HTMLタグをエスケープ。
 *   - メッセージやユーザー名のHTML属性（例：`alt`, `title`）に使用。
 *   - 入力が文字列でない、または空の場合は空文字を返す。
 * @throws {Error} エスケープ処理中にエラーが発生した場合、コンソールにエラーをログ。
 */
export function escapeHTMLAttribute(str) {
  try {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/</g, '<').replace(/>/g, '>');
  } catch (error) {
    console.error('[utils.js] HTML属性エスケープエラー:', error);
    return '';
  }
}