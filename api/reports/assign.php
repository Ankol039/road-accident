<?php
/**
 * POST /reports/assign.php   (FR-07)   Owner: Juliana
 * Body (JSON): { id, officer_id, note? }
 * Dispatch: the admin sends the report's pin to a traffic officer.
 *   - A "submitted" or "under review" report moves to "assigned" (officer dispatched). The officer gets
 *     a notification and sees the pin in the app, goes to the scene and taps "I've arrived" (arrive.php).
 *   - A report that is assigned, verified or in progress can be given to another officer
 *     (the status stays the same).
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['admin']);
$in = input();
$id = (int)filter_var($in['id'] ?? null, FILTER_VALIDATE_INT);
$officerId = (int)filter_var($in['officer_id'] ?? null, FILTER_VALIDATE_INT);
$note = str_field($in, 'note');

$r = find_report($id);
if (!$r) {
    json_error('Report not found', 404);
}
$reassign = in_array($r['status'], ['assigned', 'verified', 'in_progress'], true);
if (!$reassign && !in_array($r['status'], ['submitted', 'under_review'], true)) {
    json_error('An officer cannot be sent while the report is "' . status_label($r['status']) . '".', 422);
}
$officer = $officerId ? find_user($officerId) : null;
if (!$officer || $officer['role'] !== 'officer' || $officer['status'] !== 'active') {
    json_error('Choose an active traffic officer', 422, ['officer_id' => 'Choose an officer']);
}
if ($reassign && (int)$r['assigned_officer_id'] === $officerId) {
    json_error('This officer is already assigned', 422, ['officer_id' => 'Choose a different officer']);
}

$changes = [
    'assigned_officer_id'   => $officerId,
    'assigned_officer_name' => $officer['full_name'],
    'updated_at'            => now(),
];
$append = [];
if (!$reassign) {
    $changes['status'] = 'assigned';
    $append['history'] = [history_entry($r['status'], 'assigned', $user,
        "Officer dispatched: {$officer['full_name']}" . ($note ? ". $note" : ''))];
} else {
    // Keep a record of the hand-over in the remarks
    $append['remarks'] = [[
        'id' => count($r['remarks'] ?? []) + 1, 'type' => 'action', 'is_internal' => true,
        'content' => "Reassigned from {$r['assigned_officer_name']} to {$officer['full_name']}" . ($note ? ": $note" : ''),
        'author_id' => $user['id'], 'author_name' => $user['full_name'], 'author_role' => 'admin', 'created_at' => now(),
    ]];
}

$writes = array_merge(
    [fs_w_update('reports', $id, $changes, true, $append)],
    [audit_write($user, 'report.assign', 'report', $id, ['officer_id' => $officerId, 'officer' => $officer['full_name'], 'reassign' => $reassign])],
    notification_writes([$officerId], 'Go to this accident: ' . $r['report_code'],
        "{$r['location_text']}" . (isset($r['latitude']) ? sprintf(' (pin %.5f, %.5f)', $r['latitude'], $r['longitude']) : '')
        . '. Open the report for the map, and tap "I\'ve arrived" at the scene.' . ($note ? " $note" : ''), $r),
    $reassign ? [] : notification_writes([$r['reporter_id'] ?? 0], "Report {$r['report_code']} updated",
        'A traffic officer is on the way to the accident.', $r)
);
fs_commit($writes);
send_queued_emails();

report_response($id, $user, $reassign ? 'Officer changed' : 'Officer assigned');
