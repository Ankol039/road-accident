<?php
/**
 * POST /notifications/read.php   Body (JSON): { id } to mark one as read, or { all: true }
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth();
$in = input();
if (!empty($in['all'])) {
    $unread = fs_query('notifications', [['user_id', '==', $user['id']], ['is_read', '==', false]]);
    if ($unread) {
        fs_commit(array_map(fn($n) => fs_w_update('notifications', $n['_id'], ['is_read' => true]), $unread));
    }
} else {
    $id = filter_var($in['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        json_error('Send the notification id', 422);
    }
    $n = fs_get('notifications', $id);
    if (!$n || (int)$n['user_id'] !== $user['id']) {
        json_error('Notification not found', 404);
    }
    if (empty($n['is_read'])) {
        fs_update('notifications', $id, ['is_read' => true]);
    }
}
json_ok(null, 'Marked as read');
