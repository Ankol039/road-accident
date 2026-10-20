<?php
/**
 * Every endpoint starts with:
 *     require __DIR__ . '/../core/bootstrap.php';
 *
 * It loads the config, sends CORS headers, turns PHP errors into JSON,
 * and loads the helper files in this folder.
 */

declare(strict_types=1);

date_default_timezone_set('Asia/Manila');

$GLOBALS['config'] = require __DIR__ . '/../config/config.php';

function config(string $key, $default = null)
{
    $value = $GLOBALS['config'];
    foreach (explode('.', $key) as $part) {
        if (!is_array($value) || !array_key_exists($part, $value)) {
            return $default;
        }
        $value = $value[$part];
    }
    return $value;
}

// ---- CORS (lets the website and the Flutter app call the API) ----
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: ' . config('cors_origin', '*'));
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/response.php';
require_once __DIR__ . '/firestore.php';
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/images.php';
require_once __DIR__ . '/request.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/status.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/notify.php';
require_once __DIR__ . '/reports.php';
require_once __DIR__ . '/stats.php';

function now(): string
{
    return date('Y-m-d H:i:s');
}

// ---- Turn any uncaught error into a JSON response ----
set_exception_handler(function (Throwable $e) {
    error_log('RoadReport: ' . $e->getMessage());
    $body = ['success' => false, 'message' => 'Server error. Please contact the administrator.'];
    if (config('debug')) {
        $body['debug'] = $e->getMessage() . ' in ' . basename($e->getFile()) . ':' . $e->getLine();
    }
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($body);
    exit;
});
set_error_handler(function (int $no, string $msg, string $file, int $line) {
    if (!(error_reporting() & $no)) {
        return false;
    }
    throw new ErrorException($msg, 0, $no, $file, $line);
});
