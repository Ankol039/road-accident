<?php
/**
 * POST /reports/update-status.php   (FR-07, FR-08, FR-09, FR-14)  Owner: Juliana
 * Body (JSON): { id, status, note?, reason? }
 *   - Only moves listed in core/status.php are allowed.
 *   - "rejected" needs a reason (for example "False report: nothing at the location").
 *   - Dispatching an officer is reports/assign.php; the officer's arrival is reports/arrive.php.
 *
 * After the officer arrives ("on_scene"), the admin compares the officer's GPS with the reporter's pin:
 *   verified   locations match: official accident record, the officer may clear the site
 *   assigned   does not match: the officer must go to the pin and send "I've arrived" again (note required)
 *   rejected   false report (reason required)
 * Then the officer: verified -> in_progress (clearing) -> resolved (site cleared).
 * A report the system marked "duplicate" can be put back with status "submitted" (note: why it is not a duplicate).
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['admin', 'officer']);
$in = input();
$id = (int)filter_var($in['id'] ?? null, FILTER_VALIDATE_INT);
$to = str_field($in, 'status');
$note = str_field($in, 'note');
$reason = str_field($in, 'reason');

$r = find_report($id);
if (!$r || !can_view_report($user, $r)) {
    json_error('Report not found', 404);
}
$from = $r['status'];
if (!$to || !isset(REPORT_STATUSES[$to])) {
    json_error('Unknown status', 422, ['status' => 'Unknown status']);
}
$resend = $from === 'on_scene' && $to === 'assigned';
if (isset(SPECIAL_ENDPOINT_STATUSES[$to]) && !$resend) {
    json_error('Use ' . SPECIAL_ENDPOINT_STATUSES[$to] . ' for this step', 422);
}
if (!can_change_status($user, $r, $to)) {
    json_error('Cannot change status from "' . status_label($from) . '" to "' . status_label($to) . '"', 422);
}
if ($to === 'rejected' && $reason === null) {
    json_error('A reason is required to reject a report', 422, ['reason' => 'Enter the reason']);
}
if ($to === 'info_required' && $note === null) {
    json_error('Tell the reporter what information is missing', 422, ['note' => 'Enter what is missing']);
}
if ($resend && $note === null) {
    json_error('Tell the officer what to fix (for example: go to the pinned spot)', 422, ['note' => 'Tell the officer what to fix']);
}
// Admin must document approval whenever GPS is uncertain or outside the configured radius.
if ($from === 'on_scene' && $to === 'verified' && arrival_assessment($r)['review_required'] && $note === null) {
    json_error('GPS is uncertain or outside the match radius. Record the evidence supporting approval, or request a new arrival.', 422, ['note' => 'Describe the evidence checked']);
}
if ($to === 'duplicate') {
    $original = !empty($r['duplicate_of']) ? find_report((int)$r['duplicate_of']) : null;
    if (!$original || $original['id'] === $id || in_array($original['status'], ['duplicate', 'rejected'], true) || $note === null) {
        json_error('Link a valid original report using Flag first, and provide a confirmation note.', 422, ['note' => 'Explain why both reports describe the same incident']);
    }
}
if ($from === 'duplicate' && $note === null) {
    json_error('Say why this is not a duplicate', 422, ['note' => 'Say why this is not a duplicate']);
}

$changes = ['status' => $to, 'updated_at' => now()];
if ($to === 'verified') {
    $changes['verified_by'] = $user['id'];
    $changes['verified_by_name'] = $user['full_name'];
    $changes['verified_at'] = now();
}
if ($to === 'rejected') {
    $changes['rejection_reason'] = mb_substr($reason, 0, 255);
}
if ($from === 'duplicate') {
    $changes += ['is_flagged' => false, 'flag_reason' => null, 'duplicate_of' => null, 'duplicate_of_code' => null, 'duplicate_distance_m' => null];
}
$historyNote = match (true) {
    $to === 'rejected'  => "Rejected: $reason",
    $resend             => "Location does not match. Officer asked to resend arrival: $note",
    $from === 'duplicate' => "Not a duplicate: $note",
    $to === 'verified' && $from === 'on_scene' => 'Admin reviewed arrival and evidence. Approved to clear the site' . ($note ? ". $note" : ''),
    default             => $note,
};

$writes = [
    fs_w_update('reports', $id, $changes, true, ['history' => [history_entry($from, $to, $user, $historyNote)]]),
    audit_write($user, 'report.status', 'report', $id, ['from' => $from, 'to' => $to, 'note' => $historyNote]),
];

// Tell the reporter
if (!empty($r['reporter_id']) && in_array($to, REPORTER_NOTIFY_STATUSES, true) && !$resend) {
    $msg = match ($to) {
        'verified'    => 'The traffic office verified your report. The officer will now clear the scene.',
        'in_progress' => 'The traffic officer is clearing the accident site.',
        'resolved'    => 'The accident site has been cleared. Thank you for reporting.',
        'rejected'    => "Your report was rejected: $reason",
        'info_required' => "More information is needed: $note",
        default       => 'Status is now: ' . status_label($to),
    };
    $writes = array_merge($writes, notification_writes([$r['reporter_id']], "Report {$r['report_code']} updated", $msg, $r));
}
// Tell the assigned officer about the admin's decisions
if ($user['role'] === 'admin' && !empty($r['assigned_officer_id']) && in_array($from, OFFICER_ACTIVE_STATUSES, true)) {
    $msg = match (true) {
        $to === 'verified' => 'Approved: the location matches. You may now clear the site and remove the vehicles.',
        $resend            => "Your location does not match the reported pin. $note Then tap \"I've arrived\" again.",
        $to === 'rejected' => "Report closed as rejected: $reason. No further action needed.",
        default            => 'Status is now: ' . status_label($to),
    };
    $writes = array_merge($writes, notification_writes([$r['assigned_officer_id']], "Report {$r['report_code']}", $msg, $r));
}
// Officers' updates go to the admins
if ($user['role'] === 'officer') {
    $writes = array_merge($writes, notification_writes(admin_ids(), "Report {$r['report_code']} updated",
        "{$user['full_name']} set the status to " . status_label($to) . ($note ? ": $note" : ''), $r));
}
// Reject a stale status update instead of overwriting another staff action.
if (!empty($r['_update_time'])) $writes[0]['currentDocument'] = ['updateTime' => $r['_update_time']];
try { fs_commit($writes); }
catch (FirestoreException $e) {
    if (in_array($e->status, ['FAILED_PRECONDITION', 'ABORTED'], true)) json_error('This report changed. Refresh and try again.', 409);
    throw $e;
}
send_queued_emails();

report_response($id, $user, match (true) {
    $to === 'verified' && $from === 'on_scene' => 'Approved. The officer was told to clear the site.',
    $resend => 'The officer was asked to send the arrival again',
    default => 'Status updated',
});
