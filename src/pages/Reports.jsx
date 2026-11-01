/**
 * Reports list. Replaces admin-reports.php + js/reports-table.js.
 *
 * A filter bar (search, status, type, town, dates, flags) over a paged table.
 * The PHP version exported CSV client-side and printed to PDF for PDF; those
 * buttons are kept, with CSV built in the browser.
 */
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAsync, useDebounced } from '../hooks/useAsync.js'
import { listReports } from '../services/reports.service.js'
import { listAccidentTypes } from '../services/settings.service.js'
import StatusBadge from '../components/StatusBadge.jsx'
import Pager from '../components/Pager.jsx'
import States from '../components/States.jsx'
import { REPORT_STATUSES, STATUS_LABELS, BULACAN_TOWNS } from '../lib/constants.js'
import { formatDate } from '../utils/date.js'
import { place } from '../utils/format.js'
import { toCsv } from '../utils/csv.js'
import { download } from '../utils/download.js'

const PAGE_SIZE = 25

export default function Reports() {
  const [params] = useSearchParams()

  const [q, setQ] = useState(params.get('q') || '')
  const [status, setStatus] = useState(params.get('status') || '')
  const [typeId, setTypeId] = useState(params.get('accident_type_id') || '')
  const [municipality, setMunicipality] = useState(params.get('municipality') || '')
  const [dateFrom, setDateFrom] = useState(params.get('date_from') || '')
  const [dateTo, setDateTo] = useState(params.get('date_to') || '')
  const [flagged, setFlagged] = useState(params.get('flagged') === '1')
  const [official, setOfficial] = useState(params.get('official') === '1')

  const [page, setPage] = useState(1)
  const [cursors, setCursors] = useState([null])
  const [exportError, setExportError] = useState('')

  const debouncedQ = useDebounced(q, 350)

  const filters = {
    q: debouncedQ,
    status,
    accident_type_id: typeId,
    municipality,
    date_from: dateFrom,
    date_to: dateTo,
    flagged,
    official,
    pageSize: PAGE_SIZE,
  }

  const { data: types } = useAsync(() => listAccidentTypes(), [], [])

  const { data, loading, error } = useAsync(
    () => listReports({ ...filters, cursor: cursors[page - 1] || undefined }),
    [debouncedQ, status, typeId, municipality, dateFrom, dateTo, flagged, official, page, cursors],
    { rows: [], cursor: null, hasMore: false },
  )

  const rows = data?.rows || []

  const reset = () => {
    setQ('')
    setStatus('')
    setTypeId('')
    setMunicipality('')
    setDateFrom('')
    setDateTo('')
    setFlagged(false)
    setOfficial(false)
    setPage(1)
    setCursors([null])
  }

  const goNext = () => {
    if (!data?.cursor) return
    setCursors((list) => {
      const next = list.slice(0, page)
      next[page] = data.cursor
      return next
    })
    setPage((p) => p + 1)
  }

  const goPrev = () => setPage((p) => Math.max(1, p - 1))

  const onExport = () => {
    setExportError('')
    try {
      download(`roadreport-page-${page}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
    } catch (err) {
      setExportError(err.message || 'Could not generate the CSV. Please try again.')
    }
  }

  return (
    <div className="rr-reports-page">
      <header className="rr-head no-print">
        <div className="rr-head-text">
          <span className="rr-eyebrow">Bulacan admin portal</span>
          <h1 className="h3">Accident reports</h1>
          <p className="rr-sub">Search, filter and review every accident report sent in from the RoadReport app.</p>
        </div>
        <div className="d-flex gap-2 no-print rr-reports-actions">
          <button type="button" className="btn btn-sm btn-outline-guide" onClick={onExport} disabled={loading || Boolean(error) || !rows.length}>
            Export this page (CSV)
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-guide"
            onClick={() => window.print()}
            disabled={loading}
          >
            Print / PDF
          </button>
        </div>
      </header>
      <div className="rr-tape no-print" aria-hidden="true" />

      <form
        className="filter-bar no-print"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setCursors([null])
        }}
      >
        <input
          type="search"
          aria-label="Search reports"
          className="form-control"
          name="q"
          placeholder="Search report ID, place or description"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="form-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {REPORT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="form-select" aria-label="Accident type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Any type</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="rr-reports-break" aria-hidden="true" />
        <input
          className="form-control"
          name="municipality"
          aria-label="Municipality"
          list="rt-towns"
          placeholder="Municipality"
          value={municipality}
          onChange={(e) => setMunicipality(e.target.value)}
        />
        <datalist id="rt-towns">
          {BULACAN_TOWNS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <input
          type="date"
          className="form-control"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
        />
        <input
          type="date"
          className="form-control"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
        />
        <label className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
            checked={flagged}
            onChange={(e) => setFlagged(e.target.checked)}
          />
          Flagged
        </label>
        <label className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
            checked={official}
            onChange={(e) => setOfficial(e.target.checked)}
          />
          Verified only
        </label>
        <button type="submit" className="btn btn-guide btn-sm">
          Filter
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={reset}>
          Clear
        </button>
      </form>

      <div className="no-print"><States error={error} /></div>
      <div className="no-print"><States error={exportError} /></div>

      <div className="table-responsive panel p-0 print-area rr-reports-table" tabIndex={0} role="region" aria-label="Accident reports table; scroll sideways on desktop for all columns">
        <table className="table table-hover align-middle mb-0" role="table" aria-label="Accident reports">
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col">Report ID</th>
              <th role="columnheader" scope="col">Accident date</th>
              <th role="columnheader" scope="col">Location</th>
              <th role="columnheader" scope="col">Type</th>
              <th role="columnheader" scope="col">Officer</th>
              <th role="columnheader" scope="col">Status</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {(loading || rows.length === 0) && (
              <tr className="rr-reports-state-row" role="row">
                <td colSpan={6} role="cell">
                  <States loading={loading} empty emptyText="No reports match those filters." />
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="clickable" role="row">
                <td role="cell" className="code-cell">
                  <Link to={`/admin/reports/${r.id}`}>{r.report_code || '—'}</Link>
                  {r.flagged && <span className="flag-dot">flagged</span>}
                </td>
                <td role="cell">{formatDate(r.accident_date)}</td>
                <td role="cell">{place(r)}</td>
                <td role="cell">{r.accident_type_name || '—'}</td>
                <td role="cell">{r.officer_name || '—'}</td>
                <td role="cell">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="no-print rr-reports-pager">
        <Pager
          page={page}
          totalPages={page + (data?.hasMore ? 1 : 0)}
          total={rows.length}
          onPrev={goPrev}
          onNext={goNext}
          hasPrev={page > 1}
          hasNext={Boolean(data?.hasMore)}
        />
      </div>
    </div>
  )
}
