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
  { key: 'verified', cls: 'stat-verified', label: 'Verified', to: '/admin/reports?official=1' },
  { key: 'closed', cls: 'stat-closed', label: 'Closed', to: '/admin/reports?status=resolved' },
  { key: 'duplicates', cls: 'stat-duplicates', label: 'Duplicates', to: '/admin/reports?status=duplicate' },
  { key: 'today', label: 'Reported today', to: '/admin/reports' },
  { key: 'flagged', cls: 'stat-flagged', label: 'Flagged', to: '/admin/reports?flagged=1' },
]

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
    <>
      <h1 className="h3">Dashboard</h1>

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

      <States loading={loading} error={error}>
        <div className="stack">
          <div className="stat-grid" id="cards">
            {CARDS.map((c) => (
              <Link
                key={c.key}
                to={c.to}
                className={`stat-card ${c.cls || ''}${stats[c.key] > 0 && c.cls === 'stat-on_scene' ? ' has-items' : ''}`}
              >
                <span className="stat-value">{stats[c.key] ?? 0}</span>
                <span className="stat-label">{c.label}</span>
              </Link>
            ))}
          </div>

          <p className="small text-secondary" id="official-note">
            {stats.official} of {stats.total} reports in this range are verified accident records.
          </p>

          <div className="row g-4">
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
                <Bars data={stats.byTown.slice(0, 8)} horizontal color="#0f6b4c" />
              </section>
            </div>
            <div className="col-lg-6">
              <section className="panel">
                <h2 className="h6">Time of day</h2>
                <Bars data={stats.byHour} />
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
              <p className="text-secondary mb-0">No pinned locations in this range.</p>
            ) : (
              <ol className="list-plain" id="hotspots">
                {spots.map((s) => (
                  <li key={`${s.latitude},${s.longitude}`} className="d-flex justify-content-between py-1 border-bottom">
                    <span>{s.label}</span>
                    <span className="text-secondary">{s.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="panel p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="recent">
                  {recent.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-secondary">
                        No reports in this range.
                      </td>
                    </tr>
                  )}
                  {recent.map((r) => (
                    <tr key={r.id} className="clickable">
                      <td className="code-cell">
                        <Link to={`/admin/reports/${r.id}`}>{r.report_code || '—'}</Link>
                      </td>
                      <td>{formatDate(r.accident_date)}</td>
                      <td>{place(r)}</td>
                      <td>
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
    </>
  )
}
