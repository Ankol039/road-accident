<?php
/**
 * GET /health.php   Quick setup check. Open it in the browser after installing or deploying:
 *   http://localhost/road-accident-system/api/health.php
 * Every line should say "ok". It shows no private data.
 */
require __DIR__ . '/core/bootstrap.php';
require_method('GET');
require_auth(['admin']);

$checks = [
    'php_version'   => version_compare(PHP_VERSION, '8.0', '>=') ? 'ok (' . PHP_VERSION . ')' : 'PHP 8.0 or newer is needed (you have ' . PHP_VERSION . ')',
    'curl'          => function_exists('curl_init') ? 'ok' : 'Turn on extension=curl in php.ini',
    'openssl'       => function_exists('openssl_sign') ? 'ok' : 'Turn on extension=openssl in php.ini',
    'gd_images'     => function_exists('imagecreatetruecolor') ? 'ok' : 'Turn on extension=gd in php.ini (needed to shrink photos)',
    'fileinfo'      => class_exists('finfo') ? 'ok' : 'Turn on extension=fileinfo in php.ini',
    'firebase_key'  => is_file((string)config('firebase.service_account_file')) ? 'ok' : 'Missing api/config/firebase-service-account.json',
    'cache_folder'  => is_writable((string)config('firebase.cache_dir')) ? 'ok' : 'api/cache is not writable',
];
$checks['firestore'] = 'skipped';
if ($checks['firebase_key'] === 'ok' && $checks['curl'] === 'ok') {
    try {
        $t = microtime(true);
        $types = count(fs_query('accident_types'));
        $checks['firestore'] = $types > 0
            ? 'ok (' . round((microtime(true) - $t) * 1000) . ' ms)'
            : 'connected, but no data yet: run api/tools/seed.php';
    } catch (Throwable $e) {
        $checks['firestore'] = $e->getMessage();
    }
}
$ok = !array_filter($checks, fn($v) => !str_starts_with($v, 'ok') && $v !== 'skipped');
json_response(['success' => $ok, 'message' => $ok ? 'Everything is ready' : 'Something needs fixing', 'data' => $checks], $ok ? 200 : 500);
