/**
 * Dashboard. Replaces admin.php + pages/admin.js.
 *
 * Same panels as the PHP screen: date range filter, stat cards, five charts,
 * the points map, top accident spots and the recent-reports table.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { loadRange, summarise, hotspots } from '../services/stats.service.js'
import { Bars, Split, Trend } from '../components/Charts.jsx'
import { PointsMap, MapLegend } from '../components/MapView.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import States from '../components/States.jsx'
import { formatDate } from '../utils/date.js'
import { place } from '../utils/format.js'
import { todayISO, daysAgoISO } from '../utils/date.js'

/** The clickable stat cards, same keys/classes as the PHP dashboard. */
const CARDS = [
  { key: 'on_scene', cls: 'stat-on_scene', label: 'Officer on scene', to: '/admin/reports?status=on_scene' },
  { key: 'pending', cls: 'stat-pending', label: 'Needs review', to: '/admin/reports?status=submitted' },
  { key: 'dispatched', cls: 'stat-dispatched', label: 'Dispatched', to: '/admin/reports?status=assigned' },
  { key: 'total', label: 'All reports', to: '/admin/reports' },
  { key: 'verified', cls: 'stat-verified', label: 'Verified Reports', to: '/admin/reports?official=1' },
  { key: 'closed', cls: 'stat-closed', label: 'Closed Reports', to: '/admin/reports?status=resolved' },
  { key: 'duplicates', cls: 'stat-duplicates', label: 'Duplicated Reports', to: '/admin/reports?status=duplicate' },
  { key: 'today', label: 'Reported today', to: '/admin/reports' },
  { key: 'flagged', cls: 'stat-flagged', label: 'Flagged Reports', to: '/admin/reports?flagged=1' },
]

const level = (n) => (n > 0 ? (n <= 5 ? 'low' : n <= 10 ? 'moderate' : 'high') : 'none')

export default function Dashboard() {
  const [from, setFrom] = useState(daysAgoISO(30))
  const [to, setTo] = useState(todayISO())
  const [applied, setApplied] = useState({ from: daysAgoISO(30), to: todayISO() })

  const { data: rows, loading, error } = useAsync(
    () => loadRange(applied),
    [applied.from, applied.to],
    [],
  )

  const stats = useMemo(() => summarise(rows || []), [rows])
  const spots = useMemo(() => hotspots(rows || []), [rows])
  const recent = useMemo(() => (rows || []).slice(0, 10), [rows])

  const onSubmit = (e) => {
    e.preventDefault()
    setApplied({ from, to })
  }

  return (
    <div className="rr-dashboard-page">
      <header className="rr-head rr-dashboard-head">
        <div className="rr-head-text">
          <span className="rr-eyebrow">Bulacan admin portal</span>
          <h1 className="h3">Dashboard</h1>
          <p className="rr-sub">Verified reports, officer activity and accident-prone areas across the province.</p>
        </div>

        <form className="filter-bar" id="range-form" onSubmit={onSubmit} role="search">
          <input
            type="date"
            className="form-control"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="From date"
          />
          <input
            type="date"
            className="form-control"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="To date"
          />
          <button type="submit" className="btn btn-sm btn-guide">
            Apply
          </button>
          <button
            type="button"
            className="btn btn-sm btn-link"
            onClick={() => {
              const all = { from: '', to: '' }
              setFrom('')
              setTo('')
              setApplied(all)
            }}
          >
            All dates
          </button>
        </form>
      </header>
      <div className="rr-tape" aria-hidden="true" />

      <States loading={loading} error={error}>
        <div className="stack">
          <div className="stat-grid rr-dashboard-stats" id="cards">
            {CARDS.map((c) => {
              const count = stats[c.key] ?? 0
              const countLevel = level(count)
              return (
                <Link
                  key={c.key}
                  to={c.to}
                  className={`stat-card ${c.cls || ''}${stats[c.key] > 0 && c.cls === 'stat-on_scene' ? ' has-items' : ''}`}
                  data-level={countLevel}
                >
                  <span className="stat-value">{count}</span>
                  <span className="stat-label">{c.label}</span>
                  <span className="rr-dashboard-level-text">{countLevel[0].toUpperCase() + countLevel.slice(1)}</span>
                </Link>
              )
            })}
          </div>

          <p className="small text-secondary rr-dashboard-note" id="official-note">
            {stats.official} of {stats.total} reports in this range are verified accident records.
          </p>

          <div className="rr-dashboard-charts">
            <div className="col-lg-6">
              <section className="panel">
                <h2 className="h6">Reports per month</h2>
                <Trend data={stats.byMonth} />
              </section>
            </div>
            <div className="col-lg-6">
              <section className="panel">
                <h2 className="h6">Accident type</h2>
                <Bars data={stats.byType.slice(0, 8)} horizontal />
              </section>
            </div>
            <div className="col-lg-6">
              <section className="panel">
                <h2 className="h6">By municipality</h2>
                <Bars data={stats.byTown.slice(0, 8)} horizontal color="#5fb7a5" />
              </section>
            </div>
            <div className="col-lg-6">
              <section className="panel">
                <h2 className="h6">Time of day</h2>
                <Bars data={stats.byHour} color="#f5c518" />
              </section>
            </div>
            <div className="col-lg-6">
              <section className="panel">
                <h2 className="h6">By status</h2>
                <Split
                  data={Object.entries(stats.byStatus).map(([label, value]) => ({ label, value }))}
                />
              </section>
            </div>
            <div className="col-lg-6">
              <section className="panel">
                <h2 className="h6">Injury outcome</h2>
                <Split
                  data={Object.entries(stats.injuries).map(([label, value]) => ({ label, value }))}
                  doughnut={false}
                />
              </section>
            </div>
          </div>

          <div className="rr-dashboard-split">
            <section className="panel">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h2 className="h6 mb-0">Report locations</h2>
                <span className="small text-secondary" id="map-count">
                  {recent.length} shown
                </span>
              </div>
              <PointsMap reports={rows || []} />
              <MapLegend />
            </section>

            <section className="panel">
              <h2 className="h6">Accident-prone spots</h2>
              {spots.length === 0 ? (
                <States empty emptyText="No pinned locations in this range." />
              ) : (
                <ol className="list-plain" id="hotspots">
                  {spots.map((s) => (
                    <li key={`${s.latitude},${s.longitude}`}>
                      <span>{s.label}</span>
                      <span>{s.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <section className="panel p-0 rr-dashboard-recent">
            <div className="rr-dashboard-panel-head">
              <h2 className="h6">Recent reports</h2>
              <Link className="rr-dashboard-link" to="/admin/reports">View all reports</Link>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" role="table" aria-label="Recent reports">
                <thead role="rowgroup">
                  <tr role="row">
                    <th scope="col" role="columnheader">Report ID</th>
                    <th scope="col" role="columnheader">Date</th>
                    <th scope="col" role="columnheader">Location</th>
                    <th scope="col" role="columnheader">Status</th>
                  </tr>
                </thead>
                <tbody id="recent" role="rowgroup">
                  {recent.length === 0 && (
                    <tr role="row" className="rr-dashboard-empty-row">
                      <td colSpan={4} role="cell">
                        <States empty emptyText="No reports in this range." />
                      </td>
                    </tr>
                  )}
                  {recent.map((r) => (
                    <tr key={r.id} className="clickable" role="row">
                      <td className="code-cell" role="cell">
                        <Link to={`/admin/reports/${r.id}`}>{r.report_code || '—'}</Link>
                      </td>
                      <td role="cell">{formatDate(r.accident_date)}</td>
                      <td role="cell">{place(r)}</td>
                      <td role="cell">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </States>
    </div>
  )
}
