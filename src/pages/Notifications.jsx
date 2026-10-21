/**
 * Notifications inbox. Replaces legacy/notifications.php.
 *
 * The same screen as the mobile/admin notifications list: every row is a
 * notification; clicking an unread one marks it read and navigates to the
 * related report if there is one. Mark all as read clears the pill.
 */
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useUnread } from '../hooks/useUnread.js'
import { listNotifications, markRead, markAllRead } from '../services/notifications.service.js'
import { formatDateTime } from '../utils/date.js'
import States from '../components/States.jsx'

export default function Notifications() {
  const { user } = useAuth()
  const { refresh } = useUnread()
  const navigate = useNavigate()
  const [working, setWorking] = useState(false)

  const { data: items = [], loading, error, reload } = useAsync(
    () => (user ? listNotifications(user.uid) : []),
    [user?.uid],
    [],
  )

  const unread = items.filter((n) => !n.read).length

  const onClick = useCallback(
    async (n) => {
      try {
        if (!n.read) {
          await markRead(n.id)
          refresh()
        }
      } catch {
        // marking read should never block navigation
      }
      // The notification may reference a report: the PHP app used report_id
      // or a report_code; either way, link to the report detail.
      if (n.report_code) {
        // We don't have a code->id index here; the report detail can be
        // reached by the id if it was stored. Fall back to the reports list.
        navigate('/admin/reports')
        reload()
        return
      }
      reload()
    },
    [navigate, refresh, reload],
  )

  const onMarkAll = useCallback(async () => {
    if (!user || working) return
    setWorking(true)
    try {
      await markAllRead(user.uid)
      await refresh()
      reload()
    } finally {
      setWorking(false)
    }
  }, [user, working, refresh, reload])

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Notifications</h1>
        {unread > 0 && (
          <button
            className="btn btn-sm btn-outline-secondary"
            id="mark-all"
            type="button"
            onClick={onMarkAll}
            disabled={working}
          >
            Mark all as read
          </button>
        )}
      </div>

      <States loading={loading} error={error}>
        {items.length === 0 ? (
          <p className="text-secondary">No notifications yet.</p>
        ) : (
          <ul className="list-plain">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notif-row ${n.read ? '' : 'is-unread'}`}
                  data-id={n.id}
                  data-read={n.read ? '1' : '0'}
                  onClick={() => onClick(n)}
                >
                  <strong className="d-block">{n.title || 'Notification'}</strong>
                  <span className="d-block">{n.message}</span>
                  <span className="small text-secondary">{formatDateTime(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </States>
    </>
  )
}
