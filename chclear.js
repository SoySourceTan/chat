// JavaScript ファイル (例: script.js の末尾、または別の js ファイル)

/**
 * キャッシュをクリアし、ページを強制的に再読み込みします。
 * 主にHTTPキャッシュとService Workerキャッシュをターゲットにします。
 */
async function clearAllCachesAndReload() {
    // ユーザーに確認を求める
    if (!confirm('アプリケーションのキャッシュをクリアして、最新のバージョンに更新しますか？\nデータがリセットされる場合があります。')) {
        return; // ユーザーがキャンセルしたら何もしない
    }

    // 1. Service Workerのキャッシュをクリア
    // (PWAを導入している場合のみ効果があります。導入していなければスキップされます。)
    if ('serviceWorker' in navigator) {
        try {
            console.log('Service Workerの登録解除とキャッシュのクリアを開始します...');
            // 登録されているService Workerを全て解除
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('Service Workerを登録解除しました:', registration.scope);
            }

            // Service Workerが管理しているキャッシュを全て削除
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log('Service Workerキャッシュをクリアしました:', cacheName);
            }
            console.log('全てのService Workerと関連キャッシュのクリアが完了しました。');
        } catch (error) {
            console.error('Service Workerキャッシュクリア中にエラー:', error);
            // エラーが発生しても、ページ再読み込みは続行
        }
    } else {
        console.log('このブラウザはService Workersをサポートしていません。');
    }

    // 2. localStorageのデータもクリアしたい場合 (任意)
    // アプリケーションがlocalStorageに重要な設定やデータを保存している場合、
    // ここでクリアすることで、それらのデータもリセットできます。
    // 必要ない場合はこのブロックを削除してください。
    // if (confirm('LocalStorageのデータもクリアしますか？（ログイン状態や設定がリセットされます）')) {
    //     try {
    //         localStorage.clear();
    //         console.log('LocalStorageをクリアしました。');
    //     } catch (error) {
    //         console.error('LocalStorageクリア中にエラー:', error);
    //     }
    // }


    // 3. HTTPキャッシュをバイパスしてページを再読み込み
    // URLにユニークなクエリパラメータを追加することで、ブラウザにキャッシュを使わせずに
    // index.html およびそれにリンクされているJavaScript/CSSファイルを再フェッチさせます。
    const url = new URL(window.location.href);
    url.searchParams.set('cache_buster', Date.now()); // 現在のタイムスタンプをユニークな値として追加
    console.log('ページを最新の状態に再読み込みします:', url.toString());
    window.location.href = url.toString(); // 新しいURLで強制的にリロード
}

// DOMの読み込みが完了したら、ボタンにイベントリスナーを割り当てる
document.addEventListener('DOMContentLoaded', () => {
    const clearCacheButton = document.getElementById('clearCacheButton');
    if (clearCacheButton) {
        clearCacheButton.addEventListener('click', clearAllCachesAndReload);
    }
});