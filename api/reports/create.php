<?php
/**
 * POST /reports/create.php   (FR-03, FR-04, FR-05, FR-08 duplicate rule, FR-09)  Owner: Juliana
 *
 * Send as multipart/form-data (so photos can be attached):
 *   accident_date      YYYY-MM-DD           required, not in the future
 *   accident_time      HH:MM                required, not later than now when the date is today
 *   accident_type_id   int                  required (GET /accident-types/list.php)
 *   location_text      road/street/landmark required
 *   barangay, municipality                  optional text
 *   latitude, longitude                     REQUIRED (GPS or map pin): used for the duplicate rule
 *                                           and for checking the officer's arrival
 *   gps_accuracy_m     number               optional, the phone's GPS accuracy in meters
 *   injury_status      none|injuries|fatalities|unknown   required
 *   description        text, 10+ characters required
 *   vehicles           JSON text, e.g. [{"type":"Car","quantity":2}]  optional
 *   source             web|mobile
 *   Photos, one field per section (see PHOTO_CATEGORIES in core/images.php), up to 3 each:
 *     photos_scene[]   overall accident scene          required
 *     photos_plate[]   vehicle plate number(s)         required
 *     photos_damage[]  collision or damage area        required
 *     photos_people[]  people affected                 optional, sensitive
 *     photos_other[]   other proof                     optional
 *   sources_<section>  optional "camera,gallery,..." (one word per file, same order)
 *
 * Duplicate candidates match type, incident time window and distance.
 * Reports remain submitted and flagged for administrator review; no automatic rejection.
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('POST');

$user = require_auth(['reporter']);
$in = input();

[$v, $errors] = validate_report_fields($in, true);
if (!isset($errors['latitude']) && (($v['latitude'] ?? null) === null || ($v['longitude'] ?? null) === null)) {
    $errors['latitude'] = 'Pin the accident location: tap "Use my current location" or tap the map';
}
$accuracy = str_field($in, 'gps_accuracy_m');
if ($accuracy !== null && is_numeric($accuracy) && $accuracy >= 0 && $accuracy < 100000) {
    $v['gps_accuracy_m'] = round((float)$accuracy, 1);
}
[$photos, $photoErrors] = read_uploaded_photos([], true);
$errors += $photoErrors;
if ($errors) {
    json_error('Please fix the highlighted fields', 422, $errors);
}

$id = fs_next_id('reports');
$code = sprintf('RA-%s-%06d', date('Y'), $id);
$source = ($in['source'] ?? 'mobile') === 'web' ? 'web' : 'mobile';

try {
    [$photoWrites, $photoInfo] = photo_writes($id, $photos, $user['id']);
} catch (RuntimeException $e) {
    json_error($e->getMessage(), 422, ['photos' => $e->getMessage()]);
}

// Find a possible duplicate using type, incident datetime and GPS distance.
$first = find_earlier_open_report($v, $id);

$report = $v + [
    'id'                    => $id,
    'report_code'           => $code,
    'reporter_id'           => $user['id'],
    'reporter_name'         => $user['full_name'],
    'contact_info'          => $user['phone'] ?: $user['email'],
    'status'                => 'submitted',
    'rejection_reason'      => null,
    'verified_by'           => null,
    'verified_by_name'      => null,
    'verified_at'           => null,
    'assigned_officer_id'   => null,
    'assigned_officer_name' => null,
    'is_flagged'            => false,
    'flag_reason'           => null,
    'duplicate_of'          => null,
    'source'                => $source,
    'photos'                => $photoInfo,
    'history'               => [history_entry(null, 'submitted', $user, 'Report submitted')],
    'remarks'               => [],
    'created_at'            => now(),
    'updated_at'            => now(),
];

$writes = [fs_w_create('reports', $id, $report)];
$writes[] = audit_write($user, 'report.create', 'report', $id, ['report_code' => $code, 'source' => $source, 'photos' => count($photoInfo)]);
if ($first) {
    $report = array_replace($report, [
        'is_flagged' => true,
        'flag_reason' => "Possible duplicate of {$first['report']['report_code']}; admin review required",
        'duplicate_of' => (int)$first['report']['id'],
        'duplicate_of_code' => $first['report']['report_code'],
        'duplicate_distance_m' => $first['distance_m'],
    ]);
    $writes[0] = fs_w_create('reports', $id, $report);
}
$writes = array_merge($writes,
    notification_writes([$user['id']], 'Report submitted', "Your report $code was received. Keep this ID to track it.", $report),
    notification_writes(admin_ids(), 'New accident report', "$code at {$v['location_text']}" . ($first ? ' (possible duplicate)' : ''), $report)
);

try {
    save_photo_docs($photoWrites); // clean partial uploads if either phase fails
    fs_commit($writes);         // all or nothing: the report, the log and the notifications
} catch (Throwable $e) {
    delete_photo_docs($photoInfo);
    throw $e;
}

// Two people may send at the same moment: check again now that both are saved.
// Link a possible duplicate without changing its submitted status.
if (!$first) {
    $earlier = find_earlier_open_report($v, $id);
    if ($earlier) {
        $saved = find_report($id);
        if ($saved && $saved['status'] === 'submitted') {
            fs_commit(duplicate_writes($saved, $earlier['report'], $earlier['distance_m']));
        }
    }
}
send_queued_emails();

json_ok(format_report(find_report($id), $user, true), 'Report submitted' , 201);
