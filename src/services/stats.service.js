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

/**
 * Load reports for a date range (inclusive "YYYY-MM-DD" strings).
 *
 * The verified-only filter is applied here and not in Firestore: a status
 * filter together with a date range needs a composite index, and the single
 * field index on accident_date is enough to read the range.
 */
export async function loadRange({ from, to, officialOnly = false, includeMetadata = false } = {}) {
  const parts = []
  if (from) parts.push(where('accident_date', '>=', from))
  if (to) parts.push(where('accident_date', '<=', to))
  parts.push(orderBy('accident_date', 'desc'), limit(MAX_REPORTS))
  const snap = await getDocs(query(ref(COLLECTIONS.reports), ...parts))
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const filtered = officialOnly ? rows.filter((r) => OFFICIAL_STATUSES.includes(r.status)) : rows
  // Check the unfiltered snapshot: verified-only results can hide that the cap was reached.
  return includeMetadata
    ? { rows: filtered, mayBeTruncated: snap.size >= MAX_REPORTS }
    : filtered
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
    pending: byStatus.submitted || 0,
    on_scene: byStatus.on_scene || 0,
    dispatched: byStatus.assigned || 0,
    verified: byStatus.verified || 0,
    closed: byStatus.resolved || 0,
    duplicates: byStatus.duplicate || 0,
    reviewing: byStatus.under_review || 0,
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

/* ---------- the periods of the summaries screen ---------- */

/** How many periods one range may hold, so a long range cannot flood the table. */
const MAX_PERIODS = 400

const pad2 = (n) => String(n).padStart(2, '0')
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** The Monday of the week a date is in. */
const mondayOf = (d) => {
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return monday
}

/** The key a date belongs to: 2026-09-21, 2026-09-21 (Monday), 2026-09, 2026. */
export function periodKey(dateStr, period = 'month') {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  if (period === 'day') return isoDay(d)
  if (period === 'week') return isoDay(mondayOf(d))
  if (period === 'year') return String(d.getFullYear())
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/** The label of a period: "Tue, Sep 21, 2026", "Sep 21 – 27, 2026", "September 2026", "2026". */
export function periodLabel(key, period = 'month') {
  if (period === 'year') return key
  if (period === 'day') {
    return new Date(`${key}T00:00:00`).toLocaleDateString('en-PH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  if (period === 'week') {
    const monday = new Date(`${key}T00:00:00`)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const left = monday.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    const right =
      monday.getMonth() === sunday.getMonth()
        ? String(sunday.getDate())
        : sunday.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    return `${left} – ${right}, ${sunday.getFullYear()}`
  }
  return new Date(`${key}-01T00:00:00`).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  })
}

/** Every period key inside a range, so empty periods are counted as zero. */
function periodKeysInRange(period, from, to) {
  if (!from || !to) return []
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []

  const keys = []
  if (period === 'day') {
    for (let d = new Date(start); d <= end && keys.length < MAX_PERIODS; d.setDate(d.getDate() + 1)) {
      keys.push(isoDay(d))
    }
    return keys
  }
  if (period === 'week') {
    for (
      let d = mondayOf(start);
      d <= end && keys.length < MAX_PERIODS;
      d.setDate(d.getDate() + 7)
    ) {
      keys.push(isoDay(d))
    }
    return keys
  }
  if (period === 'month') {
    for (
      let d = new Date(start.getFullYear(), start.getMonth(), 1);
      d <= end && keys.length < MAX_PERIODS;
      d.setMonth(d.getMonth() + 1)
    ) {
      keys.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
    }
    return keys
  }
  // A year is only counted when a report falls in it.
  return []
}

/** The numbers one period holds, the way period_summary() counted them. */
function periodStats(group) {
  const typeCounts = new Map()
  const townCounts = new Map()
  let withInjuries = 0
  let fatalities = 0
  let noInjuries = 0
  let unknown = 0
  let vehicles = 0
  let resolved = 0

  for (const r of group) {
    const injury = r.injury_status || 'unknown'
    if (injury === 'fatal') {
      withInjuries += 1
      fatalities += 1
    } else if (injury === 'serious' || injury === 'slight') {
      withInjuries += 1
    } else if (injury === 'none') {
      noInjuries += 1
    } else {
      unknown += 1
    }

    vehicles += Array.isArray(r.vehicles)
      ? r.vehicles.reduce((n, v) => n + (v.quantity ?? 1), 0)
      : 0
    if (r.status === 'resolved') resolved += 1

    const type = r.accident_type_name || r.accident_type_id
    if (type) typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
    if (r.municipality) townCounts.set(r.municipality, (townCounts.get(r.municipality) || 0) + 1)
  }

  const top = (counts) => {
    let best = null
    let bestCount = 0
    counts.forEach((n, key) => {
      if (n > bestCount) {
        bestCount = n
        best = key
      }
    })
    return best
  }

  return {
    total: group.length,
    with_injuries: withInjuries,
    fatalities,
    no_injuries: noInjuries,
    unknown_injuries: unknown,
    vehicles,
    resolved,
    top_type: top(typeCounts) || '—',
    top_town: top(townCounts) || '—',
  }
}

/**
 * Buckets for the summaries screen: day, week, month or year.
 *
 * One row per period, newest first. Empty periods inside the range are kept
 * with zeros, the way period_summary() did, so the table and the chart have
 * no gaps.
 */
export function bucketBy(rows, period = 'month', { from, to } = {}) {
  const groups = new Map()
  rows.forEach((r) => {
    const key = periodKey(r.accident_date, period)
    if (!key) return
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  })

  const keys = new Set([...groups.keys(), ...periodKeysInRange(period, from, to)])

  /* `[...keys]` is an array of key strings, not a list of pairs — iterate the
     keys directly and look the reports back up in `groups`. */
  return [...keys]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((key) => ({
      period: key,
      label: periodLabel(key, period),
      ...periodStats(groups.get(key) || []),
    }))
}

/** The totals line under the summary table. */
export function summaryTotals(rows) {
  const sum = (key) => rows.reduce((n, r) => n + (r[key] || 0), 0)
  return {
    total: sum('total'),
    with_injuries: sum('with_injuries'),
    fatalities: sum('fatalities'),
    no_injuries: sum('no_injuries'),
    unknown_injuries: sum('unknown_injuries'),
    vehicles: sum('vehicles'),
    resolved: sum('resolved'),
  }
}
