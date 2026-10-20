<?php
/**
 * POST /reports/arrive.php   Officer confirms arrival at the scene (mobile app)   Owner: Juliana
 * Body (JSON): { id, latitude, longitude, accuracy_m?, note? }
 *   latitude/longitude: the officer's live GPS at the moment he taps "I've arrived".
 *
 * - Only the assigned officer, and only while the report is "assigned" (dispatched).
 *   After the admin asks him to resend, the report is "assigned" again and he can send a new arrival.
 * - The API measures the distance to the reporter's pin. The report moves to "on_scene" and the
 *   admins are notified to check the location. The admin then approves (verified), asks the officer
 *   to resend (assigned), or rejects it as a false report (update-status.php).
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['officer']);
$in = input();
$id = (int)filter_var($in['id'] ?? null, FILTER_VALIDATE_INT);
$note = str_field($in, 'note');

$r = find_report($id);
if (!$r || !can_view_report($user, $r)) {
    json_error('Report not found', 404);
}
if ($r['status'] !== 'assigned') {
    json_error('You can confirm arrival only while the report is "' . status_label('assigned') . '". It is "' . status_label($r['status']) . '".', 422);
}

$lat = str_field($in, 'latitude');
$lng = str_field($in, 'longitude');
if ($lat === null || $lng === null || !is_numeric($lat) || !is_numeric($lng) || abs((float)$lat) > 90 || abs((float)$lng) > 180) {
    json_error('Your GPS location is needed. Turn on Location and try again.', 422, ['latitude' => 'GPS location is needed']);
}
$lat = round((float)$lat, 7);
$lng = round((float)$lng, 7);
$accuracy = str_field($in, 'accuracy_m');
$accuracy = $accuracy !== null && is_numeric($accuracy) && $accuracy >= 0 ? round((float)$accuracy, 1) : null;

$distance = isset($r['latitude'], $r['longitude'])
    ? round(distance_km($lat, $lng, (float)$r['latitude'], (float)$r['longitude']) * 1000, 1)
    : null;
$arrival = [
    'latitude'     => $lat,
    'longitude'    => $lng,
    'accuracy_m'   => $accuracy,
    'distance_m'   => $distance,
    'officer_id'   => $user['id'],
    'officer_name' => $user['full_name'],
    'note'         => $note !== null ? mb_substr($note, 0, 255) : null,
    'created_at'   => now(),
];
$tries = count($r['arrivals'] ?? []) + 1;
$distanceText = $distance === null ? 'distance unknown' : round($distance) . ' m from the reported pin';
$historyNote = "Officer arrived ($distanceText)" . ($tries > 1 ? ", arrival #$tries" : '') . ($note ? ". $note" : '');

fs_commit(array_merge(
    [fs_w_update('reports', $id, ['status' => 'on_scene', 'officer_arrival' => $arrival, 'updated_at' => now()], true, [
        'arrivals' => [$arrival],
        'history'  => [history_entry('assigned', 'on_scene', $user, $historyNote)],
    ])],
    [audit_write($user, 'report.arrive', 'report', $id, ['distance_m' => $distance, 'accuracy_m' => $accuracy, 'arrival' => $tries])],
    notification_writes(admin_ids(), "Officer on scene: {$r['report_code']}",
        "{$user['full_name']} arrived, $distanceText. Check the location and approve.", $r),
    notification_writes([(int)($r['reporter_id'] ?? 0)], "Report {$r['report_code']} updated",
        'A traffic officer has arrived at the scene.', $r)
));
send_queued_emails();

report_response($id, $user, 'Arrival sent. Wait for the administrator to approve before clearing the site.');
