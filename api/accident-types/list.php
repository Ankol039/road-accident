<?php
/**
 * GET /accident-types/list.php   Dropdown options for the report form (no login needed).
 * Admins add ?all=1 to include inactive types (and how many reports use each one).
 */
require __DIR__ . '/../core/bootstrap.php';
require_method('GET');

$all = ($_GET['all'] ?? '') === '1' && (current_user()['role'] ?? '') === 'admin';
$types = array_values(array_filter(accident_types_map(), fn($t) => $all || !empty($t['is_active'])));
usort($types, fn($a, $b) => [$a['name'] === 'Other', mb_strtolower($a['name'])] <=> [$b['name'] === 'Other', mb_strtolower($b['name'])]);

$usage = [];
if ($all) {
    foreach (fs_query('reports', [], [], null, ['accident_type_id']) as $r) {
        $usage[(int)$r['accident_type_id']] = ($usage[(int)$r['accident_type_id']] ?? 0) + 1;
    }
}

json_ok([
    'accident_types' => array_map(fn($t) => [
        'id' => $t['id'], 'name' => $t['name'], 'description' => $t['description'] ?? null, 'is_active' => (bool)($t['is_active'] ?? true),
    ] + ($all ? ['report_count' => $usage[$t['id']] ?? 0] : []), $types),
    'injury_options' => array_map(fn($k, $v) => ['value' => $k, 'label' => $v], array_keys(INJURY_OPTIONS), INJURY_OPTIONS),
    'vehicle_types'  => VEHICLE_TYPES,
    'statuses'       => array_map(fn($k, $v) => ['value' => $k, 'label' => $v], array_keys(REPORT_STATUSES), REPORT_STATUSES),
    'max_photos'     => (int)app_setting('max_photos_per_report'),
    'photo_sections' => photo_categories_public(),
]);
