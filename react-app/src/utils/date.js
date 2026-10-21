/**
 * Date/time helpers, ported from js/ui.js (en-PH formatting).
 * Handles both Firestore Timestamps and legacy "YYYY-MM-DD HH:MM:SS" strings.
 */
import { toDate } from '../lib/time.js'

const dateFmt = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const dateTimeFmt = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export const formatDate = (value) => {
  const d = toDate(value)
  return d ? dateFmt.format(d) : ''
}

export const formatDateTime = (value) => {
  const d = toDate(value)
  return d ? dateTimeFmt.format(d) : ''
}

/** "14:35" -> "2:35 PM" (Philippine 12-hour clock). */
export function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (Number.isNaN(h)) return ''
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const pad = (n) => String(n).padStart(2, '0')

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const daysAgoISO = (n) => {
  const d = new Date(Date.now() - n * 86400000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const nowHHMM = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Date -> "YYYY-MM-DD" for <input type=date>. */
export const isoDate = (value) => {
  const d = toDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
