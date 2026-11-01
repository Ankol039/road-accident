import { STATUS_LABELS } from '../lib/constants.js'
import { place } from './format.js'

/** Quote every cell and prevent spreadsheet formulas, including whitespace-prefixed ones. */
function csvCell(value) {
  let text = String(value ?? '')
  if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

/** Excel-compatible UTF-8 CSV with RFC-style quoting and CRLF record separators. */
export const encodeCsv = (table) =>
  `\uFEFF${table.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`

export const REPORT_EXPORT_HEADERS = [
  'Report ID', 'Date', 'Time', 'Location', 'Type', 'Injury', 'Officer', 'Reporter', 'Status',
]

/** Shared columns for report-list CSV and PDF exports. */
export const reportExportRows = (rows) => rows.map((r) => [
  r.report_code,
  r.accident_date,
  r.accident_time,
  place(r),
  r.accident_type_name || r.accident_type_id,
  r.injury_status,
  r.officer_name,
  r.reporter_name || r.reporter_email || r.reporter_id,
  STATUS_LABELS[r.status] || r.status,
])

export const toCsv = (rows) => encodeCsv([REPORT_EXPORT_HEADERS, ...reportExportRows(rows)])
