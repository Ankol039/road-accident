<?php
/**
 * GET /audit/list.php?action=&user_id=&q=&date_from=&date_to=&page=&per_page=   (FR-14 audit trail viewer)
 * Owner: Juliana (API), Alyana (admin page)
 * Default range: the last 30 days. Newest first.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');
require_auth(['admin']);

$from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date_from'] ?? '') ? $_GET['date_from'] : date('Y-m-d', strtotime('-30 days'));
$to = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date_to'] ?? '') ? $_GET['date_to'] : date('Y-m-d');

// One range filter on created_at (no extra Firestore index needed); the rest is filtered here
$rows = fs_query('audit_logs', [['created_at', '>=', "$from 00:00:00"], ['created_at', '<=', "$to 23:59:59"]], [['created_at', 'desc']], 3000);

$action = str_field($_GET, 'action');
$userId = int_query('user_id');
$q = ($q = str_field($_GET, 'q')) !== null ? mb_strtolower($q) : null;
$rows = array_values(array_filter($rows, function ($a) use ($action, $userId, $q) {
    if ($action && !str_starts_with($a['action'], $action)) return false;
    if ($userId && (int)($a['user_id'] ?? 0) !== $userId) return false;
    if ($q !== null && !str_contains(mb_strtolower(($a['user_name'] ?? '') . ' ' . json_encode($a['details'] ?? []) . ' ' . ($a['entity_id'] ?? '')), $q)) return false;
    return true;
}));

$page = max(1, int_query('page', 1));
$perPage = min(200, max(1, int_query('per_page', 50)));
$total = count($rows);
json_ok([
    'items' => array_map(fn($a) => [
        'id'          => $a['_id'],
        'action'      => $a['action'],
        'action_label'=> AUDIT_ACTIONS[$a['action']] ?? $a['action'],
        'user_id'     => isset($a['user_id']) ? (int)$a['user_id'] : null,
        'user_name'   => $a['user_name'] ?? null,
        'user_role'   => $a['user_role'] ?? null,
        'entity_type' => $a['entity_type'] ?? null,
        'entity_id'   => isset($a['entity_id']) ? (int)$a['entity_id'] : null,
        'details'     => $a['details'] ?? null,
        'ip_address'  => $a['ip_address'] ?? null,
        'created_at'  => $a['created_at'],
    ], array_slice($rows, ($page - 1) * $perPage, $perPage)),
    'actions'     => array_map(fn($k, $v) => ['value' => $k, 'label' => $v], array_keys(AUDIT_ACTIONS), AUDIT_ACTIONS),
    'date_from'   => $from,
    'date_to'     => $to,
    'page'        => $page,
    'per_page'    => $perPage,
    'total'       => $total,
    'total_pages' => (int)ceil($total / $perPage),
]);
