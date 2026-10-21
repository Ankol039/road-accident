/**
 * Convert Firestore Timestamp / Date / string values into a JS Date.
 * The PHP API used "YYYY-MM-DD HH:MM:SS" strings in Philippine time; the
 * React app stores real Firestore Timestamps instead. This handles both.
 */
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') return new Date(value.replace(' ', 'T'))
  return null
}

/** Server timestamp helper name re-exported for services. */
export { serverTimestamp, Timestamp } from 'firebase/firestore'
