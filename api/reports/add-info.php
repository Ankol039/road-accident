<?php
/**
 * POST /reports/add-info.php   Reporter answers "Additional Information Required"
 * multipart/form-data or JSON:
 *   id        report id (required)
 *   message   the missing details (required, 5+ characters)
 *   photos_<section>[]  more photos for any section (optional), same fields as reports/create.php;
 *                       the limits count the photos already attached
 *
 * The report goes back to "Under Review" and the admins are notified.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['reporter']);
$in = input();
$id = (int)filter_var($in['id'] ?? null, FILTER_VALIDATE_INT);
$message = str_field($in, 'message');

$r = find_report($id);
if (!$r || !can_view_report($user, $r)) {
    json_error('Report not found', 404);
}
if ($r['status'] !== 'info_required') {
    json_error('This report is not waiting for more information', 422);
}
$errors = [];
if ($message === null || mb_strlen($message) < 5) {
    $errors['message'] = 'Write the missing details';
}
[$photos, $photoErrors] = read_uploaded_photos($r['photos'] ?? [], false);
$errors += $photoErrors;
if ($errors) {
    json_error('Please fix the highlighted fields', 422, $errors);
}

try {
    [$photoWrites, $photoInfo] = photo_writes($id, $photos, $user['id']);
} catch (RuntimeException $e) {
    json_error($e->getMessage(), 422, ['photos' => $e->getMessage()]);
}

$remarkId = 1 + array_reduce($r['remarks'] ?? [], fn($max, $m) => max($max, (int)$m['id']), 0);
$append = [
    'remarks' => [[
        'id' => $remarkId, 'type' => 'reporter_info', 'content' => mb_substr($message, 0, 2000), 'is_internal' => false,
        'author_id' => $user['id'], 'author_name' => $user['full_name'], 'author_role' => 'reporter', 'created_at' => now(),
    ]],
    'history' => [history_entry('info_required', 'under_review', $user,
        'Reporter added information' . ($photoInfo ? ' and ' . count($photoInfo) . ' photo(s)' : ''))],
];
if ($photoInfo) {
    $append['photos'] = $photoInfo;
}

save_photo_docs($photoWrites);
try {
    fs_commit(array_merge(
        [fs_w_update('reports', $id, ['status' => 'under_review', 'updated_at' => now()], true, $append)],
        [audit_write($user, 'report.add_info', 'report', $id, ['photos' => count($photoInfo)])],
        notification_writes(admin_ids(), "Report {$r['report_code']} has new information", mb_substr($message, 0, 150), $r)
    ));
} catch (Throwable $e) {
    delete_photo_docs($photoInfo);
    throw $e;
}
send_queued_emails();

report_response($id, $user, 'Information sent');
