<?php
/**
 * POST /settings/save.php   (Admin: system settings)
 * Body (JSON): any of { system_name, max_photos_per_report (3-15),
 *                       duplicate_radius_m (1-500), arrival_match_radius_m (5-500) }
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['admin']);
$in = input();
$old = app_settings();
$new = [];
$errors = [];

if (array_key_exists('system_name', $in)) {
    $v = str_field($in, 'system_name');
    if ($v === null || mb_strlen($v) > 40) {
        $errors['system_name'] = 'Enter a name (up to 40 characters)';
    } else {
        $new['system_name'] = $v;
    }
}
$numbers = [
    'max_photos_per_report'  => [3, 15, 'int'],
    'duplicate_radius_m'     => [1, 500, 'float'],
    'duplicate_window_minutes' => [1, 1440, 'int'],
    'arrival_match_radius_m' => [5, 500, 'float'],
];
foreach ($numbers as $k => [$min, $max, $type]) {
    if (!array_key_exists($k, $in)) {
        continue;
    }
    if (!is_numeric($in[$k]) || $in[$k] < $min || $in[$k] > $max) {
        $errors[$k] = "Enter a number from $min to $max";
    } else {
        $new[$k] = $type === 'int' ? (int)$in[$k] : round((float)$in[$k], 1);
    }
}
if ($errors) {
    json_error('Please fix the highlighted fields', 422, $errors);
}

$changed = [];
foreach ($new as $k => $v) {
    if ($old[$k] != $v) {
        $changed[$k] = ['from' => $old[$k], 'to' => $v];
    }
}
if ($changed) {
    fs_commit([
        fs_w_update('settings', 'system', $new + ['updated_at' => now(), 'updated_by' => $user['full_name']], false),
        audit_write($user, 'settings.save', 'settings', null, ['changed' => $changed]),
    ]);
}
json_ok(array_merge($old, $new), $changed ? 'Settings saved' : 'Nothing changed');
