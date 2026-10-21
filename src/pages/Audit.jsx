/**
 * Audit trail. Replaces admin-audit.php +
 * js-release-20261020b/pages/admin-audit.js.
 *
 * A filter bar (search, action, date range) over the log of everything that
 * happened in the portal: who did it, what they did, and which item it was
 * about.
 *
 * The trail is read for the date range and then narrowed down in the browser,
 * the way api/audit/list.php did it.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync, useDebounced } from '../hooks/useAsync.js'
import { listAudit } from '../services/audit.service.js'
import { listUsers } from '../services/users.service.js'
import { listAccidentTypes, listEmergencyContacts } from '../services/settings.service.js'
import Pager from '../components/Pager.jsx'
import { AUDIT_ACTIONS } from '../lib/constants.js'
import { formatDateTime, todayISO, daysAgoISO } from '../utils/date.js'

const PER_PAGE = 50

/** The details column, the way js-release-20261020b/pages/admin-audit.js drew it. */
function detailsText(details) {
  const short = (value) => {
    const s =
      value === null || value === undefined
        ? '—'
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
    return s.length > 80 ? `${s.slice(0, 77)}…` : s
  }

  if (!details) return ''
  // A plain string is shown as it is; anything else is read as a set of pairs.
  if (typeof details !== 'object') return short(details)

  const d = details
  const parts = []
  // The changed pairs come first: "status: submitted → under_review".
  if (d.changed && typeof d.changed === 'object') {
    parts.push(
      ...Object.entries(d.changed).map(([k, v]) =>
        v && typeof v === 'object' && 'to' in v
          ? `${k}: ${short(v.from)} → ${short(v.to)}`
          : `${k}: ${short(v)}`,
      ),
    )
  }
  // Anything else is shown as it is: "note: Called the reporter…".
  for (const [k, v] of Object.entries(d)) {
    if (k === 'changed') continue
    parts.push(`${k}: ${short(v)}`)
  }
  return parts.join('; ')
}

export default function Audit() {
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState(daysAgoISO(30))
  const [to, setTo] = useState(todayISO())
  const [page, setPage] = useState(1)

  // The search waits for a pause in typing, so a read is not made for every
  // key press.
  const debouncedQ = useDebounced(q, 300)

  const { data, loading, error } = useAsync(
    () => listAudit({ action, q: debouncedQ, from, to, page, perPage: PER_PAGE }),
    [action, debouncedQ, from, to, page],
    { rows: [], total: 0, page: 1, totalPages: 1 },
  )

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const currentPage = data?.page ?? 1

  // The item column says which thing the entry is about. The PHP screen
  // printed the type and the number; here the names are looked up, because a
  // Firestore id means nothing to the reader.
  const { data: users } = useAsync(() => listUsers(), [], [])
  const { data: types } = useAsync(() => listAccidentTypes(), [], [])
  const { data: contacts } = useAsync(() => listEmergencyContacts(), [], [])

  const names = useMemo(() => {
    const map = {}
    users?.forEach((u) => {
      map[`user:${u.id}`] = u.full_name || u.email
    })
    types?.forEach((t) => {
      map[`accident_type:${t.id}`] = t.name
    })
    contacts?.forEach((c) => {
      map[`emergency_contact:${c.id}`] = c.name
    })
    return map
  }, [users, types, contacts])

  return (
    <>
      <h1 className="h3 mb-3">Audit trail</h1>

      <form
        className="filter-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
        }}
      >
        <input
          type="search"
          name="q"
          className="form-control"
          placeholder="Search name or details"
          aria-label="Search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <select
          name="action"
          className="form-select"
          aria-label="Action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All actions</option>
          {Object.entries(AUDIT_ACTIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="date_from"
          className="form-control"
          aria-label="From"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setPage(1)
          }}
        />
        <input
          type="date"
          name="date_to"
          className="form-control"
          aria-label="To"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setPage(1)
          }}
        />
        <button type="submit" className="btn btn-guide">
          Search
        </button>
      </form>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error.message || 'Could not load the audit trail.'}
        </div>
      )}

      <div className="table-responsive panel p-0">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Item</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-secondary">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-secondary">
                  Nothing was recorded for these filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="text-nowrap small">{formatDateTime(row.created_at)}</td>
                <td>
                  {row.actor_name || 'System'}
                  {row.actor_role ? (
                    <span className="small text-secondary d-block">{row.actor_role}</span>
                  ) : null}
                </td>
                <td>{AUDIT_ACTIONS[row.action] || row.action}</td>
                <td>
                  {row.entity === 'report' && row.entity_id ? (
                    <Link to={`/admin/reports/${row.entity_id}`}>Report {row.entity_id}</Link>
                  ) : row.entity === 'settings' ? (
                    'System settings'
                  ) : row.entity && names[`${row.entity}:${row.entity_id}`] ? (
                    names[`${row.entity}:${row.entity_id}`]
                  ) : row.entity ? (
                    `${row.entity}${row.entity_id ? ` ${row.entity_id}` : ''}`
                  ) : (
                    ''
                  )}
                </td>
                <td className="small text-secondary">{detailsText(row.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager
        page={currentPage}
        totalPages={totalPages}
        total={total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        hasPrev={currentPage > 1}
        hasNext={currentPage < totalPages}
      />
    </>
  )
}
