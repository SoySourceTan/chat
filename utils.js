// Helper to get base path dynamically.
// This function determines the base URL for the application,
// which is crucial for resolving relative paths (e.g., for images).
export function getBasePath() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const pathParts = window.location.pathname.split('/');
    const chatIndex = pathParts.indexOf('chat');

    let calculatedPath;

    if (isLocalhost) {
        if (chatIndex > -1) {
            // 例: http://localhost/learning/english-words/chat/ -> http://localhost/learning/english-words/chat/
            calculatedPath = pathParts.slice(0, chatIndex + 1).join('/') + '/';
        } else {
            // ローカル開発環境で 'chat' がパスに含まれない場合のフォールバック
            // (例: http://localhost/ や http://localhost/index.html)。
            // この場合、現在のディレクトリをベースとします。
            calculatedPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        }
    } else {
        // デプロイ版 (例: GitHub Pages, trextacy.com)
        if (chatIndex > -1) {
            // 例: https://soysourcetan.github.io/chat/ -> https://soysourcetan.github.io/chat/
            calculatedPath = pathParts.slice(0, chatIndex + 1).join('/') + '/';
        } else {
            // デプロイ版で 'chat' がパスに含まれない場合、ルートまたは現在のディレクトリを想定
            // 専用のチャットアプリでは稀なケースかもしれませんが、柔軟性のため。
            calculatedPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        }
    }
    // パスがスラッシュで始まり、スラッシュで終わることを保証
    if (!calculatedPath.startsWith('/')) {
        calculatedPath = '/' + calculatedPath;
    }
    if (!calculatedPath.endsWith('/') && calculatedPath !== '/') {
        calculatedPath = calculatedPath + '/';
    }

    return window.location.origin + calculatedPath;
}


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
            }, 6000);
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
 * @remarks この関数はBootstrap 5のToastコンポーネントに依存します。BootstrapのJavaScriptが事前にロードされている必要があります。
 */
export function showToast(message) {
    try {
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
        // Bootstrapがロードされていない、またはエラーが発生した場合のフォールバック
        alert(message);
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
        // replaceAll を使用して、複数回の置換をより効率的に行う
        return div.innerHTML.replaceAll('"', '&quot;').replaceAll("'", '&#39;');
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
    const basePath = getBasePath(); // 例: https://localhost/learning/english-words/chat/
    const defaultIconRelativePath = 'images/icon.png'; // Relative to basePath

    // Handle invalid or empty photoURL by returning a default image URL relative to basePath
    if (typeof photoURL !== 'string' || photoURL.trim() === '') {
        console.warn('[utils.js] cleanPhotoURL: URLが無効または空です。デフォルト画像を使用します:', photoURL);
        return new URL(defaultIconRelativePath, basePath).href;
    }

    try {
        // If photoURL is already an absolute URL (starts with http:// or https://), return it as is.
        if (photoURL.startsWith('http://') || photoURL.startsWith('https://')) {
            console.log('[utils.js] cleanPhotoURL: 絶対URLをそのまま使用:', photoURL);
            return photoURL;
        }

        // For relative photoURLs, we need to correctly combine it with the basePath,
        // preventing duplication of path segments like 'chat/'.

        // Get the pathname part of the basePath (e.g., "/learning/english-words/chat/")
        const basePathname = new URL(basePath).pathname;

        let processedPhotoURL = photoURL;

        // If photoURL starts with the full basePathname (e.g., "/learning/english-words/chat/images/icon.png")
        // and basePathname is not just "/", remove the redundant prefix to avoid duplication.
        if (basePathname !== '/' && processedPhotoURL.startsWith(basePathname)) {
            processedPhotoURL = processedPhotoURL.substring(basePathname.length);
        }
        // If photoURL is root-relative (starts with '/') but doesn't contain basePathname,
        // and it starts with the last segment of the basePathname (e.g., "/chat/images/icon.png" when basePath ends in "/chat/")
        // remove that leading segment to make it truly relative to the basePath.
        const pathSegments = basePathname.split('/').filter(s => s !== '');
        const lastBasePathSegment = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';

        if (lastBasePathSegment && processedPhotoURL.startsWith(`/${lastBasePathSegment}/`)) {
            processedPhotoURL = processedPhotoURL.substring(`/${lastBasePathSegment}/`.length);
        } else if (lastBasePathSegment && processedPhotoURL.startsWith(`${lastBasePathSegment}/`)) {
            // Also handle 'chat/images/icon.png' without leading slash
            processedPhotoURL = processedPhotoURL.substring(`${lastBasePathSegment}/`.length);
        }
        
        // Ensure processedPhotoURL does not start with '/' if it's meant to be relative to basePath
        if (processedPhotoURL.startsWith('/') && processedPhotoURL.length > 1) {
             processedPhotoURL = processedPhotoURL.length > 0 ? processedPhotoURL.substring(1) : '';
        }

        // Construct the final URL using the URL constructor, which handles normalization.
        // The second argument to URL constructor acts as the base URL.
        const finalUrl = new URL(processedPhotoURL, basePath).href;
        console.log('[utils.js] cleanPhotoURL: 相対URLを変換後:', finalUrl);
        return finalUrl;

    } catch (error) {
        console.error('[utils.js] cleanPhotoURL: URL処理中にエラーが発生しました。デフォルト画像を使用します:', error);
        return new URL(defaultIconRelativePath, basePath).href;
    }
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

/**
 * タイムスタンプを「〇〇時間前」「〇〇分前」のような形式に変換します。
 * @param {number} timestamp - 変換するUnixタイムスタンプ (ミリ秒)。
 * @returns {string} 変換された「〇〇前」形式の文字列。
 */
export function timestampToTimeAgo(timestamp) {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);

    if (seconds < 60) {
        return `${seconds}秒前`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}分前`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}時間前`;
    }

    const days = Math.floor(hours / 24);
    if (days < 30) {
        return `${days}日前`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
        return `${months}ヶ月前`;
    }

    const years = Math.floor(months / 12);
    return `${years}年前`;
}

/**
 * 日付と時刻を指定された形式でフォーマットします。
 * @param {Date|number} dateInput - フォーマットするDateオブジェクトまたはUnixタイムスタンプ (ミリ秒)。
 * @param {object} [options] - Intl.DateTimeFormatのオプション。
 * @returns {string} フォーマットされた日付と時刻の文字列。
 */
export function formatDate(dateInput, options) {
    const date = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    const defaultOptions = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 24時間表示
    };
    const formatter = new Intl.DateTimeFormat('ja-JP', { ...defaultOptions, ...options });
    return formatter.format(date);
}

/**
 * 関数呼び出しを一定時間遅延させ、その間に複数回呼び出されても最後の呼び出しのみを実行します。
 * 主にリサイズイベントや入力イベントの最適化に利用されます。
 * @param {Function} func - デバウンス対象の関数。
 * @param {number} delay - 遅延時間 (ミリ秒)。
 * @returns {Function} デバウンスされた関数。
 */
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}