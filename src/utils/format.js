/**
 * Formatting helpers, ported from js/ui.js.
 */
import { STATUS_LABELS } from '../lib/constants.js'

/** Join the location parts of a report into one readable string. */
export const place = (r) =>
  [r?.location_text, r?.barangay, r?.municipality].filter(Boolean).join(', ')

export const statusLabel = (status, label) =>
  label || STATUS_LABELS[status] || status || ''

/** Report code fallback, e.g. "RA-2026-000012". */
export const reportCode = (r) => r?.report_code || (r?.id ? `RA-${r.id}` : '—')

/** "2 Car, 1 Tricycle" from vehicles: [{type, quantity}]. */
export function vehicleSummary(vehicles) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return '—'
  return vehicles.map((v) => `${v.quantity ?? 1} ${v.type}`).join(', ')
}

/** Short "N of M" helper for pagers. */
export const pageSummary = (total, page, totalPages) =>
  `${total} total, page ${page} of ${totalPages}`

export const truncate = (value, len = 80) => {
  const s = String(value ?? '')
  return s.length > len ? `${s.slice(0, len)}…` : s
}
