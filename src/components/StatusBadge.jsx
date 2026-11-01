/**
 * Status pill, matching css/app.css .status-badge plus .record-kind.
 */
import { STATUS_LABELS, statusDefinition, OFFICIAL_RECORDS_LABEL, OFFICIAL_RECORDS_HELP } from '../lib/constants.js'

export default function StatusBadge({ status, label, className = '' }) {
  return (
    <span className={`status-badge ${statusDefinition(status)?.badgeClass || `status-${status}`} ${className}`.trim()} data-status={status} title={label || statusDefinition(status)?.definition}>
      {label || STATUS_LABELS[status] || status}
    </span>
  )
}

/** "Verified record" style marker used on the report detail page. */
export function RecordKind({ official }) {
  return (
    <span className={`record-kind${official ? ' is-official' : ''}`} title={OFFICIAL_RECORDS_HELP}>
      {official ? OFFICIAL_RECORDS_LABEL : `Outside ${OFFICIAL_RECORDS_LABEL.toLowerCase()}`}
    </span>
  )
}
