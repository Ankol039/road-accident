<?php
/**
 * GET /reports/mine.php   (FR-06 report history)  Owner: Juliana
 * The logged-in reporter's own reports, newest first.
 * Optional: ?status=submitted
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

$user = require_auth();
$rows = fs_query('reports', [['reporter_id', '==', $user['id']]]);
$f = [];
if (!empty($_GET['status']) && isset(REPORT_STATUSES[$_GET['status']])) {
    $f['status'] = $_GET['status'];
}
json_ok(array_map(fn($r) => format_report($r, $user), filter_reports($rows, $f)));
