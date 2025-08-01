// 修正後の utils.js
// このファイルは、アプリケーションで共通して使用されるユーティリティ関数群を提供します。

/**
 * Helper to get base path dynamically.
 * This function determines the base URL for the application,
 * which is crucial for resolving relative paths (e.g., for images).
 * @returns {string} The calculated base path.
 */
/**
 * Helper to get base path dynamically based on the deployment environment.
 * This function determines the base URL for the application,
 * which is crucial for resolving relative paths (e.g., for images).\
 * It returns the correct base path for both localhost and GitHub Pages.
 * @returns {string} The calculated base path (always ends with a slash).
 */
export function getBasePath() {
    try {
        const hostname = window.location.hostname;
        let basePath = '';

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Localhost 環境の場合
            // 正しいパスは 'https://localhost/learning/english-words/chat/'
            basePath = window.location.origin + '/learning/english-words/chat/';
        } else if (hostname === 'soysourcetan.github.io') {
            // GitHub Pages 環境の場合
            // 正しいパスは 'https://soysourcetan.github.io/chat/'
            basePath = window.location.origin + '/chat/';
        } else {
            // その他の環境や予期せぬホスト名の場合のフォールバック
            // 最も汎用的な「現在のページのディレクトリ」を返すか、
            // またはドメインのルートを返す
            const fullUrl = window.location.href;
            const lastSlashIndex = fullUrl.lastIndexOf('/');
            basePath = fullUrl.substring(0, lastSlashIndex + 1);
            if (!basePath.endsWith('/')) {
                basePath += '/';
            }
            console.warn(`[getBasePath] 未知のホスト名 '${hostname}'。汎用的なパス '${basePath}' を使用します。`);
        }

        return basePath;
    } catch (error) {
        console.error('getBasePath でエラーが発生しました:', error);
        // エラー時のフォールバックとして、ドメインのルートを返します
        return window.location.origin + '/';
    }
}


/**
 * Displays an error message on the screen. It sets the message to the specified DOM element (default is `error-alert`) and hides it after 6 seconds.
 * @param {string} message - The error message to display.
 * @param {HTMLElement} [errorAlertElement=document.getElementById('error-alert')] - The DOM element to display the error message in.
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
 * Displays a success message on the screen. It sets the message to the specified DOM element (default is `success-alert`) and hides it after 3 seconds.
 * @param {string} message - The success message to display.
 * @param {HTMLElement} [successAlertElement=document.getElementById('success-alert')] - The DOM element to display the success message in.
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
 * Displays a short toast message on the screen.
 * @param {string} message - The message to display.
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
        // @ts-ignore
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
        console.error('[utils.js] showToast: Bootstrapが見つからないため、メッセージをalertで表示します。', message);
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
        // HTMLの特殊文字をエスケープするために、DOM APIを利用します。
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        // textNodeは`&`, `<`, `>`などを自動的にエスケープします。
        // ここでは追加で、HTML属性値として危険な`"`と`'`をエスケープします。
        return div.innerHTML.replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    } catch (error) {
        console.error('[utils.js] escapeHTMLAttribute関数内でエラー:', error);
        return '';
    }
}

/**
 * プロフィール画像のURLをクリーンアップし、絶対パスに変換します。
 * データベースに保存されたphotoURLが有効な場合、そのURLを返します。
 * 無効なURL（null, undefined, 空文字列）の場合や、
 * 過去に誤って保存されたlocalhostパスの場合、nullを返します。
 * UI側でphotoURLがnullの場合は頭文字表示のフォールバックが適用されます。
 * @param {string | null | undefined} photoURL - クリーンアップするプロフィール画像のURL。
 * @returns {string | null} クリーンアップされた絶対URL、またはnull（フォールバック用）。
 */
export function cleanPhotoURL(photoURL) {
    // photoURLがnull, undefined, または空文字列の場合、そのままnullを返します。
    // UI側でnullの場合に頭文字表示のフォールバックが適用されます。
    if (typeof photoURL !== 'string' || photoURL.trim() === '') {
        console.log('[utils.js] cleanPhotoURL: URLが無効または空です。nullを返します。');
        return null;
    }

    try {
        let cleanedUrl = photoURL.trim();

        // 過去に誤ってlocalhostパスが保存されている場合の処理
        // auth.jsの修正により今後は発生しないが、既存データのために残す
        if (cleanedUrl.includes('localhost')) {
            // 現行の basePath が localhost を含む場合はそのまま使用するが、
            // それ以外の場合はこのphotoURLは使用せずnullを返す。
            // なぜなら、auth.jsの修正により、localhostのphotoURLは保存されなくなったため、
            // 既存のlocalhostのphotoURLは、新しいGitHub Pages環境では使えないことがほとんど。
            const currentHostname = window.location.hostname;
            if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
                // 現在がlocalhost環境であれば、そのままのURL（または適切な修正を加える）
                // ただし、/images/icon.pngがついてる場合、/icon.pngに修正する必要がある
                cleanedUrl = cleanedUrl.replace(/^https?:\/\/localhost(:\d+)?\/learning\/english-words\/chat\/\/images\/icon\.png$/, `${window.location.origin}/learning/english-words/chat/icon.png`);
                cleanedUrl = cleanedUrl.replace(/^https?:\/\/localhost(:\d+)?\/chat\/\/images\/icon\.png$/, `${window.location.origin}/chat/icon.png`);
                console.warn('[utils.js] cleanPhotoURL: 過去のlocalhostパスを現在のlocalhostパスに修正しました:', cleanedUrl);
                return cleanedUrl;
            } else {
                // 現在がlocalhost環境でない場合、過去のlocalhostパスは無効と判断し、nullを返す
                console.warn('[utils.js] cleanPhotoURL: 過去のlocalhostパスは現在の環境では無効です。nullを返します:', photoURL);
                return null;
            }
        }
        
        // GitHub Pagesのパスで、誤って/images/icon.pngが保存されている場合も考慮
        // auth.jsの修正により今後は発生しないが、既存データのために残す
        if (cleanedUrl.startsWith(window.location.origin + '/chat/images/icon.png')) {
            // https://soysourcetan.github.io/chat/images/icon.png -> https://soysourcetan.github.io/chat/icon.png
            cleanedUrl = cleanedUrl.replace('/images/icon.png', '/icon.png');
            console.warn('[utils.js] cleanPhotoURL: GitHub Pagesの誤ったアイコンパスを修正しました:', cleanedUrl);
            return cleanedUrl;
        }

        // Twitterの_normalを_400x400に変換 (auth.jsでも行われるが、念のためこちらでも対応)
        if (cleanedUrl.includes('pbs.twimg.com') && cleanedUrl.endsWith('_normal.jpg')) {
             cleanedUrl = cleanedUrl.replace('_normal.jpg', '_400x400.jpg');
             console.log('[utils.js] cleanPhotoURL: TwitterのURLを_400x400に修正しました:', cleanedUrl);
        }

        // URLコンストラクタを使用して、絶対URLとして検証し、無効な場合はnullを返します。
        // basePathはここでは直接は使いませんが、new URL()の第二引数として渡すことで相対URLを解決できます。
        try {
            const url = new URL(cleanedUrl, getBasePath()); // basePathを基準として相対URLも解決
            // プロトコルが http または https であることを確認
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                console.warn('[utils.js] cleanPhotoURL: 不正なプロトコルのURLです。nullを返します:', cleanedUrl);
                return null;
            }
            // URLが有効かつプロトコルが正しい場合はそのhrefを返します。
            return url.href;
        } catch (urlError) {
            console.warn('[utils.js] cleanPhotoURL: URLコンストラクタで解決できないURLです。nullを返します:', cleanedUrl, urlError);
            return null;
        }

    } catch (error) {
        console.error('[utils.js] cleanPhotoURL: URL処理中に予期せぬエラーが発生しました。nullを返します:', error);
        return null;
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
    //    今回はログで確認された「?」と、一般的な不要文字をいくつか追加します。
    //    必要に応じてこの正規表現を調整してください。
    cleaned = cleaned.replace(/[?!()[\]{}@#$%^&*+=|\\<>,./~`!]/g, '');

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
        // @ts-ignore
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}