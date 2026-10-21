<?php
/**
 * POST /reports/edit.php   (FR-07 edit reports)   Owner: Juliana
 * Body (JSON): { id, ...only the fields to correct }
 *   accident_date, accident_time, accident_type_id, location_text, barangay, municipality,
 *   latitude, longitude, injury_status, description, vehicles ([{type, quantity}])
 * Admins only. The old and new values are saved in the audit trail.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['admin']);
$in = input();
$id = (int)filter_var($in['id'] ?? null, FILTER_VALIDATE_INT);
$r = find_report($id);
if (!$r) {
    json_error('Report not found', 404);
}

unset($in['id']);
[$v, $errors] = validate_report_fields($in, false, $r);
if ($errors) {
    json_error('Please fix the highlighted fields', 422, $errors);
}

$changed = [];
foreach ($v as $k => $new) {
    $old = $r[$k] ?? null;
    if ($old != $new) {
        $changed[$k] = ['from' => $old, 'to' => $new];
    }
}
unset($changed['accident_type']); // follows accident_type_id
if (!$changed) {
    report_response($id, $user, 'Nothing changed');
}
$v['updated_at'] = now();

fs_commit([
    fs_w_update('reports', $id, $v),
    audit_write($user, 'report.edit', 'report', $id, ['changed' => $changed]),
]);
report_response($id, $user, 'Report updated');
