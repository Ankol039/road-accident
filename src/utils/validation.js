/**
 * Distance + validation helpers, ported from api/core/reports.php.
 */

/** Haversine distance in metres between two {latitude, longitude} points. */
export function distanceMeters(a, b) {
  if (!a || !b) return null
  const lat1 = Number(a.latitude)
  const lng1 = Number(a.longitude)
  const lat2 = Number(b.latitude)
  const lng2 = Number(b.longitude)
  if ([lat1, lng1, lat2, lng2].some((v) => Number.isNaN(v))) return null

  const R = 6371000 // earth radius, metres
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Distance in kilometres (used by the dashboard duplicate note). */
export const distanceKm = (a, b) => {
  const m = distanceMeters(a, b)
  return m == null ? null : m / 1000
}

/**
 * Validate report input in the browser before writing to Firestore.
 * Mirrors the rules in api/core/reports.php validate_report_fields().
 * Returns { field: message } (empty object = valid).
 */
export function validateReportFields(fields) {
  const errors = {}
  if (!fields.accident_date) errors.accident_date = 'Choose the accident date'
  if (!fields.accident_time) errors.accident_time = 'Choose the accident time'
  if (!fields.accident_type_id) errors.accident_type_id = 'Choose the accident type'
  if (!fields.injury_status) errors.injury_status = 'Choose the injury status'
  if (!fields.location_text || fields.location_text.trim().length < 3) {
    errors.location_text = 'Describe the location'
  }
  if (fields.latitude == null || fields.longitude == null) {
    errors.latitude = 'Pin the exact spot on the map'
  }
  if (!fields.description || fields.description.trim().length < 10) {
    errors.description = 'Description must be at least 10 characters'
  }
  return errors
}

/** Simple email check. */
export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))
