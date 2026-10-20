<?php
/**
 * Load the starting data into Firestore. Owner: Alyana (database)
 *
 * Run ONCE for the whole group (everyone shares the same Firebase database).
 *
 * From the command line (XAMPP: open the Shell from the Control Panel):
 *     php api/tools/seed.php                 sample data: 5 test accounts, 40 reports around Bulacan
 *     php api/tools/seed.php --reset         delete everything first, then load the sample data again
 *     php api/tools/seed.php --no-photos     do not make the labeled sample photos
 *     php api/tools/seed.php --clean --admin-email=you@example.com --admin-password=Secret123
 *                                            real deployment: categories, contacts, settings and ONE admin
 *
 * From a browser (when you have no command line, e.g. on InfinityFree):
 *     .../api/tools/seed.php?key=YOUR_SETUP_KEY
 *     .../api/tools/seed.php?key=YOUR_SETUP_KEY&reset=1
 *     .../api/tools/seed.php?key=YOUR_SETUP_KEY&clean=1&admin_email=...&admin_password=...
 *   The setup key is in api/config/config.php ('setup_key').
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }
require __DIR__ . '/../core/bootstrap.php';

$cli = PHP_SAPI === 'cli';
$args = $cli ? ($_SERVER['argv'] ?? []) : [];
$opt = function (string $name) use ($cli, $args) {
    if ($cli) {
        foreach (array_slice($args, 1) as $a) {
            if ($a === "--$name") return '1';
            if (str_starts_with($a, "--$name=")) return substr($a, strlen($name) + 3);
        }
        return null;
    }
    $v = $_GET[str_replace('-', '_', $name)] ?? null;
    return is_string($v) ? $v : null;
};
$say = function (string $line) use ($cli) {
    echo $cli ? $line . "\n" : htmlspecialchars($line) . "<br>\n";
    if (!$cli) {
        @ob_flush();
        flush();
    }
};

if (!$cli) {
    header('Content-Type: text/html; charset=utf-8');
    $key = (string)config('setup_key');
    if ($key === '' || $key === 'change-this-setup-key' || !hash_equals($key, (string)($opt('key') ?? ''))) {
        http_response_code(403);
        exit('Forbidden. Set a real setup_key in api/config/config.php and open this page with ?key=that-value');
    }
    set_time_limit(300);
}

$reset = $opt('reset') === '1';
$clean = $opt('clean') === '1';
$collections = ['users', 'user_emails', 'sessions', 'accident_types', 'emergency_contacts', 'reports', 'report_photos',
    'notifications', 'audit_logs', 'settings', 'counters'];

$say('Firebase project: ' . fs_project_id());

if (!$reset && fs_query('accident_types', [], [], 1)) {
    $say('The database already has data. Nothing was changed.');
    $say($cli ? 'To start over, run:  php api/tools/seed.php --reset' : 'To start over, add &reset=1 to the address.');
    exit;
}

if ($reset) {
    foreach ($collections as $c) {
        $deleted = 0;
        while ($docs = fs_query($c, [], [], 400, [])) {
            fs_commit(array_map(fn($d) => fs_w_delete($c, $d['_id']), $docs));
            $deleted += count($docs);
        }
        $say("Deleted $deleted from $c");
    }
}

$data = json_decode((string)file_get_contents(__DIR__ . '/../../database/seed-data.json'), true);
if (!is_array($data)) {
    $say('Cannot read database/seed-data.json');
    exit(1);
}

$writes = [];
$counters = [];
$add = function (string $collection, array $doc) use (&$writes, &$counters) {
    $id = $doc['_id'] ?? $doc['id'];
    unset($doc['_id']);
    $writes[] = fs_w_set($collection, $id, $doc);
    if (isset($doc['id']) && is_int($doc['id'])) {
        $counters[$collection] = max($counters[$collection] ?? 0, $doc['id']);
    }
};

foreach (['accident_types', 'emergency_contacts', 'settings'] as $c) {
    foreach ($data[$c] as $doc) {
        $add($c, $doc);
    }
}

if ($clean) {
    $email = strtolower(trim((string)$opt('admin-email')));
    $pass = (string)$opt('admin-password');
    $errors = validate_user_fields(['email' => $email, 'password' => $pass], true);
    if ($errors) {
        $say('Give the first admin account: --admin-email=... --admin-password=... (' . implode(' ', $errors) . ')');
        exit(1);
    }
    $user = ['id' => 1, 'full_name' => 'System Administrator', 'email' => $email, 'phone' => null,
        'password_hash' => password_hash($pass, PASSWORD_BCRYPT), 'role' => 'admin', 'badge_no' => null,
        'status' => 'active', 'created_at' => now(), 'updated_at' => now()];
    $add('users', $user);
    $writes[] = fs_w_set('user_emails', email_key($email), ['user_id' => 1]);
} else {
    foreach ($data['users'] as $u) {
        $add('users', $u);
        $writes[] = fs_w_set('user_emails', email_key($u['email']), ['user_id' => $u['id']]);
    }
    // Sample photos for every report: one labeled picture per required section (scene, plate, damage),
    // plus "people affected" for two reports with injuries, so the admin pages show every section.
    $photoWrites = [];
    if (function_exists('imagecreatetruecolor') && $opt('no-photos') !== '1') {
        $pid = 0;
        foreach ($data['reports'] as &$rep) {
            $sections = ['scene', 'plate', 'damage'];
            if (in_array((int)$rep['id'], [6, 15], true)) {
                $sections[] = 'people';
            }
            if ((int)$rep['id'] % 4 === 0) {
                $sections[] = 'other';
            }
            $rep['photos'] = [];
            foreach ($sections as $cat) {
                $pid++;
                $jpeg = sample_photo($cat, PHOTO_CATEGORIES[$cat]['label'], $rep['report_code']);
                $photoWrites[] = fs_w_set('report_photos', $pid, [
                    'id' => $pid, 'report_id' => (int)$rep['id'], 'category' => $cat, 'source' => 'camera',
                    'name' => "sample-$cat.jpg", 'mime_type' => 'image/jpeg', 'size_bytes' => strlen($jpeg),
                    'width' => 800, 'height' => 500, 'uploaded_by' => (int)$rep['reporter_id'],
                    'uploaded_at' => $rep['created_at'], 'data' => new FsBytes($jpeg),
                ]);
                $rep['photos'][] = ['id' => $pid, 'name' => "sample-$cat.jpg", 'category' => $cat, 'source' => 'camera'];
            }
        }
        unset($rep);
        $counters['report_photos'] = $pid;
    }
    foreach (['reports', 'notifications'] as $c) {
        foreach ($data[$c] as $doc) {
            $add($c, $doc);
        }
    }
    foreach ($data['audit_logs'] as $doc) {
        $writes[] = fs_w_set('audit_logs', fs_random_id(), $doc);
    }
}

foreach (['users', 'accident_types', 'emergency_contacts', 'reports', 'notifications', 'report_photos'] as $c) {
    $writes[] = fs_w_set('counters', $c, ['value' => $counters[$c] ?? 0]);
}

fs_commit($writes);
if (!empty($photoWrites)) {
    save_photo_docs($photoWrites);
}
$say('Saved ' . (count($writes) + count($photoWrites ?? [])) . ' documents' . (!empty($photoWrites) ? ' (' . count($photoWrites) . ' sample photos)' : '') . '.');
$say($clean
    ? "Done. Log in as $email."
    : 'Done. Test accounts: admin@roadreport.test / Admin@123, officer@roadreport.test / Officer@123, reporter@roadreport.test / Reporter@123');


/** A plain labeled picture standing in for a real photo (sample data only). */
function sample_photo(string $cat, string $label, string $code): string
{
    $colors = ['scene' => [52, 88, 112], 'plate' => [70, 70, 78], 'damage' => [120, 66, 40], 'people' => [96, 60, 96], 'other' => [60, 96, 70]];
    [$cr, $cg, $cb] = $colors[$cat] ?? [80, 80, 80];
    $im = imagecreatetruecolor(800, 500);
    imagefill($im, 0, 0, imagecolorallocate($im, $cr, $cg, $cb));
    $light = imagecolorallocate($im, min(255, $cr + 60), min(255, $cg + 60), min(255, $cb + 60));
    $white = imagecolorallocate($im, 255, 255, 255);
    $yellow = imagecolorallocate($im, 242, 183, 5);
    // a simple "road" with lane marks
    imagefilledrectangle($im, 0, 300, 800, 420, imagecolorallocate($im, 45, 48, 52));
    for ($x = 20; $x < 800; $x += 90) {
        imagefilledrectangle($im, $x, 357, $x + 50, 363, $yellow);
    }
    if ($cat === 'plate') {
        imagefilledrectangle($im, 250, 140, 550, 230, $white);
        imagerectangle($im, 250, 140, 550, 230, imagecolorallocate($im, 0, 0, 0));
        imagestring($im, 5, 330, 175, 'ABC 1234', imagecolorallocate($im, 0, 0, 0));
    } else {
        imagefilledrectangle($im, 220, 220, 420, 300, $light);
        imagefilledrectangle($im, 400, 230, 590, 300, $light);
    }
    imagestring($im, 5, 24, 24, 'SAMPLE PHOTO (test data)', $yellow);
    imagestring($im, 5, 24, 50, $label, $white);
    imagestring($im, 4, 24, 76, $code, $white);
    ob_start();
    imagejpeg($im, null, 70);
    imagedestroy($im);
    return (string)ob_get_clean();
}
