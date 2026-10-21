<?php
/**
 * Report statuses and the allowed workflow (section 6 of the brief).
 * Web and mobile must use these exact codes.
 */

const REPORT_STATUSES = [
    'submitted'     => 'Submitted',
    'under_review'  => 'Under Review',
    'info_required' => 'Additional Information Required',
    'assigned'      => 'Assigned',            // the admin sent the pin to a traffic officer (dispatched)
    'on_scene'      => 'Officer On Scene',    // the officer confirmed arrival; waiting for the admin's location check
    'verified'      => 'Verified',            // the admin matched the locations: officer may clear the site
    'in_progress'   => 'In Progress',         // the officer is clearing the site and removing the vehicles
    'resolved'      => 'Resolved / Closed',   // site cleared
    'rejected'      => 'Rejected',            // with a recorded reason (for example a false report)
    'duplicate'     => 'Duplicate',           // requires admin confirmation: same place as an earlier open report
];

/**
 * The workflow (see docs/API_CONTRACT.md):
 *   reporter sends -> admin dispatches an officer (assign.php) -> officer taps "I've arrived" (arrive.php)
 *   -> admin compares the officer's GPS with the reporter's pin:
 *        matches        -> verified (official record, officer may clear the site)
 *        does not match -> back to assigned (officer resends arrival) or rejected (false report)
 *   -> officer clears the site -> resolved
 *
 * From status => statuses it may move to (admin). "assigned" is reached with assign.php,
 * "on_scene" only with arrive.php.
 */
const STATUS_TRANSITIONS = [
    'submitted'     => ['under_review', 'assigned', 'rejected', 'duplicate'],
    'under_review'  => ['info_required', 'assigned', 'rejected', 'duplicate'],
    'info_required' => ['under_review', 'rejected'],
    'assigned'      => ['on_scene', 'rejected'],
    'on_scene'      => ['verified', 'assigned', 'rejected'],
    'verified'      => ['in_progress', 'resolved'],
    'in_progress'   => ['resolved'],
    'resolved'      => [],
    'rejected'      => [],
    'duplicate'     => ['submitted'], // admin: "not a duplicate", put it back in the queue
];

/** Moves the assigned officer may make (in the app). Arrival (assigned -> on_scene) goes through arrive.php. */
const OFFICER_TRANSITIONS = [
    'assigned'    => ['on_scene'],
    'verified'    => ['in_progress', 'resolved'],
    'in_progress' => ['resolved'],
];

/** Moves that only have their own endpoint, never update-status.php. */
const SPECIAL_ENDPOINT_STATUSES = [
    'assigned' => 'reports/assign.php',   // except on_scene -> assigned ("ask the officer to resend")
    'on_scene' => 'reports/arrive.php',
];

/** Statuses where the report is still being handled (used by the duplicate check and officer workload). */
const OPEN_STATUSES = ['submitted', 'under_review', 'info_required', 'assigned', 'on_scene', 'verified', 'in_progress'];

/** Statuses where an officer is working on the report. */
const OFFICER_ACTIVE_STATUSES = ['assigned', 'on_scene', 'verified', 'in_progress'];

/** Status changes the reporter is notified about. */
const REPORTER_NOTIFY_STATUSES = ['under_review', 'info_required', 'assigned', 'on_scene', 'verified', 'in_progress', 'resolved', 'rejected', 'duplicate'];

/** Statuses that mean "officially verified accident record". */
const OFFICIAL_STATUSES = ['verified', 'in_progress', 'resolved'];

const INJURY_OPTIONS = [
    'none'       => 'No injuries',
    'injuries'   => 'Injuries reported',
    'fatalities' => 'Fatalities reported',
    'unknown'    => 'Unknown',
];

const VEHICLE_TYPES = ['Car', 'Motorcycle', 'Jeepney', 'Tricycle', 'Truck', 'Bus', 'Van', 'Bicycle', 'E-bike', 'Other'];

function status_label(string $code): string
{
    return REPORT_STATUSES[$code] ?? $code;
}

function can_change_status(array $user, array $report, string $to): bool
{
    $from = $report['status'];
    if ($user['role'] === 'admin') {
        return in_array($to, STATUS_TRANSITIONS[$from] ?? [], true);
    }
    if ($user['role'] === 'officer' && (int)($report['assigned_officer_id'] ?? 0) === (int)$user['id']) {
        return in_array($to, OFFICER_TRANSITIONS[$from] ?? [], true);
    }
    return false;
}

/** One entry of the report's status history (stored in the report document). */
function history_entry(?string $from, string $to, ?array $byUser, ?string $note): array
{
    return [
        'from_status'     => $from,
        'to_status'       => $to,
        'changed_by'      => $byUser ? (int)$byUser['id'] : null,
        'changed_by_name' => $byUser['full_name'] ?? null,
        'note'            => $note !== null ? mb_substr($note, 0, 255) : null,
        'created_at'      => now(),
    ];
}
