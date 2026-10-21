<?php
/**
 * System settings the admin can change (Admin > Categories and settings).
 * Stored in Firestore as one document: settings/system
 */

const SETTING_DEFAULTS = [
    'system_name'            => 'RoadReport',
    'max_photos_per_report'  => 10,  // all sections together (each section allows up to PHOTOS_PER_SECTION)
    'duplicate_radius_m'     => 100,  // a new report this close to an earlier OPEN report is a duplicate
    'duplicate_window_minutes' => 60,
    'arrival_match_radius_m' => 30,  // officer's arrival GPS this close to the reporter's pin = "matches"
];

function app_settings(): array
{
    static $settings = null;
    if ($settings === null) {
        $saved = fs_get('settings', 'system') ?? [];
        unset($saved['_id']);
        $defaults = SETTING_DEFAULTS;
        $defaults['max_photos_per_report'] = (int)config('uploads.max_files', 10);
        $defaults['duplicate_radius_m'] = (float)config('duplicates.radius_m', 100);
        $defaults['duplicate_window_minutes'] = (int)config('duplicates.window_minutes', 60);
        $defaults['arrival_match_radius_m'] = (float)config('arrival.match_radius_m', 30);
        $settings = array_merge($defaults, array_intersect_key($saved, SETTING_DEFAULTS));
    }
    return $settings;
}

function app_setting(string $key)
{
    return app_settings()[$key] ?? SETTING_DEFAULTS[$key] ?? null;
}
