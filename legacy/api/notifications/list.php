<?php
/**
 * GET /notifications/list.php   (FR-09)  The logged-in user's notifications, newest first (latest 100).
 * Optional: ?unread=1
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

$user = require_auth();
$rows = fs_query('notifications', [['user_id', '==', $user['id']]]);
usort($rows, fn($a, $b) => [$b['created_at'], $b['id']] <=> [$a['created_at'], $a['id']]);
$unread = count(array_filter($rows, fn($n) => empty($n['is_read'])));
if (($_GET['unread'] ?? '') === '1') {
    $rows = array_filter($rows, fn($n) => empty($n['is_read']));
}

json_ok([
    'unread_count' => $unread,
    'items' => array_map(fn($n) => [
        'id'          => (int)$n['id'],
        'title'       => $n['title'],
        'message'     => $n['message'],
        'report_id'   => isset($n['report_id']) ? (int)$n['report_id'] : null,
        'report_code' => $n['report_code'] ?? null,
        'is_read'     => (bool)($n['is_read'] ?? false),
        'date'        => $n['created_at'],
    ], array_slice(array_values($rows), 0, 100)),
]);
