import { REPORT_STATUSES, STATUS_HELP, OFFICIAL_RECORDS_HELP, FLAGGED_HELP } from '../lib/constants.js'
import StatusBadge from './StatusBadge.jsx'

export default function StatusHelp() {
  return (
    <details className="small text-secondary my-2 no-print">
      <summary>Report status guide</summary>
      <dl className="mt-2">
        {REPORT_STATUSES.map((code) => (
          <div key={code} className="mb-2">
            <dt><StatusBadge status={code} /></dt>
            <dd className="mb-0">{STATUS_HELP[code]}</dd>
          </div>
        ))}
      </dl>
      <p>{OFFICIAL_RECORDS_HELP}</p>
      <p>Flagged: {FLAGGED_HELP}</p>
    </details>
  )
}
