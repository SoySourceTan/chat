<?php
// /home/users/1/upper.jp-trextacy/web/chat/send-notification.php
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/home/users/1/upper.jp-trextacy/web/chat/logs/php_errors.log');

require 'vendor/autoload.php';
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;

error_log("send-notification.php 実行開始: " . date('Y-m-d H:i:s'));
error_log("カレントディレクトリ: " . getcwd());

$allowed_origins = [
    'https://trextacy.com',
    'https://soysourcetan.github.io',
    'http://localhost',
    'http://localhost:80',
    'http://localhost:8080',
    'https://localhost',
    'https://localhost:3000'
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'https://soysourcetan.github.io'; // デフォルトをGitHub Pagesに変更
error_log("Received Origin: $origin");

if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Content-Type: application/json; charset=utf-8');
} else {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden: Invalid origin", "received_origin" => $origin]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $serviceAccountPath = '/home/users/1/upper.jp-trextacy/web/chat/private/gentle-brace-458923-k9-firebase-adminsdk-fbsvc-87ee2dcce1.json';
    error_log("サービスアカウントパス: $serviceAccountPath");
    error_log("ファイル存在確認: " . (file_exists($serviceAccountPath) ? "存在します" : "存在しません"));
    error_log("ファイル読み込み可能: " . (is_readable($serviceAccountPath) ? "読み込み可" : "読み込み不可"));
    if (!file_exists($serviceAccountPath)) {
        error_log('サービスアカウントJSONが見つかりません: ' . $serviceAccountPath);
        http_response_code(500);
        echo json_encode(["error" => "サービスアカウントJSONが見つかりません", "path" => $serviceAccountPath]);
        exit;
    }
    if (!is_readable($serviceAccountPath)) {
        error_log('サービスアカウントJSONが読み込めません: ' . $serviceAccountPath);
        http_response_code(500);
        echo json_encode(["error" => "サービスアカウントJSONが読み込めません", "path" => $serviceAccountPath]);
        exit;
    }

    $factory = (new Factory)
        ->withServiceAccount($serviceAccountPath)
        ->withDatabaseUri('https://gentle-brace-458923-k9-default-rtdb.firebaseio.com');
    error_log("Firebase Factory初期化成功");
    $messaging = $factory->createMessaging();
    $database = $factory->createDatabase();
    error_log("MessagingとDatabase初期化成功");

    // デバッグコード: 入力データのログ記録
    $rawInput = file_get_contents('php://input');
    file_put_contents('/home/users/1/upper.jp-trextacy/web/chat/logs/debug.log', "Raw Input: " . $rawInput . "\n", FILE_APPEND);
    $input = json_decode($rawInput, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("JSONパースエラー: " . json_last_error_msg());
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON: ' . json_last_error_msg()]);
        exit;
    }
    file_put_contents('/home/users/1/upper.jp-trextacy/web/chat/logs/debug.log', "Parsed Input: " . print_r($input, true) . "\n", FILE_APPEND);

    // バリデーション: userIdは任意、titleとbodyのみ必須
    if (!$input || !isset($input['title']) || !isset($input['body']) || empty($input['title']) || empty($input['body'])) {
        error_log("バリデーションエラー: titleまたはbodyが欠けているか空");
        http_response_code(400);
        echo json_encode(["error" => "titleとbodyは必須で、空にできません"]);
        exit;
    }

    $title = $input['title'];
    $body = $input['body'];
    $data = $input['data'] ?? [];
    $senderUserId = $input['senderUserId'] ?? null;
    $userId = $input['userId'] ?? null;
    error_log("senderUserId: $senderUserId, userId: $userId, title: $title, body: $body");

    // すべてのユーザーの FCM トークンを取得
    $usersRef = $database->getReference('users');
    $snapshot = $usersRef->getSnapshot();
    $users = $snapshot->getValue() ?? [];
    error_log("全ユーザーデータ: " . json_encode(array_keys($users)));

    // オンラインユーザーの取得
    $onlineUsersRef = $database->getReference('onlineUsers');
    $onlineSnapshot = $onlineUsersRef->getSnapshot();
    $onlineUsers = $onlineSnapshot->getValue() ?? [];
    error_log("オンラインユーザーデータ: " . json_encode(array_keys($onlineUsers)));

    $successCount = 0;
    $errorCount = 0;
    $skippedCount = 0;

    // userIdが指定されている場合は、そのユーザーだけを対象
    $targetUsers = ($userId && isset($users[$userId])) ? [$userId => $users[$userId]] : $users;

    foreach ($targetUsers as $targetUserId => $userData) {
        // 送信者自身には通知しない
        if ($targetUserId === $senderUserId) {
            error_log("送信者自身 ($targetUserId) のためスキップ");
            $skippedCount++;
            continue;
        }

        // FCM トークンが存在するか確認
        if (!isset($userData['fcmToken']) || empty($userData['fcmToken'])) {
            error_log("FCMトークンが見つかりません: userId=$targetUserId");
            $skippedCount++;
            continue;
        }

        // 非アクティブユーザーの判定（最後のアクティビティが5分以上前）
        $isOnline = isset($onlineUsers[$targetUserId]) && ($onlineUsers[$targetUserId]['timestamp'] ?? 0) > (time() * 1000 - 5 * 60 * 1000);
//        if ($isOnline) {
//            error_log("ユーザー $targetUserId はオンラインのためスキップ");
//            $skippedCount++;
//            continue;
//        }

        // 通知メッセージの作成
        $message = CloudMessage::withTarget('token', $userData['fcmToken'])
            ->withNotification(Notification::create($title, $body))
            ->withData(array_merge($data, [
                'url' => $data['url'] ?? 'https://soysourcetan.github.io/chat/', // URLを修正
                'icon' => 'https://soysourcetan.github.io/chat/images/icon.png' // アイコンパスを修正
            ]));
        error_log("通知メッセージ準備完了: userId=$targetUserId, fcmToken={$userData['fcmToken']}");

        // 通知送信
        try {
            $messaging->send($message);
            error_log("通知送信成功: userId=$targetUserId");
            $successCount++;
        } catch (Exception $e) {
            error_log("通知送信エラー: userId=$targetUserId, エラー: " . $e->getMessage());
            $errorCount++;
        }
    }

    error_log("通知送信結果: 成功=$successCount, 失敗=$errorCount, スキップ=$skippedCount");
    echo json_encode([
        "success" => true,
        "message" => "通知を送信しました",
        "details" => [
            "successCount" => $successCount,
            "errorCount" => $errorCount,
            "skippedCount" => $skippedCount
        ]
    ]);
} catch (Exception $e) {
    error_log('通知送信エラー: ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    echo json_encode([
        "error" => "通知送信に失敗しました: " . $e->getMessage(),
        "file" => $e->getFile(),
        "line" => $e->getLine(),
        "trace" => $e->getTraceAsString()
    ]);
}
?>