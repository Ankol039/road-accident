<?php
/**
 * Shared report helpers: one JSON shape for a report everywhere.
 *
 * A report is ONE Firestore document: reports/{id}. Its vehicles, status history,
 * remarks and the list of photo ids are stored inside it, so the details page needs
 * only one read. The photo files themselves are in report_photos/{id}.
 *
 * PUBLIC REPORT vs OFFICIAL RECORD:
 *   Every report starts as a public-submitted report (status "submitted").
 *   It becomes an officially verified accident record when the admin has checked that the
 *   traffic officer's arrival location matches the reporter's pin and approves it
 *   (verified_at is set and the status is verified, in progress or resolved).
 */

function find_report(int $id): ?array
{
    return $id > 0 ? fs_get('reports', $id) : null;
}

function find_report_by_code(string $code): ?array
{
    return fs_first('reports', [['report_code', '==', strtoupper(trim($code))]]);
}

/** Accident categories by id (read once per request). */
function accident_types_map(): array
{
    static $map = null;
    if ($map === null) {
        $map = [];
        foreach (fs_query('accident_types') as $t) {
            $t['id'] = (int)($t['id'] ?? $t['_id']);
            $map[$t['id']] = $t;
        }
    }
    return $map;
}

function is_official_record(array $r): bool
{
    return !empty($r['verified_at']) && in_array($r['status'], OFFICIAL_STATUSES, true);
}

/**
 * Turn a report document into the JSON the apps receive.
 * Reporter contact details and flags are only included for staff (access restriction).
 * $full adds vehicles, photos, history, remarks (the details page).
 */
function format_report(array $r, array $viewer, bool $full = false): array
{
    $isStaff = in_array($viewer['role'], ['admin', 'officer'], true);
    $types = accident_types_map();
    $typeId = (int)($r['accident_type_id'] ?? 0);
    $out = [
        'id'                 => (int)$r['id'],
        'report_code'        => $r['report_code'],
        'accident_date'      => $r['accident_date'],
        'accident_time'      => substr((string)$r['accident_time'], 0, 5),
        'location_text'      => $r['location_text'],
        'barangay'           => $r['barangay'] ?? null,
        'municipality'       => $r['municipality'] ?? null,
        'latitude'           => isset($r['latitude']) ? (float)$r['latitude'] : null,
        'longitude'          => isset($r['longitude']) ? (float)$r['longitude'] : null,
        'accident_type_id'   => $typeId,
        'accident_type'      => $types[$typeId]['name'] ?? ($r['accident_type'] ?? 'Unknown'),
        'injury_status'      => $r['injury_status'],
        'injury_label'       => INJURY_OPTIONS[$r['injury_status']] ?? $r['injury_status'],
        'description'        => $r['description'],
        'status'             => $r['status'],
        'status_label'       => status_label($r['status']),
        'is_official_record' => is_official_record($r),
        'rejection_reason'   => $r['rejection_reason'] ?? null,
        'assigned_officer'   => !empty($r['assigned_officer_id'])
            ? ['id' => (int)$r['assigned_officer_id'], 'name' => $r['assigned_officer_name'] ?? null] : null,
        'photo_count'        => count($r['photos'] ?? []),
        'gps_accuracy_m'     => isset($r['gps_accuracy_m']) ? (float)$r['gps_accuracy_m'] : null,
        'duplicate_of'       => isset($r['duplicate_of']) ? (int)$r['duplicate_of'] : null,
        'duplicate_of_code'  => $r['duplicate_of_code'] ?? null,
        'source'             => $r['source'] ?? 'web',
        'date_submitted'     => $r['created_at'],
        'updated_at'         => $r['updated_at'] ?? $r['created_at'],
    ];
    if ($isStaff) {
        $out['reporter'] = [
            'id'      => isset($r['reporter_id']) ? (int)$r['reporter_id'] : null,
            'name'    => $r['reporter_name'] ?? null,
            'contact' => $r['contact_info'] ?? null,
        ];
        $out['verified_by'] = $r['verified_by_name'] ?? null;
        $out['verified_at'] = $r['verified_at'] ?? null;
        $out['is_flagged']  = (bool)($r['is_flagged'] ?? false);
        $out['flag_reason'] = $r['flag_reason'] ?? null;
        $out['duplicate_distance_m'] = isset($r['duplicate_distance_m']) ? (float)$r['duplicate_distance_m'] : null;
        // The officer's latest "I've arrived" GPS, compared with the reporter's pin
        $a = $r['officer_arrival'] ?? null;
        $out['officer_arrival'] = $a ? [
            'latitude'   => (float)$a['latitude'],
            'longitude'  => (float)$a['longitude'],
            'accuracy_m' => isset($a['accuracy_m']) ? (float)$a['accuracy_m'] : null,
            'distance_m' => isset($a['distance_m']) ? (float)$a['distance_m'] : null,
            'matches'    => arrival_assessment($r)['matches'],
            'accuracy_uncertain' => arrival_assessment($r)['accuracy_uncertain'],
            'review_required' => arrival_assessment($r)['review_required'],
            'officer'    => $a['officer_name'] ?? null,
            'date'       => $a['created_at'] ?? null,
        ] : null;
        $out['arrival_count'] = count($r['arrivals'] ?? []);
        $out['arrival_match_radius_m'] = (float)app_setting('arrival_match_radius_m');
    }
    if (!$full) {
        return $out;
    }

    $out['vehicles'] = array_map(fn($v) => ['type' => $v['type'], 'quantity' => (int)$v['quantity']], $r['vehicles'] ?? []);
    $out['photos'] = array_map(function ($p) {
        $cat = isset(PHOTO_CATEGORIES[$p['category'] ?? '']) ? $p['category'] : 'other';
        return [
            'id'             => (int)$p['id'],
            'url'            => photo_url((int)$p['id']),
            'name'           => $p['name'] ?? null,
            'category'       => $cat,
            'category_label' => PHOTO_CATEGORIES[$cat]['label'],
            'sensitive'      => PHOTO_CATEGORIES[$cat]['sensitive'],
            'source'         => $p['source'] ?? null, // camera, gallery, or null (not told)
        ];
    }, array_values(array_filter($r['photos'] ?? [], fn($p) => $isStaff || empty(PHOTO_CATEGORIES[$p['category'] ?? 'other']['sensitive']))));
    $out['photo_sections'] = photo_categories_public();
    $history = $r['history'] ?? [];
    usort($history, fn($a, $b) => strcmp($a['created_at'], $b['created_at']));
    $out['history'] = array_map(fn($h) => [
        'from_status'  => $h['from_status'] ?? null,
        'status'       => $h['to_status'],
        'status_label' => status_label($h['to_status']),
        'note'         => $h['note'] ?? null,
        'changed_by'   => $isStaff ? ($h['changed_by_name'] ?? null) : null,
        'date'         => $h['created_at'],
    ], $history);
    // Staff see all remarks; the reporter sees only the ones not marked internal
    $remarks = array_values(array_filter($r['remarks'] ?? [], fn($m) => $isStaff || empty($m['is_internal'])));
    usort($remarks, fn($a, $b) => strcmp($a['created_at'], $b['created_at']));
    $out['remarks'] = array_map(fn($m) => [
        'id'          => (int)$m['id'],
        'type'        => $m['type'],
        'content'     => $m['content'],
        'officer'     => $m['author_name'] ?? null,
        'author_role' => $m['author_role'] ?? null,
        'is_internal' => (bool)($m['is_internal'] ?? false),
        'date'        => $m['created_at'],
    ], $remarks);
    if ($isStaff) {
        $out['allowed_next_statuses'] = array_values(array_filter(
            STATUS_TRANSITIONS[$r['status']] ?? [],
            fn($s) => can_change_status($viewer, $r, $s)
        ));
    }
    return $out;
}

/** Link the apps use to show a photo. Includes the token because <img> cannot send headers. */
function photo_url(int $photoId): string
{
    $url = api_base_url() . '/photos/view.php?id=' . $photoId;
    $token = bearer_token();
    return $token ? $url . '&token=' . $token : $url;
}

// ---------------------------------------------------------------- search and filters (FR-11)

/**
 * Reports for staff lists, statistics and exports (without automatic duplicates unless asked for).
 * Firestore filters only by exact matches here (no index setup needed);
 * everything else is filtered in PHP by filter_reports().
 */
function load_reports(array $viewer, array $f = []): array
{
    $where = [];
    if ($viewer['role'] === 'officer') {
        $where[] = ['assigned_officer_id', '==', (int)$viewer['id']];
    }
    if (!empty($f['status']) && isset(REPORT_STATUSES[$f['status']])) {
        $where[] = ['status', '==', $f['status']];
    }
    $rows = fs_query('reports', $where);
    // Reports the system disregarded as duplicates are left out, unless the admin filters for them
    if (($f['status'] ?? null) !== 'duplicate') {
        $rows = array_filter($rows, fn($r) => $r['status'] !== 'duplicate');
    }
    return filter_reports($rows, $f);
}

/** Read the filters from the query string (same names for list, export and summaries). */
function report_filters_from_query(): array
{
    $f = [];
    foreach (['status', 'municipality', 'barangay', 'q', 'date_from', 'date_to'] as $k) {
        $v = str_field($_GET, $k);
        if ($v !== null) {
            $f[$k] = $v;
        }
    }
    if ($t = int_query('accident_type_id')) {
        $f['accident_type_id'] = $t;
    }
    foreach (['flagged', 'official'] as $k) {
        if (($_GET[$k] ?? '') === '1') {
            $f[$k] = true;
        }
    }
    foreach (['date_from', 'date_to'] as $k) {
        if (isset($f[$k]) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $f[$k])) {
            unset($f[$k]);
        }
    }
    return $f;
}

function filter_reports(array $rows, array $f): array
{
    $q = isset($f['q']) ? mb_strtolower($f['q']) : null;
    $rows = array_filter($rows, function ($r) use ($f, $q) {
        if (!empty($f['status']) && $r['status'] !== $f['status']) return false;
        if (!empty($f['accident_type_id']) && (int)$r['accident_type_id'] !== (int)$f['accident_type_id']) return false;
        foreach (['municipality', 'barangay'] as $k) {
            if (!empty($f[$k]) && mb_strtolower((string)($r[$k] ?? '')) !== mb_strtolower($f[$k])) return false;
        }
        if (!empty($f['date_from']) && $r['accident_date'] < $f['date_from']) return false;
        if (!empty($f['date_to']) && $r['accident_date'] > $f['date_to']) return false;
        if (!empty($f['flagged']) && empty($r['is_flagged'])) return false;
        if (!empty($f['official']) && !is_official_record($r)) return false;
        if ($q !== null) {
            $hay = mb_strtolower(implode(' ', [
                $r['report_code'], $r['location_text'], $r['barangay'] ?? '', $r['municipality'] ?? '',
                $r['description'], $r['reporter_name'] ?? '',
            ]));
            if (!str_contains($hay, $q)) return false;
        }
        return true;
    });
    // Newest first
    usort($rows, fn($a, $b) => [$b['created_at'], $b['id']] <=> [$a['created_at'], $a['id']]);
    return array_values($rows);
}

// ---------------------------------------------------------------- duplicates (FR-08)

function distance_km(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return 6371 * 2 * asin(min(1, sqrt($a)));
}

/** A candidate is not a confirmed duplicate. Cross-midnight times are supported. */
function duplicate_candidate(array $new, array $old, float $radius, int $minutes): ?float
{
    if (!isset($new['latitude'], $new['longitude'], $old['latitude'], $old['longitude'])) return null;
    if ((int)($new['accident_type_id'] ?? 0) !== (int)($old['accident_type_id'] ?? 0)) return null;
    $a = strtotime(($new['accident_date'] ?? '') . ' ' . ($new['accident_time'] ?? ''));
    $b = strtotime(($old['accident_date'] ?? '') . ' ' . ($old['accident_time'] ?? ''));
    if ($a === false || $b === false || abs($a - $b) > $minutes * 60) return null;
    $distance = distance_km((float)$new['latitude'], (float)$new['longitude'], (float)$old['latitude'], (float)$old['longitude']) * 1000;
    return $distance <= $radius ? round($distance, 1) : null;
}

function find_earlier_open_report(array $report, ?int $beforeId = null): ?array
{
    $best = null;
    foreach (fs_query('reports', [['status', 'in', OPEN_STATUSES]]) as $old) {
        if ($beforeId !== null && (int)$old['id'] >= $beforeId) continue;
        $distance = duplicate_candidate($report, $old, (float)app_setting('duplicate_radius_m'), (int)app_setting('duplicate_window_minutes'));
        if ($distance !== null && ($best === null || $distance < $best['distance_m'])) {
            $best = ['report' => $old, 'distance_m' => $distance];
        }
    }
    return $best;
}

function duplicate_writes(array $r, array $first, float $distance, ?array $byUser = null): array
{
    $note = "Possible duplicate of {$first['report_code']} ($distance m away). Admin review required.";
    return [
        fs_w_update('reports', (int)$r['id'], [
            'is_flagged' => true, 'flag_reason' => $note,
            'duplicate_of' => (int)$first['id'], 'duplicate_of_code' => $first['report_code'],
            'duplicate_distance_m' => $distance, 'updated_at' => now(),
        ]),
        audit_write($byUser, 'report.possible_duplicate', 'report', (int)$r['id'], ['duplicate_of' => $first['report_code'], 'distance_m' => $distance]),
    ];
}

/** GPS is supporting evidence; accuracy estimates are not proof of arrival. */
function arrival_assessment(array $report): array
{
    $a = $report['officer_arrival'] ?? [];
    $distance = $a['distance_m'] ?? null;
    $radius = (float)app_setting('arrival_match_radius_m');
    $accuracy = max((float)($a['accuracy_m'] ?? 0), (float)($report['gps_accuracy_m'] ?? 0));
    $known = isset($a['accuracy_m'], $report['gps_accuracy_m']);
    $close = $distance !== null && (float)$distance <= $radius;
    return ['matches' => $close, 'accuracy_uncertain' => !$known || $accuracy > $radius,
        'review_required' => !$close || !$known || $accuracy > $radius];
}

// ---------------------------------------------------------------- report field validation

/**
 * Validate report fields (used by create and edit). Only checks keys present in $in
 * unless $all is true. Returns [clean values, errors].
 */
function validate_report_fields(array $in, bool $all = true, array $existing = []): array
{
    $v = [];
    $errors = [];
    $has = fn($k) => $all || array_key_exists($k, $in);

    if ($has('accident_date')) {
        $date = str_field($in, 'accident_date');
        $d = $date ? DateTime::createFromFormat('Y-m-d', $date) : false;
        if (!$d || $d->format('Y-m-d') !== $date) {
            $errors['accident_date'] = 'Enter the date of the accident';
        } elseif ($date > date('Y-m-d')) {
            $errors['accident_date'] = 'The date cannot be in the future';
        } else {
            $v['accident_date'] = $date;
        }
    }
    if ($has('accident_time')) {
        $time = str_field($in, 'accident_time');
        if (!$time || !preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $time)) {
            $errors['accident_time'] = 'Enter the time (HH:MM)';
        } else {
            $v['accident_time'] = substr($time, 0, 5);
        }
    }
    // An accident that happened today cannot have a time later than now (5 minutes allowed for phone clocks).
    // When editing only one of the two, compare with the value already saved ($existing).
    $checkDate = isset($errors['accident_date']) ? null : ($v['accident_date'] ?? $existing['accident_date'] ?? null);
    $checkTime = isset($errors['accident_time']) ? null : ($v['accident_time'] ?? $existing['accident_time'] ?? null);
    if ($checkDate === date('Y-m-d') && $checkTime !== null
        && substr((string)$checkTime, 0, 5) > date('H:i', time() + 300)) {
        $errors['accident_time'] = 'The time cannot be later than now';
        unset($v['accident_time']);
    }
    if ($has('accident_type_id')) {
        $typeId = filter_var($in['accident_type_id'] ?? null, FILTER_VALIDATE_INT);
        $type = $typeId ? (accident_types_map()[(int)$typeId] ?? null) : null;
        if (!$type || empty($type['is_active'])) {
            $errors['accident_type_id'] = 'Choose the accident type';
        } else {
            $v['accident_type_id'] = (int)$typeId;
            $v['accident_type'] = $type['name'];
        }
    }
    if ($has('location_text')) {
        $location = str_field($in, 'location_text');
        if ($location === null || mb_strlen($location) < 3) {
            $errors['location_text'] = 'Enter the road, street or landmark';
        } else {
            $v['location_text'] = mb_substr($location, 0, 255);
        }
    }
    foreach (['barangay', 'municipality'] as $k) {
        if ($has($k)) {
            $s = str_field($in, $k);
            $v[$k] = $s !== null ? mb_substr($s, 0, 100) : null;
        }
    }
    if ($has('latitude') || $has('longitude')) {
        $lat = str_field($in, 'latitude');
        $lng = str_field($in, 'longitude');
        if (($lat === null) !== ($lng === null)) {
            $errors['latitude'] = 'Send both latitude and longitude, or neither';
        } elseif ($lat !== null && (!is_numeric($lat) || !is_numeric($lng) || abs((float)$lat) > 90 || abs((float)$lng) > 180)) {
            $errors['latitude'] = 'Invalid GPS coordinates';
        } else {
            $v['latitude'] = $lat !== null ? round((float)$lat, 7) : null;
            $v['longitude'] = $lng !== null ? round((float)$lng, 7) : null;
        }
    }
    if ($has('injury_status')) {
        $injury = str_field($in, 'injury_status') ?? 'unknown';
        if (!array_key_exists($injury, INJURY_OPTIONS)) {
            $errors['injury_status'] = 'Choose an injury option';
        } else {
            $v['injury_status'] = $injury;
        }
    }
    if ($has('description')) {
        $description = str_field($in, 'description');
        if ($description === null || mb_strlen($description) < 10) {
            $errors['description'] = 'Describe what happened (at least 10 characters)';
        } else {
            $v['description'] = mb_substr($description, 0, 5000);
        }
    }
    if ($has('vehicles')) {
        $vehicles = [];
        if (!empty($in['vehicles'])) {
            $decoded = is_array($in['vehicles']) ? $in['vehicles'] : json_decode((string)$in['vehicles'], true);
            if (!is_array($decoded)) {
                $errors['vehicles'] = 'Invalid vehicles list';
            } else {
                foreach ($decoded as $veh) {
                    $type = trim((string)($veh['type'] ?? ''));
                    $qty = (int)($veh['quantity'] ?? 1);
                    if ($type !== '' && $qty > 0 && $qty < 100) {
                        $vehicles[] = ['type' => mb_substr($type, 0, 40), 'quantity' => $qty];
                    }
                }
            }
        }
        $v['vehicles'] = $vehicles;
    }
    return [$v, $errors];
}

/** Keep the report on the details page JSON after a change. */
function report_response(int $id, array $viewer, string $message, int $code = 200): void
{
    json_ok(format_report(find_report($id), $viewer, true), $message, $code);
}
