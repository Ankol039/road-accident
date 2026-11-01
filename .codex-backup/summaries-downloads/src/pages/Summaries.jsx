/**
 * Summaries and export. Replaces admin-summaries.php +
 * js-release-20261020b/pages/admin-summaries.js.
 *
 * Group by day, week, month or year; count all reports or only verified
 * accident records. A bar chart, a table with totals, and export buttons
 * (CSV / PDF) for the summary and for the full report list.
 */
import { useEffect, useMemo, useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { loadRange, bucketBy, summaryTotals } from '../services/stats.service.js'
import { Bars } from '../components/Charts.jsx'
import { todayISO, daysAgoISO } from '../utils/date.js'

const PERIODS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

const defaultFrom = (period) => {
  if (period === 'day') return daysAgoISO(29)
  if (period === 'week') return daysAgoISO(77)
  if (period === 'year') return '2000-01-01'
  return daysAgoISO(335)
}

/** Build a CSV blob from the summary rows. */
function summaryCsv(rows, totals, scope) {
  const headers = [
    'Period',
    'Total',
    'With injuries',
    'Fatalities',
    'No injuries',
    'Unknown',
    'Vehicles',
    'Resolved',
    'Most common type',
    'Top municipality',
  ]
  const lines = rows.map((r) =>
    [
      r.label,
      r.total,
      r.with_injuries,
      r.fatalities,
      r.no_injuries,
      r.unknown_injuries,
      r.vehicles,
      r.resolved,
      r.top_type,
      r.top_town,
    ]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(','),
  )
  const totalLine = [
    'Total',
    totals.total,
    totals.with_injuries,
    totals.fatalities,
    totals.no_injuries,
    totals.unknown_injuries,
    totals.vehicles,
    totals.resolved,
    '',
    '',
  ]
    .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
    .join(',')
  return [`# RoadReport summaries - ${scope}`, headers.join(','), ...lines, totalLine].join('\n')
}

/** Download a blob. */
function download(name, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function Summaries() {
  const [period, setPeriod] = useState('month')
  const [scope, setScope] = useState('official')
  const [from, setFrom] = useState(defaultFrom('month'))
  const [to, setTo] = useState(todayISO())
  const [applied, setApplied] = useState({ period: 'month', scope: 'official', from: defaultFrom('month'), to: todayISO() })

  useEffect(() => {
    setFrom(defaultFrom(period))
    setTo(todayISO())
  }, [period])

  const { data: rows, loading, error } = useAsync(
    () => loadRange({ from: applied.from, to: applied.to, officialOnly: applied.scope === 'official' }),
    [applied.from, applied.to, applied.scope],
    [],
  )

  const buckets = useMemo(
    () => bucketBy(rows || [], applied.period, { from: applied.from, to: applied.to }),
    [rows, applied.period, applied.from, applied.to],
  )
  const totals = useMemo(() => summaryTotals(buckets), [buckets])
  const chartData = useMemo(() => [...buckets].reverse().map((r) => ({ label: r.label, value: r.total })), [buckets])

  const onSubmit = (e) => {
    e.preventDefault()
    if (from && to && from > to) return
    setApplied({ period, scope, from: from || '', to })
  }

  const csvUrl = useMemo(() => {
    const q = new URLSearchParams({
      period: applied.period,
      scope: applied.scope,
      type: 'summary',
      format: 'csv',
    })
    if (applied.from) q.set('date_from', applied.from)
    if (applied.to) q.set('date_to', applied.to)
    return `/#/export?${q}`
  }, [applied])

  const allCsvUrl = useMemo(() => {
    const q = new URLSearchParams({ format: 'csv' })
    if (applied.scope === 'official') q.set('official', '1')
    if (applied.from) q.set('date_from', applied.from)
    if (applied.to) q.set('date_to', applied.to)
    return `/#/export?${q}`
  }, [applied])

  const allPdfUrl = useMemo(() => {
    const q = new URLSearchParams({ format: 'pdf' })
    if (applied.scope === 'official') q.set('official', '1')
    if (applied.from) q.set('date_from', applied.from)
    if (applied.to) q.set('date_to', applied.to)
    return `/#/export?${q}`
  }, [applied])

  const onDownloadCsv = () => {
    const scopeLabel = applied.scope === 'official' ? 'Verified accident records' : 'All public reports'
    const csv = summaryCsv(buckets, totals, scopeLabel)
    download(`roadreport-summary-${applied.period}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const rangeLabel = useMemo(() => {
    const scopeLabel = applied.scope === 'official' ? 'Verified accident records' : 'All public reports'
    const fromLabel = applied.from || 'all years'
    return `${scopeLabel}, ${fromLabel} to ${applied.to}`
  }, [applied])

  return (
    <>
      <h1 className="h3 mb-3">Summaries and export</h1>

      <form className="filter-bar" id="summary-form" onSubmit={onSubmit}>
        <div>
          <label className="form-label small mb-1" htmlFor="period">
            Group by
          </label>
          <select
            id="period"
            className="form-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label small mb-1" htmlFor="scope">
            Count
          </label>
          <select
            id="scope"
            className="form-select"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="official">Verified accident records</option>
            <option value="all">All public reports</option>
          </select>
        </div>
        <div>
          <label className="form-label small mb-1" htmlFor="date_from">
            From
          </label>
          <input
            type="date"
            id="date_from"
            className="form-control"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label small mb-1" htmlFor="date_to">
            To
          </label>
          <input type="date" id="date_to" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn btn-guide" type="submit">
          Show
        </button>
        <div className="ms-auto d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-outline-guide" onClick={onDownloadCsv} disabled={loading || buckets.length === 0}>
            Download CSV
          </button>
          <button type="button" className="btn btn-outline-guide" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </form>

      {error && <div className="alert alert-danger">{error.message || 'Could not load summaries.'}</div>}

      <section className="panel mb-3">
        <h2 className="h6 mb-0">Accidents per period</h2>
        <p className="small text-secondary">{rangeLabel}</p>
        <Bars data={chartData} height={320} />
      </section>

      <div className="table-responsive panel p-0 mb-4">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Period</th>
              <th className="text-end">Total</th>
              <th className="text-end">With injuries</th>
              <th className="text-end">Fatalities</th>
              <th className="text-end">No injuries</th>
              <th className="text-end">Unknown</th>
              <th className="text-end">Vehicles</th>
              <th className="text-end">Resolved</th>
              <th>Most common type</th>
              <th>Top municipality</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="text-secondary">
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              buckets.map((r) => (
                <tr key={r.period}>
                  <td>{r.label}</td>
                  <td className="text-end">{r.total}</td>
                  <td className="text-end">{r.with_injuries}</td>
                  <td className="text-end">{r.fatalities}</td>
                  <td className="text-end">{r.no_injuries}</td>
                  <td className="text-end">{r.unknown_injuries}</td>
                  <td className="text-end">{r.vehicles}</td>
                  <td className="text-end">{r.resolved}</td>
                  <td>{r.top_type}</td>
                  <td>{r.top_town}</td>
                </tr>
              ))}
            {!loading && (
              <tr className="fw-bold table-dark">
                <td>Total</td>
                <td className="text-end">{totals.total}</td>
                <td className="text-end">{totals.with_injuries}</td>
                <td className="text-end">{totals.fatalities}</td>
                <td className="text-end">{totals.no_injuries}</td>
                <td className="text-end">{totals.unknown_injuries}</td>
                <td className="text-end">{totals.vehicles}</td>
                <td className="text-end">{totals.resolved}</td>
                <td></td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="panel no-print">
        <h2 className="h5">Export the report list (FR-15)</h2>
        <p className="text-secondary mb-2">
          Every report in the dates above, with location, type, injuries, status, officer and reporter. For other
          filters (status, type, place), use the buttons under the <a href="#/admin/reports">Accident reports</a>{' '}
          table.
        </p>
        <div className="form-check mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="export-official"
            checked={applied.scope === 'official'}
            onChange={(e) => {
              setScope(e.target.checked ? 'official' : 'all')
              setApplied((a) => ({ ...a, scope: e.target.checked ? 'official' : 'all' }))
            }}
          />
          <label className="form-check-label" htmlFor="export-official">
            Verified accident records only
          </label>
        </div>
        <a className="btn btn-outline-guide me-2" href={allCsvUrl}>
          Download CSV
        </a>
        <a className="btn btn-outline-guide" href={allPdfUrl}>
          Download PDF
        </a>
      </section>
    </>
  )
}
