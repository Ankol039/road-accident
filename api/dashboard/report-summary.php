<?php
/**
 * GET /dashboard/report-summary.php?period=daily|weekly|monthly|annual&date_from=&date_to=&scope=official|all
 * (FR-12 report generation)   Owner: Alyana
 *
 * One row per period, newest first:
 *   [ { "period": "2026-09", "label": "September 2026", "total": 8, "with_injuries": 3, "fatalities": 1,
 *       "no_injuries": 4, "unknown_injuries": 0, "vehicles": 14, "resolved": 5,
 *       "top_type": "Collision", "top_municipality": "Malolos" }, ... ]
 * scope=official (default) counts only verified accident records.
 * The same numbers can be downloaded with export/reports.php?type=summary.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

$user = require_auth(['admin']);
$period = in_array($_GET['period'] ?? '', ['daily', 'weekly', 'monthly', 'annual'], true) ? $_GET['period'] : 'monthly';
$scope = ($_GET['scope'] ?? 'official') === 'all' ? 'all' : 'official';
[$from, $to] = default_range($period);
$f = report_filters_from_query();
$from = $f['date_from'] ?? $from;
$to = $f['date_to'] ?? $to;
if ($from > $to) {
    json_error('The start date must be before the end date', 422, ['date_from' => 'Must be before the end date']);
}

$reports = load_reports($user, $scope === 'official' ? ['official' => true] : []);
$rows = period_summary($reports, $period, $from, $to);

json_ok([
    'period'    => $period,
    'scope'     => $scope,
    'date_from' => $from,
    'date_to'   => $to,
    'rows'      => $rows,
    'totals'    => summary_totals($rows),
]);
