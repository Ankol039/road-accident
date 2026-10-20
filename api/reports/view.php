<?php
/**
 * GET /reports/view.php?id=12   (FR-06, FR-07)  Owner: Juliana
 * One report with vehicles, photos, status history and remarks
 * (the reporter does not see internal remarks). Also works with ?code=RA-2026-000012
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

$user = require_auth();
$id = int_query('id');
$r = $id ? find_report($id) : (!empty($_GET['code']) ? find_report_by_code((string)$_GET['code']) : null);
if (!$r || !can_view_report($user, $r)) {
    json_error('Report not found', 404);
}
$out = format_report($r, $user, true);
// Admin: the later reports the system disregarded as duplicates of this one
if ($user['role'] === 'admin') {
    $out['duplicate_reports'] = array_map(fn($d) => [
        'id' => (int)$d['id'], 'report_code' => $d['report_code'], 'reporter' => $d['reporter_name'] ?? null,
        'distance_m' => isset($d['duplicate_distance_m']) ? (float)$d['duplicate_distance_m'] : null,
        'date_submitted' => $d['created_at'], 'photo_count' => count($d['photos'] ?? []),
    ], array_values(array_filter(
        fs_query('reports', [['duplicate_of', '==', (int)$r['id']]]),
        fn($d) => $d['status'] === 'duplicate'
    )));
}
json_ok($out);
