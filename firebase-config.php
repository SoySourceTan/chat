<?php
// /var/www/trextacy/chat/firebase-config.php
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/trextacy/chat/logs/php_errors.log');

$allowed_origins = [
    'https://trextacy.com',
    'https://soysourcetan.github.io',
    'http://localhost',
    'http://localhost:80',
    'http://localhost:8080',
    'https://localhost',
    'https://localhost:3000',
    '' // ★ この行を追加してください
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
error_log("Received Origin for firebase-config: " . $origin);
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Content-Type: application/json');
} else {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden: Invalid origin", "received_origin" => $origin]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

echo json_encode([
    'apiKey' => 'AIzaSyBLMySLkXyeiL2_QLCdolHTOOA6W3TSfYc',
    'authDomain' => 'gentle-brace-458923-k9.firebaseapp.com',
    'databaseURL' => 'https://gentle-brace-458923-k9-default-rtdb.firebaseio.com',
    'projectId' => 'gentle-brace-458923-k9',
    'storageBucket' => 'gentle-brace-458923-k9.firebasestorage.app',
    'messagingSenderId' => '426876531009',
    'appId' => '1:426876531009:web:021b23c449bce5d72031c0',
    'measurementId' => 'G-2B5KWNHYED'
], JSON_UNESCAPED_SLASHES);
?>