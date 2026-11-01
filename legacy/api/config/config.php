<?php
/**
 * App settings.
 *
 * The database is Firebase (Cloud Firestore). The API connects with a service account key:
 *   Firebase console > Project settings > Service accounts > Generate new private key
 *   Store the downloaded file outside public_html in private/firebase-service-account.json
 * NEVER commit that file to GitHub (it is in .gitignore). Share it with the group privately.
 */
$privateDir = getenv('ROADREPORT_PRIVATE_DIR');
if (!$privateDir) {
    foreach ([dirname(__DIR__, 3), dirname(__DIR__, 4)] as $base) {
        if (is_file($base . '/private/firestore-config.php')) { $privateDir = $base . '/private'; break; }
    }
}
$privateDir = $privateDir ?: dirname(__DIR__, 3) . '/private';
$defaults = [
    'firebase' => [
        'project_id'           => getenv('FIREBASE_PROJECT_ID') ?: 'roadreport-402a6',
        'service_account_file' => getenv('FIREBASE_KEY_FILE') ?: $privateDir . '/firebase-service-account.json',
        'database_id'          => '(default)',
        // Google login tokens are cached here for up to 1 hour (folder is blocked from the web)
        'cache_dir'            => $privateDir . '/cache',
        // Root certificates for HTTPS; XAMPP on Windows needs this file to reach Google
        'ca_bundle'            => __DIR__ . '/cacert.pem',
        // Only change these for testing with a local emulator
        'api_url'              => getenv('FIRESTORE_API_URL') ?: 'https://firestore.googleapis.com/v1',
        'token_url'            => getenv('FIREBASE_TOKEN_URL') ?: '',
    ],

    // Login tokens last this many days
    'token_days' => 7,

    // Photo evidence rules (FR-05). Photos are shrunk and stored inside Firestore
    // (Firebase Storage needs the paid Blaze plan). Each stored photo stays under ~900 KB.
    // Sections: scene, plate, damage (required), people (optional, sensitive), other (optional).
    'uploads' => [
        'max_files'    => 10,     // all sections together (the admin can change it in Settings)
        'max_mb'       => 10,     // largest file accepted before shrinking
        'max_side_px'  => 1280,   // longest side after shrinking
        'jpeg_quality' => 72,
        'max_store_kb' => 900,    // Firestore documents can be at most 1 MB
        'allowed_mime' => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'],
    ],

    // Duplicate rule (FR-08): a new report whose GPS pin is this close to an earlier report that is
    // still open is flagged for duplicate review. Admin confirms duplicates after review.
    'duplicates' => [
        'radius_m' => 100,
        'window_minutes' => 60,
    ],

    // Officer arrival check: the website shows "matches" when the officer's arrival GPS is this close
    // to the reporter's pin. The admin still decides. Changeable on the Settings page.
    'arrival' => [
        'match_radius_m' => 30,
    ],

    // Which websites may call this API from a browser. '*' is fine because we use
    // Bearer tokens, not cookies.
    'cors_origin' => '*',

    // Optional email notifications (FR-09). In-app notifications always work.
    // For Gmail: turn on 2-Step Verification, create an App Password, put it below.
    // InfinityFree's free plan may block SMTP; Hostinger allows it.
    'mail' => [
        'enabled'   => false,
        'host'      => 'smtp.gmail.com',
        'port'      => 587,
        'username'  => getenv('MAIL_USER') ?: '',
        'password'  => getenv('MAIL_PASS') ?: '',
        'from_name' => 'RoadReport',
    ],

    // Needed to run api/tools/seed.php from a browser: seed.php?key=THIS_VALUE
    // Change it, and keep it secret. From the command line no key is needed.
    'setup_key' => '', // Browser seeding disabled; use CLI only.

    // Set to false before the final demo so error details are not shown
    'debug' => false,
    'api_base_url' => getenv('API_BASE_URL') ?: '',
];

$overrideFile = $privateDir . '/firestore-config.php';
$overrides = is_file($overrideFile) ? require $overrideFile : [];
if (!is_array($overrides)) throw new RuntimeException('Invalid private configuration');
return array_replace_recursive($defaults, $overrides);
