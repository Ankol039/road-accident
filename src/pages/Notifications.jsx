/**
 * Notifications inbox. Replaces legacy/notifications.php.
 *
 * The same screen as the mobile/admin notifications list: every row is a
 * notification; clicking an unread one marks it read and navigates to the
 * related report if there is one. Mark all as read clears the pill.
 */
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useUnread } from '../hooks/useUnread.js'
import { useToast } from '../hooks/useToast.jsx'
import { listNotifications, markRead, markAllRead } from '../services/notifications.service.js'
import { formatDateTime } from '../utils/date.js'
import States from '../components/States.jsx'
import { structuredStatusText } from '../lib/constants.js'

export default function Notifications() {
  const { user } = useAuth()
  const { count, refresh, adjustCount } = useUnread()
  const toast = useToast()
  const navigate = useNavigate()
  const [working, setWorking] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const pending = useRef(new Set())
  const markingAll = useRef(false)

  const { data: items = [], loading, error, setData } = useAsync(
    () => (user ? listNotifications(user.uid) : []),
    [user?.uid],
    [],
  )
  const currentItems = useRef(items)
  currentItems.current = items
  const updateItems = useCallback((update) => {
    currentItems.current = update(currentItems.current)
    setData(currentItems.current)
  }, [setData])

  const unread = items.filter((n) => !n.read).length

  const onClick = useCallback(
    async (n) => {
      if (markingAll.current || pending.current.has(n.id)) return
      const current = currentItems.current.find((item) => item.id === n.id) || n
      if (!current.read) {
        pending.current.add(n.id)
        setPendingCount((value) => value + 1)
        updateItems((rows) => rows.map((item) => item.id === n.id ? { ...item, read: true } : item))
        const settleCount = adjustCount(-1)
        let success = false
        try {
          await markRead(n.id)
          success = true
        } catch {
          updateItems((rows) => rows.map((item) => item.id === n.id ? { ...item, read: false } : item))
          toast.failure('Could not mark the notification as read. Please try again.')
        } finally {
          settleCount(success)
          pending.current.delete(n.id)
          setPendingCount((value) => value - 1)
          void refresh()
        }
      }
      // The notification may reference a report: the PHP app used report_id
      // or a report_code; either way, link to the report detail.
      if (n.report_code) {
        // We don't have a code->id index here; the report detail can be
        // reached by the id if it was stored. Fall back to the reports list.
        navigate('/admin/reports')
      }
    },
    [navigate, refresh, adjustCount, updateItems, toast],
  )

  const onMarkAll = useCallback(async () => {
    if (!user || markingAll.current || pending.current.size) return
    markingAll.current = true
    setWorking(true)
    const unreadIds = new Set(currentItems.current.filter((item) => !item.read).map((item) => item.id))
    updateItems((rows) => rows.map((item) => ({ ...item, read: true })))
    const settleCount = adjustCount(() => 0)
    let success = false
    try {
      await markAllRead(user.uid)
      success = true
    } catch {
      updateItems((rows) => rows.map((item) => unreadIds.has(item.id) ? { ...item, read: false } : item))
      settleCount(false)
      toast.failure('Could not mark all notifications as read. Please try again.')
      // A later batch may fail after an earlier batch committed. Reconcile those rows after rollback.
      try {
        const fresh = await listNotifications(user.uid)
        updateItems(() => fresh)
      } catch {
        // Keep the reverted rows and the visible failure toast if the follow-up read also fails.
      }
    } finally {
      settleCount(success)
      markingAll.current = false
      setWorking(false)
      void refresh()
    }
  }, [user, refresh, adjustCount, updateItems, toast])

  return (
    <div className="rr-notifications-page">
      <header className="rr-head">
        <div className="rr-head-text">
          <span className="rr-eyebrow">Bulacan admin portal</span>
          <h1>Notifications</h1>
          <p className="rr-sub">New reports, dispatches and site updates, newest first.</p>
        </div>
        {(unread > 0 || count > 0) && (
          <button
            className="btn btn-sm btn-outline-secondary"
            id="mark-all"
            type="button"
            onClick={onMarkAll}
            disabled={loading || working || pendingCount > 0}
          >
            Mark all as read
          </button>
        )}
      </header>
      <div className="rr-tape" aria-hidden="true" />

      <States loading={loading} error={error} empty={items.length === 0} emptyText="No notifications yet.">
        <ul className="list-plain rr-notifications-list">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={`notif-row ${n.read ? '' : 'is-unread'}`}
                data-id={n.id}
                data-read={n.read ? '1' : '0'}
                disabled={working}
                onClick={() => onClick(n)}
              >
                <strong className="d-block">{n.title || 'Notification'}</strong>
                <span className="d-block">{n.message}</span>
                {n.kind === 'status' && structuredStatusText(n.details) && <span className="d-block">{structuredStatusText(n.details)}</span>}
                <span className="small text-secondary">{formatDateTime(n.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      </States>
    </div>
  )
}
