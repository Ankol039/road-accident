/**
 * Toast notifications, replacing js/ui.js toast().
 * The old app appended a .toast-box to the body; here a provider does the same.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

let nextId = 1

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const push = useCallback((message, { error = false, ttl = 5000 } = {}) => {
    const id = nextId++
    setItems((list) => [...list, { id, message, error }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), ttl)
  }, [])

  const value = useMemo(
    () => ({
      toast: push,
      success: (m) => push(m),
      failure: (m) => push(m, { error: true }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-box" aria-live="polite" aria-atomic="true">
        {items.map((t) => (
          <div key={t.id} className={`toast-msg${t.error ? ' toast-error' : ''}`} role="status">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
