/**
 * Unread notification count for the sidebar pill.
 * Ported from js/app.js refreshUnread().
 */
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import { unreadCount } from '../services/notifications.service.js'

const UnreadContext = createContext(null)

export function UnreadProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.uid || null
  const [snapshot, setSnapshot] = useState({ uid, count: 0 })
  const current = useRef({ uid, count: 0 })
  const pending = useRef(0)
  const version = useRef(0)

  if (current.current.uid !== uid) {
    current.current = { uid, count: 0 }
    pending.current = 0
    version.current += 1
  }

  const setLocalCount = useCallback((value) => {
    if (current.current.uid !== uid) return
    current.current = { uid, count: Math.max(0, Math.min(99, value)) }
    setSnapshot(current.current)
  }, [uid])

  const refresh = useCallback(async () => {
    if (current.current.uid !== uid) return 0
    // A pending write will refresh when it settles; polling must not overwrite its optimistic count.
    if (pending.current) return current.current.count
    const request = ++version.current
    if (!uid) {
      setLocalCount(0)
      return 0
    }
    try {
      const n = await unreadCount(uid)
      if (request === version.current && current.current.uid === uid) setLocalCount(n)
      return n
    } catch {
      return current.current.uid === uid ? current.current.count : 0
    }
  }, [uid, setLocalCount])

  /** Optimistically adjust the count. Call the returned settle(success) after the write, then refresh(). */
  const adjustCount = useCallback((change) => {
    if (current.current.uid !== uid) return () => {}
    const before = current.current.count
    pending.current += 1
    version.current += 1
    setLocalCount(typeof change === 'function' ? change(before) : before + change)
    const undo = before - current.current.count
    let settled = false
    return (success = true) => {
      if (settled || current.current.uid !== uid) return
      settled = true
      if (!success) setLocalCount(current.current.count + undo)
      pending.current -= 1
      version.current += 1
    }
  }, [uid, setLocalCount])

  useEffect(() => {
    refresh()
    // Notifications are written by the mobile app; poll so the pill stays fresh.
    const timer = setInterval(refresh, 60000)
    return () => {
      clearInterval(timer)
      version.current += 1
    }
  }, [refresh])

  const count = snapshot.uid === uid ? snapshot.count : 0
  const value = useMemo(() => ({ count, refresh, adjustCount }), [count, refresh, adjustCount])
  return createElement(UnreadContext.Provider, { value }, children)
}

export function useUnread() {
  const context = useContext(UnreadContext)
  if (!context) throw new Error('useUnread must be used inside <UnreadProvider>')
  return context
}
