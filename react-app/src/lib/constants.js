/**
 * Application-wide constants, ported from the PHP app.
 * Sources:
 *   - api/core/status.php   (REPORT_STATUSES, INJURY_OPTIONS, VEHICLE_TYPES)
 *   - js/config.js          (BULACAN_TOWNS, MAP_CENTER, MAX_PHOTO_MB)
 *   - js/ui.js              (STATUS_LABELS, STATUS_HELP)
 */

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'RoadReport'

/** Default map center: Malolos, Bulacan. */
export const MAP_CENTER = [14.8433, 120.8114]

/** Largest photo accepted before the browser shrinks it (MB). */
export const MAX_PHOTO_MB = 10

/** Photos each stored document must stay under (Firestore 1 MB doc limit). */
export const MAX_STORED_KB = 900

/** Longest side of a stored photo, in pixels. */
export const PHOTO_MAX_SIDE_PX = 1280

/** JPEG quality used when shrinking photos in the browser. */
export const PHOTO_JPEG_QUALITY = 0.72

/** Bulacan cities and municipalities (location field suggestions). */
export const BULACAN_TOWNS = [
  'Angat', 'Balagtas', 'Baliwag', 'Bocaue', 'Bulakan', 'Bustos', 'Calumpit',
  'Doña Remedios Trinidad', 'Guiguinto', 'Hagonoy', 'Malolos', 'Marilao',
  'Meycauayan', 'Norzagaray', 'Obando', 'Pandi', 'Paombong', 'Plaridel',
  'Pulilan', 'San Ildefonso', 'San Jose del Monte', 'San Miguel', 'San Rafael',
  'Santa Maria',
]

/** User roles. report/admin/officer are the roles from api/core/auth.php. */
export const USER_ROLES = ['reporter', 'admin', 'officer']

/** Roles that may use this web app. Officers and reporters use the mobile app. */
export const STAFF_ROLES = ['admin']

/** Report workflow statuses (codes) - matches api/core/status.php. */
export const REPORT_STATUSES = [
  'submitted', 'under_review', 'info_required', 'assigned', 'on_scene',
  'verified', 'in_progress', 'resolved', 'rejected', 'duplicate',
]

/** Human labels for each status. */
export const STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  info_required: 'Additional Information Required',
  assigned: 'Assigned',
  on_scene: 'Officer On Scene',
  verified: 'Verified',
  in_progress: 'In Progress',
  resolved: 'Resolved / Closed',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
}

/** What each status means in this workflow. */
export const STATUS_HELP = {
  submitted: 'New report from a public reporter.',
  under_review: 'The administrator is checking the report.',
  info_required: 'Waiting for the reporter to send missing information.',
  assigned: 'Officer dispatched: on the way to the pin.',
  on_scene: "The officer says he has arrived. Check that his location matches the reporter's pin.",
  verified: 'Locations matched and approved. The officer may clear the site.',
  in_progress: 'The officer is clearing the site and removing the vehicles.',
  resolved: 'Site cleared. The report is closed.',
  rejected: 'Closed without action (reason recorded).',
  duplicate: 'Disregarded automatically: an earlier open report exists at the same spot.',
}

/** Statuses counted as verified accident records. */
export const OFFICIAL_STATUSES = ['verified', 'in_progress', 'resolved']

/** Statuses that mean the report is still open. */
export const OPEN_STATUSES = [
  'submitted', 'under_review', 'info_required', 'assigned', 'on_scene', 'verified', 'in_progress',
]

/** Injury outcomes (api/core/status.php INJURY_OPTIONS). */
export const INJURY_OPTIONS = [
  { value: 'fatal', label: 'Fatal' },
  { value: 'serious', label: 'Serious injury' },
  { value: 'slight', label: 'Slight injury' },
  { value: 'none', label: 'No injury' },
  { value: 'unknown', label: 'Unknown' },
]

/** Vehicle types (api/core/status.php VEHICLE_TYPES). */
export const VEHICLE_TYPES = [
  'Car', 'Jeepney', 'Tricycle', 'Motorcycle', 'Truck', 'Bus', 'Van', 'Bicycle', 'Pedestrian', 'Other',
]

/** Photo evidence categories (api/core/images.php PHOTO_CATEGORIES). */
export const PHOTO_CATEGORIES = [
  { key: 'scene', label: 'Scene', required: true },
  { key: 'plate', label: 'Plate', required: true },
  { key: 'damage', label: 'Damage', required: true },
  { key: 'people', label: 'People (sensitive)', required: false, sensitive: true },
  { key: 'other', label: 'Other', required: false },
]

/** Color for each status (Leaflet markers + badges), ported from js/map.js. */
export const STATUS_COLORS = {
  submitted: '#6c757d',
  under_review: '#1f4f8a',
  info_required: '#b38600',
  verified: '#0b5039',
  assigned: '#43378c',
  on_scene: '#0b6e8a',
  in_progress: '#c4610f',
  resolved: '#0f6b4c',
  rejected: '#c8322b',
  duplicate: '#a0a5aa',
}

/** Firestore collection names (kept identical to the PHP app). */
export const COLLECTIONS = {
  users: 'users',
  reports: 'reports',
  reportPhotos: 'report_photos',
  notifications: 'notifications',
  auditLogs: 'audit_logs',
  accidentTypes: 'accident_types',
  emergencyContacts: 'emergency_contacts',
  settings: 'settings',
  counters: 'counters',
}

/** Theme colors for charts (dark burnt-orange palette). */
export const CHART_COLORS = {
  ink: '#f0ece2',
  muted: '#98a09c',
  grid: '#2a3236',
  bar: '#e4572e',
  barHover: '#c8441f',
  tooltipBg: '#171c1f',
}
