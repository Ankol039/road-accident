/**
 * Summaries and export. Replaces admin-summaries.php +
 * js-release-20261020b/pages/admin-summaries.js.
 *
 * Group by day, week, month or year; count all reports or only verified
 * accident records. A bar chart, a table with totals, and export buttons
 * (CSV / PDF) for the summary and for the full report list.
 */
import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { Chart as ChartJS } from 'chart.js'
import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { loadRange, bucketBy, summaryTotals } from '../services/stats.service.js'
import { Bars } from '../components/Charts.jsx'
import States from '../components/States.jsx'
import { todayISO, daysAgoISO } from '../utils/date.js'
import { encodeCsv, toCsv } from '../utils/csv.js'
import { download } from '../utils/download.js'
import { CHART_COLORS, STATUS_LABELS, OFFICIAL_RECORDS_LABEL, OFFICIAL_RECORDS_HELP } from '../lib/constants.js'

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
function summaryCsv(rows, totals) {
  const headers = [
    'Period',
    'Total',
    'With injuries',
    'Fatalities',
    'No injuries',
    'Unknown',
    'Vehicles',
    STATUS_LABELS.resolved,
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
    ],
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
  return encodeCsv([headers, ...lines, totalLine])
}

function SummaryRow({ row: r }) {
  return (
    <tr>
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
  )
}

export default function Summaries() {
  const [period, setPeriod] = useState('month')
  const [scope, setScope] = useState('official')
  const [from, setFrom] = useState(defaultFrom('month'))
  const [to, setTo] = useState(todayISO())
  const [applied, setApplied] = useState({ period: 'month', scope: 'official', from: defaultFrom('month'), to: todayISO() })
  const [exporting, setExporting] = useState('')
  const [exportError, setExportError] = useState('')
  const [printGeneratedAt, setPrintGeneratedAt] = useState(() => new Date())
  const [printChart, setPrintChart] = useState('')

  useEffect(() => {
    setFrom(defaultFrom(period))
    setTo(todayISO())
  }, [period])

  const filterKey = JSON.stringify([applied.from, applied.to, applied.scope])
  const { data, loading, error } = useAsync(
    async () => ({
      ...await loadRange({
        from: applied.from,
        to: applied.to,
        officialOnly: applied.scope === 'official',
        includeMetadata: true,
      }),
      filterKey,
    }),
    [filterKey],
    { rows: [], mayBeTruncated: false, filterKey: null },
  )
  const rows = data?.rows || []
  const isCurrent = data?.filterKey === filterKey
  const mayBeTruncated = isCurrent && !loading && !error && data?.mayBeTruncated
  const exportDisabled = loading || !isCurrent || Boolean(error) || !rows.length || Boolean(exporting)

  useEffect(() => setExportError(''), [filterKey])

  const buckets = useMemo(
    () => bucketBy(rows || [], applied.period, { from: applied.from, to: applied.to }),
    [rows, applied.period, applied.from, applied.to],
  )
  const totals = useMemo(() => summaryTotals(buckets), [buckets])
  const chartData = useMemo(() => [...buckets].reverse().map((r) => ({ label: r.label, value: r.total })), [buckets])

  useEffect(() => {
    const preparePrint = () => {
      // A separate canvas gives paper dark labels and a stable aspect ratio without resizing the screen chart.
      const canvas = document.createElement('canvas')
      canvas.width = 1600
      canvas.height = 400
      const chart = new ChartJS(canvas, {
        type: 'bar',
        data: {
          labels: chartData.map((r) => r.label),
          datasets: [{ data: chartData.map((r) => r.value), backgroundColor: CHART_COLORS.bar, borderRadius: 4 }],
        },
        options: {
          responsive: false,
          animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#111', maxRotation: 45 } },
            y: { beginAtZero: true, grid: { color: '#ddd' }, ticks: { color: '#111', precision: 0 } },
          },
        },
      })
      let image
      try { image = canvas.toDataURL('image/png') } finally { chart.destroy() }
      // beforeprint must finish with React's print-only content already in the DOM.
      flushSync(() => {
        setPrintChart(image)
        setPrintGeneratedAt(new Date())
      })
    }
    window.addEventListener('beforeprint', preparePrint)
    return () => window.removeEventListener('beforeprint', preparePrint)
  }, [chartData])

  const onSubmit = (e) => {
    e.preventDefault()
    if (from && to && from > to) return
    setApplied({ period, scope, from: from || '', to })
  }

  const rangeLabel = useMemo(() => {
    const scopeLabel = applied.scope === 'official' ? OFFICIAL_RECORDS_LABEL : 'All public reports'
    const fromLabel = applied.from || 'all years'
    return `${scopeLabel}, ${fromLabel} to ${applied.to}`
  }, [applied])

  const onDownload = async (kind) => {
    if (exportDisabled) return
    setExportError('')
    setExporting(kind)
    try {
      if (kind === 'summary') {
        const name = `roadreport-summary-${applied.period}-${applied.scope}-${applied.from || 'all-years'}_to_${applied.to || 'all-dates'}.csv`
        download(name, summaryCsv(buckets, totals), 'text/csv;charset=utf-8')
      } else {
        // For an open-ended filter, use the first/last loaded report date in the filename.
        const dates = rows.map((r) => r.accident_date).filter(Boolean).sort()
        const fromDate = applied.from || dates[0] || todayISO()
        const toDate = applied.to || dates[dates.length - 1] || todayISO()
        const name = `roadreport-reports-${fromDate}_to_${toDate}.${kind}`
        if (kind === 'csv') {
          download(name, toCsv(rows), 'text/csv;charset=utf-8')
        } else {
          const { reportPdf } = await import('../utils/reportPdf.js')
          download(name, await reportPdf(rows, rangeLabel, mayBeTruncated), 'application/pdf')
        }
      }
    } catch (err) {
      setExportError(`Could not generate the download. ${err.message || 'Please try again.'}`)
    } finally {
      setExporting('')
    }
  }

  return (
    <div className="summaries-page rr-summaries-page">
      <header className="rr-head no-print">
        <div className="rr-head-text">
          <span className="rr-eyebrow no-print">Bulacan admin portal</span>
          <h1 className="h3">Summaries and export</h1>
          <p className="rr-sub no-print">Totals by period for official records, ready to print or download.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap rr-summaries-actions no-print">
          <button type="button" className="btn btn-outline-guide" onClick={() => onDownload('summary')} disabled={exportDisabled}>
            Download CSV
          </button>
          <button type="button" className="btn btn-outline-guide" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </header>
      <div className="rr-tape no-print" aria-hidden="true" />
      <header className="summary-print-heading print-only">
        <h1>Summaries and export</h1>
        <p>
          Grouped by {PERIODS.find((p) => p.value === applied.period)?.label} · Counting:{' '}
          {applied.scope === 'official' ? OFFICIAL_RECORDS_LABEL : 'All public reports'} ·{' '}
          {applied.from || 'All years'} to {applied.to || 'present'}
        </p>
        <p>Generated {printGeneratedAt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      </header>

      <form className="filter-bar rr-summaries-filters no-print" id="summary-form" onSubmit={onSubmit}>
        <div>
          <label className="form-label" htmlFor="period">
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
          <label className="form-label" htmlFor="scope">
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
          <label className="form-label" htmlFor="date_from">
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
          <label className="form-label" htmlFor="date_to">
            To
          </label>
          <input type="date" id="date_to" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn btn-guide" type="submit">
          Show
        </button>
      </form>

      <States error={error} />
      <div className="no-print"><States error={exportError} /></div>
      {mayBeTruncated && (
        <div className="alert alert-warning no-print" role="status">
          The 2,000-report loading limit was reached. Summaries and downloads may be incomplete,
          even when official-record filtering leaves fewer rows. Narrow the date range to include all matching reports.
        </div>
      )}

      <section className="panel mb-3 summary-chart">
        <h2 className="h6 mb-0">Accidents per period</h2>
        <p className="small text-secondary">{rangeLabel}</p>
        <div className="no-print">
          {(loading || (!error && !rows.length)) && <States loading={loading} empty emptyText="No data in this range." />}
        </div>
        <div className={printChart ? 'rr-summaries-chart-scroll no-print' : 'rr-summaries-chart-scroll'} tabIndex={0} role="region" aria-label="Accidents per period chart; scroll sideways on small screens">
          <Bars data={chartData} height={320} tickColor="#8d979b" />
        </div>
        {printChart && <img className="summary-print-chart print-only" src={printChart} alt="Accidents per period chart" />}
      </section>

      <div className="table-responsive panel p-0 mb-4 rr-summaries-table" tabIndex={0} role="region" aria-label="Summary table; scroll sideways for all columns">
        <table className="table table-sm align-middle mb-0" aria-label="Summary by period">
          <thead>
            <tr>
              <th>Period</th>
              <th className="text-end">Total</th>
              <th className="text-end">With injuries</th>
              <th className="text-end">Fatalities</th>
              <th className="text-end">No injuries</th>
              <th className="text-end">Unknown</th>
              <th className="text-end">Vehicles</th>
              <th className="text-end">{STATUS_LABELS.resolved}</th>
              <th>Most common type</th>
              <th>Top municipality</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="text-secondary">
                  <States loading />
                </td>
              </tr>
            )}
            {!loading && buckets.slice(0, -1).map((r) => <SummaryRow key={r.period} row={r} />)}
          </tbody>
          {/* Keep the final period and its Total together when the table crosses a page. */}
          <tbody className="summary-table-ending">
            {!loading && buckets.slice(-1).map((r) => <SummaryRow key={r.period} row={r} />)}
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

      <p className="small text-secondary">{OFFICIAL_RECORDS_HELP}</p>
      <section className="panel no-print rr-summaries-export">
        <h2 className="h5">Export the report list (FR-15)</h2>
        <p className="text-secondary mb-2">
          The loaded reports matching the applied dates and official-record filter, with location, type,
          injuries, status, officer and reporter. For other filters (status, type, place), use the buttons on the <Link to="/admin/reports">Accident reports</Link>{' '}
          screen.
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
            {OFFICIAL_RECORDS_LABEL}
          </label>
        </div>
        <button type="button" className="btn btn-outline-guide me-2" onClick={() => onDownload('csv')} disabled={exportDisabled}>
          Download CSV
        </button>
        <button type="button" className="btn btn-outline-guide" onClick={() => onDownload('pdf')} disabled={exportDisabled}>
          {exporting === 'pdf' ? 'Generating PDF…' : 'Download PDF'}
        </button>
      </section>
    </div>
  )
}
