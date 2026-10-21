/**
 * Unread notification count for the sidebar pill.
 * Ported from js/app.js refreshUnread().
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import { unreadCount } from '../services/notifications.service.js'

export function useUnread() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!user) return 0
    try {
      const n = await unreadCount(user.uid)
      setCount(n)
      return n
    } catch {
      return 0
    }
  }, [user])

  useEffect(() => {
    refresh()
    // Notifications are written by the mobile app; poll so the pill stays fresh.
    const timer = setInterval(refresh, 60000)
    return () => clearInterval(timer)
  }, [refresh])

  return { count, refresh, setCount }
}
