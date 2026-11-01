import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Keep list controls and Firestore cursor objects in memory for Back/Forward.
// A fresh history entry still starts with its own defaults; nothing is persisted.
const listStates = new Map()

export function useReportTableState(name, initialValue) {
  const location = useLocation()
  const key = `${location.key}:${location.pathname}:${location.search}:${name}`
  const [value, setValue] = useState(() => listStates.has(key) ? listStates.get(key) : initialValue)
  useEffect(() => { listStates.set(key, value) }, [key, value])
  return [value, setValue]
}

export function useReportRowNavigation() {
  const navigate = useNavigate()
  return (event, id) => {
    if (event.defaultPrevented || event.target.closest('a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable]:not([contenteditable="false"])')) return
    if (window.getSelection()?.toString()) return

    const to = `/admin/reports/${id}`
    // Leave native links alone. Row modifiers/middle-click use a separate tab,
    // and never change this tab's router history. Ignore secondary clicks.
    if (event.button === 1 || (event.button === 0 && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))) {
      event.preventDefault()
      window.open(to, '_blank', 'noopener,noreferrer')
    } else if (event.button === 0) {
      navigate(to)
    }
  }
}
