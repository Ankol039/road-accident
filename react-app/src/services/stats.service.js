/**
 * Statistics service for the dashboard and summaries screens.
 * Ported from api/core/stats.php.
 *
 * Firestore has no GROUP BY, so we read the (bounded) set of reports in the
 * chosen range and aggregate in the browser. Ranges are capped to keep reads
 * inside the Spark plan's daily quota.
 */
import { ref, getDocs, query, where, orderBy, limit } from '../lib/firestore.js'
import { COLLECTIONS, OFFICIAL_STATUSES } from '../lib/constants.js'

const MAX_REPORTS = 2000

/** Load reports for a date range (inclusive "YYYY-MM-DD" strings). */
export async function loadRange({ from, to, officialOnly = false } = {}) {
  const parts = []
  if (from) parts.push(where('accident_date', '>=', from))
  if (to) parts.push(where('accident_date', '<=', to))
  if (officialOnly) parts.push(where('status', 'in', OFFICIAL_STATUSES))
  parts.push(orderBy('accident_date', 'desc'), limit(MAX_REPORTS))
  const snap = await getDocs(query(ref(COLLECTIONS.reports), ...parts))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const tally = (rows, keyFn) => {
  const map = new Map()
  rows.forEach((r) => {
    const key = keyFn(r)
    if (key == null) return
    map.set(key, (map.get(key) || 0) + 1)
  })
  return [...map.entries()]
    .map(([label, value]) => ({ label: String(label), value }))
    .sort((a, b) => b.value - a.value)
}

/** Build every aggregate the dashboard shows, in one pass. */
export function summarise(rows) {
  const byStatus = Object.fromEntries(tally(rows, (r) => r.status).map((x) => [x.label, x.value]))

  const official = rows.filter((r) => OFFICIAL_STATUSES.includes(r.status))

  const byMonth = MONTHS.map((m, i) => ({
    label: m,
    value: rows.filter((r) => new Date(r.accident_date).getMonth() === i).length,
  }))

  const byHour = Array.from({ length: 24 }, (_, h) => ({
    label: String(h).padStart(2, '0'),
    value: rows.filter((r) => String(r.accident_time || '').startsWith(String(h).padStart(2, '0'))).length,
  }))

  const injuries = rows.reduce(
    (acc, r) => {
      acc[r.injury_status] = (acc[r.injury_status] || 0) + 1
      return acc
    },
    { fatal: 0, serious: 0, slight: 0, none: 0, unknown: 0 },
  )

  const vehicles = rows.reduce(
    (total, r) => total + (Array.isArray(r.vehicles) ? r.vehicles.reduce((n, v) => n + (v.quantity ?? 1), 0) : 0),
    0,
  )

  const today = new Date().toISOString().slice(0, 10)

  return {
    total: rows.length,
    official: official.length,
    today: rows.filter((r) => r.accident_date === today).length,
    pending: (byStatus.submitted || 0) + (byStatus.under_review || 0) + (byStatus.info_required || 0),
    on_scene: byStatus.on_scene || 0,
    dispatched: (byStatus.assigned || 0) + (byStatus.on_scene || 0),
    verified: byStatus.verified || 0,
    closed: (byStatus.resolved || 0) + (byStatus.rejected || 0),
    duplicates: byStatus.duplicate || 0,
    flagged: rows.filter((r) => r.flagged).length,
    byStatus,
    byMonth,
    byHour,
    byType: tally(rows, (r) => r.accident_type_name || r.accident_type_id),
    byTown: tally(rows, (r) => r.municipality),
    injuries,
    vehicles,
    resolved: byStatus.resolved || 0,
  }
}

/** Top accident spots: grids the pins to ~4 decimal places and counts them. */
export function hotspots(rows, max = 6) {
  return tally(
    rows.filter((r) => r.latitude && r.longitude),
    (r) => `${Number(r.latitude).toFixed(4)},${Number(r.longitude).toFixed(4)}`,
  )
    .slice(0, max)
    .map(({ label, value }) => {
      const [lat, lng] = label.split(',')
      const sample = rows.find(
        (r) => Number(r.latitude).toFixed(4) === lat && Number(r.longitude).toFixed(4) === lng,
      )
      return {
        count: value,
        latitude: Number(lat),
        longitude: Number(lng),
        label: [sample?.barangay, sample?.municipality].filter(Boolean).join(', ') || 'Pinned location',
      }
    })
}

/** Buckets for the summaries screen: day / week / month. */
export function bucketBy(rows, period = 'month') {
  const keyOf = (dateStr) => {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return null
    if (period === 'day') return dateStr
    if (period === 'week') {
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      return monday.toISOString().slice(0, 10)
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const groups = new Map()
  rows.forEach((r) => {
    const key = keyOf(r.accident_date)
    if (!key) return
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  })

  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([period_key, group]) => {
      const s = summarise(group)
      return {
        period: period_key,
        total: s.total,
        with_injuries: s.total - (s.injuries.none || 0),
        fatalities: s.injuries.fatal || 0,
        no_injuries: s.injuries.none || 0,
        unknown: s.injuries.unknown || 0,
        vehicles: s.vehicles,
        resolved: s.resolved,
        top_type: s.byType[0]?.label || '—',
        top_town: s.byTown[0]?.label || '—',
      }
    })
}
