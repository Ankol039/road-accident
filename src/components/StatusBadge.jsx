/**
 * Status pill, matching css/app.css .status-badge plus .record-kind.
 */
import { STATUS_LABELS } from '../lib/constants.js'

export default function StatusBadge({ status, label, className = '' }) {
  return (
    <span className={`status-badge status-${status} ${className}`.trim()}>
      {label || STATUS_LABELS[status] || status}
    </span>
  )
}

/** "Verified record" style marker used on the report detail page. */
export function RecordKind({ official }) {
  return (
    <span className={`record-kind${official ? ' is-official' : ''}`}>
      {official ? 'Official accident record' : 'Unverified submission'}
    </span>
  )
}
