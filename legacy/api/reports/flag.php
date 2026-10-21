<?php
/**
 * POST /reports/flag.php   (FR-08 flag incomplete or duplicate)   Owner: Juliana
 * Body (JSON): { id, flagged: true|false, reason?, duplicate_of? (report id or RA- code) }
 *
 * New reports are already auto-flagged as possible duplicates in reports/create.php.
 * This endpoint lets the admin flag or un-flag a report by hand.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['admin']);
$in = input();
$id = (int)filter_var($in['id'] ?? null, FILTER_VALIDATE_INT);
$flagged = filter_var($in['flagged'] ?? true, FILTER_VALIDATE_BOOLEAN);
$reason = str_field($in, 'reason');
$dupRaw = str_field($in, 'duplicate_of');

$r = find_report($id);
if (!$r) {
    json_error('Report not found', 404);
}

$dupId = null;
if ($flagged && $dupRaw !== null) {
    $dup = ctype_digit($dupRaw) ? find_report((int)$dupRaw) : find_report_by_code($dupRaw);
    if (!$dup || (int)$dup['id'] === $id) {
        json_error('Please fix the highlighted fields', 422, ['duplicate_of' => 'No other report has that ID']);
    }
    $dupId = (int)$dup['id'];
}
if ($flagged && $reason === null) {
    $reason = $dupId ? 'Duplicate of ' . $dup['report_code'] : null;
}
if ($flagged && $reason === null) {
    json_error('Please fix the highlighted fields', 422, ['reason' => 'Say why it is flagged (incomplete, duplicate...)']);
}

$changes = [
    'is_flagged'   => $flagged,
    'flag_reason'  => $flagged ? mb_substr($reason, 0, 255) : null,
    'duplicate_of' => $flagged ? $dupId : null,
    'duplicate_of_code' => $flagged && $dupId ? $dup['report_code'] : null,
    'duplicate_distance_m' => null,
    'updated_at'   => now(),
];
fs_commit([
    fs_w_update('reports', $id, $changes),
    audit_write($user, 'report.flag', 'report', $id, ['flagged' => $flagged, 'reason' => $changes['flag_reason'], 'duplicate_of' => $dupId]),
]);
report_response($id, $user, $flagged ? 'Report flagged' : 'Flag removed');
