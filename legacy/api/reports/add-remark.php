<?php
/**
 * POST /reports/add-remark.php   (Officer: remarks, findings, actions taken)   Owner: Juliana
 * Body (JSON): { id, type: "remark"|"finding"|"action", content, is_internal: true|false }
 *   is_internal = true  -> only staff see it
 *   is_internal = false -> the reporter sees it too and gets a notification
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['admin', 'officer']);
$in = input();
$id = (int)filter_var($in['id'] ?? null, FILTER_VALIDATE_INT);
$type = str_field($in, 'type') ?? 'remark';
$content = str_field($in, 'content');
$internal = filter_var($in['is_internal'] ?? true, FILTER_VALIDATE_BOOLEAN);

$r = find_report($id);
if (!$r || !can_view_report($user, $r)) {
    json_error('Report not found', 404);
}
$errors = [];
if (!in_array($type, ['remark', 'finding', 'action'], true)) {
    $errors['type'] = 'Choose remark, finding or action taken';
}
if ($content === null || mb_strlen($content) < 3) {
    $errors['content'] = 'Write the remark (at least 3 characters)';
}
if ($errors) {
    json_error('Please fix the highlighted fields', 422, $errors);
}

$remarkId = 1 + array_reduce($r['remarks'] ?? [], fn($max, $m) => max($max, (int)$m['id']), 0);
$remark = [
    'id'          => $remarkId,
    'type'        => $type,
    'content'     => mb_substr($content, 0, 2000),
    'is_internal' => $internal,
    'author_id'   => $user['id'],
    'author_name' => $user['full_name'],
    'author_role' => $user['role'],
    'created_at'  => now(),
];
$label = ['remark' => 'remark', 'finding' => 'finding', 'action' => 'action taken'][$type];

$writes = [
    fs_w_update('reports', $id, ['updated_at' => now()], true, ['remarks' => [$remark]]),
    audit_write($user, 'report.remark', 'report', $id, ['type' => $type, 'internal' => $internal]),
];
if (!$internal && !empty($r['reporter_id'])) {
    $writes = array_merge($writes, notification_writes([$r['reporter_id']], "Update on report {$r['report_code']}",
        "New $label from the traffic office: " . mb_substr($content, 0, 150), $r));
}
fs_commit($writes);
send_queued_emails();

report_response($id, $user, 'Remark added', 201);
