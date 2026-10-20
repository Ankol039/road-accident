<?php
/**
 * GET /reports/list.php   (FR-07, FR-11)  Owner: Juliana (API), Alyana (admin page)
 * All reports for staff. Officers only get reports assigned to them.
 *
 * Filters (all optional):
 *   status, accident_type_id, municipality, barangay,
 *   date_from, date_to (YYYY-MM-DD, accident date),
 *   q (search report code, location, description, reporter),
 *   flagged=1, official=1 (verified records only),
 *   page (default 1), per_page (default 20, max 100)
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

$user = require_auth(['admin', 'officer']);
$rows = load_reports($user, report_filters_from_query());

$page = max(1, int_query('page', 1));
$perPage = min(100, max(1, int_query('per_page', 20)));
$total = count($rows);

json_ok([
    'items'       => array_map(fn($r) => format_report($r, $user), array_slice($rows, ($page - 1) * $perPage, $perPage)),
    'page'        => $page,
    'per_page'    => $perPage,
    'total'       => $total,
    'total_pages' => (int)ceil($total / $perPage),
]);
