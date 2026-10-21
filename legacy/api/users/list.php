<?php
/**
 * GET /users/list.php?role=officer&status=active&q=&page=1&per_page=50   (FR-13)   Owner: Juliana
 * Admin user management, and the "assign officer" dropdown (?role=officer&status=active).
 * Each officer also gets "open_cases" (assigned + in progress) to help choose.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');
require_auth(['admin']);

$where = [];
if (!empty($_GET['role']) && in_array($_GET['role'], USER_ROLES, true)) {
    $where[] = ['role', '==', $_GET['role']];
}
if (!empty($_GET['status']) && in_array($_GET['status'], ['active', 'inactive'], true)) {
    $where[] = ['status', '==', $_GET['status']];
}
$users = array_map('normalize_user', fs_query('users', $where));
if ($q = str_field($_GET, 'q')) {
    $q = mb_strtolower($q);
    $users = array_filter($users, fn($u) => str_contains(mb_strtolower($u['full_name'] . ' ' . $u['email'] . ' ' . ($u['badge_no'] ?? '')), $q));
}
$order = ['admin' => 0, 'officer' => 1, 'reporter' => 2];
usort($users, fn($a, $b) => [$order[$a['role']] ?? 9, mb_strtolower($a['full_name'])] <=> [$order[$b['role']] ?? 9, mb_strtolower($b['full_name'])]);

// Workload for officers (one query for all open cases)
$open = [];
if (array_filter($users, fn($u) => $u['role'] === 'officer')) {
    foreach (fs_query('reports', [['status', 'in', OFFICER_ACTIVE_STATUSES]]) as $r) {
        $open[(int)$r['assigned_officer_id']] = ($open[(int)$r['assigned_officer_id']] ?? 0) + 1;
    }
}

$page = max(1, int_query('page', 1));
$perPage = min(200, max(1, int_query('per_page', 50)));
$total = count($users);
$items = array_map(function ($u) use ($open) {
    $row = admin_user($u);
    if ($u['role'] === 'officer') {
        $row['open_cases'] = $open[$u['id']] ?? 0;
    }
    return $row;
}, array_slice(array_values($users), ($page - 1) * $perPage, $perPage));

json_ok(['items' => $items, 'page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => (int)ceil($total / $perPage)]);
