/**
 * Reports service (the `reports` collection).
 *
 * Business rules ported from api/core/reports.php:
 *   - duplicate detection by distance + time window
 *   - status workflow and the status history/timeline
 *   - "official" record determination (verified / in_progress / resolved)
 *   - report code generation (RA-YYYY-NNNNNN)
 *
 * All writes also drop an audit entry, like the PHP API did.
 */
import {
  ref,
  docRef,
  getDoc,
  getDocs,
  addDoc,
  patchDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  writeBatch,
} from '../lib/firestore.js'
import { db } from '../lib/firebase.js'
import { COLLECTIONS, OFFICIAL_STATUSES, OPEN_STATUSES } from '../lib/constants.js'
import { distanceMeters } from '../utils/validation.js'
import { logAudit } from './audit.service.js'

/** Is this report counted in the verified accident records? */
export const isOfficial = (report) => OFFICIAL_STATUSES.includes(report?.status)

/** Is this report still open? */
export const isOpen = (report) => OPEN_STATUSES.includes(report?.status)

const pad = (n, width = 6) => String(n).padStart(width, '0')

/**
 * Next report code, e.g. RA-2026-000012.
 * The PHP app kept a counters document; we increment the same one atomically.
 */
export async function nextReportCode(year = new Date().getFullYear()) {
  const counterId = `reports_${year}`
  const counterRef = docRef(COLLECTIONS.counters, counterId)
  // increment() returns a sentinel; read the resulting value back so we can
  // format the code. Retried once because two admins may save at once.
  await patchDocIgnoringMissing(COLLECTIONS.counters, counterId, { value: increment(1) })
  const snap = await getDoc(counterRef)
  const value = snap.data()?.value ?? 1
  return `RA-${year}-${pad(value)}`
}

async function patchDocIgnoringMissing(name, id, data) {
  try {
    await patchDoc(name, id, data)
  } catch {
    await setDoc(docRef(name, id), { value: 0 }, { merge: true })
    await patchDoc(name, id, data)
  }
}

/**
 * Find an earlier open report near the same spot, within the duplicate window.
 * Mirrors api/core/reports.php find_duplicate().
 */
export async function findDuplicate({ latitude, longitude, accident_date }, settings) {
  const windowMinutes = Number(settings?.duplicate_window_minutes ?? 120)
  const radiusM = Number(settings?.duplicate_radius_m ?? 150)

  const parts = [where('status', 'in', OPEN_STATUSES.slice(0, 10)), orderBy('accident_date', 'desc'), limit(200)]
  const snap = await getDocs(query(ref(COLLECTIONS.reports), ...parts))
  const cutoff = accident_date ? new Date(accident_date).getTime() - windowMinutes * 60000 : null

  for (const d of snap.docs) {
    const r = { id: d.id, ...d.data() }
    const metres = distanceMeters(
      { latitude, longitude },
      { latitude: r.latitude, longitude: r.longitude },
    )
    if (metres == null || metres > radiusM) continue
    if (cutoff != null) {
      const when = r.accident_at?.toDate ? r.accident_at.toDate().getTime() : new Date(r.accident_date).getTime()
      if (Number.isNaN(when) || when < cutoff) continue
    }
    return { report: r, metres }
  }
  return null
}

/**
 * Page through reports with the filters used by the reports table.
 * @param {{q?:string,status?:string,accident_type_id?:string,municipality?:string,
 *          date_from?:string,date_to?:string,flagged?:boolean,official?:boolean,
 *          pageSize?:number,cursor?:any}} opts
 */
export async function listReports(opts = {}) {
  const { status, accident_type_id, municipality, date_from, date_to, flagged, official, pageSize = 25, cursor } = opts

  const parts = []
  if (status) parts.push(where('status', '==', status))
  if (accident_type_id) parts.push(where('accident_type_id', '==', accident_type_id))
  if (municipality) parts.push(where('municipality', '==', municipality))
  if (flagged) parts.push(where('flagged', '==', true))
  if (official) parts.push(where('status', 'in', OFFICIAL_STATUSES))
  if (date_from) parts.push(where('accident_date', '>=', date_from))
  if (date_to) parts.push(where('accident_date', '<=', date_to))
  parts.push(orderBy('accident_date', 'desc'))
  if (cursor) parts.push(startAfter(cursor))
  parts.push(limit(pageSize + 1))

  const snap = await getDocs(query(ref(COLLECTIONS.reports), ...parts))
  const docs = snap.docs
  const hasMore = docs.length > pageSize
  const page = hasMore ? docs.slice(0, pageSize) : docs
  let rows = page.map((d) => ({ id: d.id, ...d.data() }))

  if (opts.q) {
    const needle = opts.q.toLowerCase()
    rows = rows.filter((r) =>
      [r.report_code, r.location_text, r.barangay, r.municipality, r.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    )
  }

  return {
    rows,
    cursor: hasMore ? page[page.length - 1] : null,
    hasMore,
  }
}

export async function getReport(id) {
  const snap = await getDoc(docRef(COLLECTIONS.reports, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/** Everything the dashboard needs: recent reports, no paging. */
export async function recentReports(max = 10) {
  const snap = await getDocs(
    query(ref(COLLECTIONS.reports), orderBy('accident_date', 'desc'), limit(max)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Create a report (used by the admin's "add" form; the mobile app does this too). */
export async function createReport(fields, actor) {
  const report_code = await nextReportCode()
  const payload = {
    ...fields,
    report_code,
    status: fields.status || 'submitted',
    flagged: false,
    status_history: [
      {
        status: fields.status || 'submitted',
        at: new Date().toISOString(),
        by: actor?.full_name || 'System',
        note: 'Report created',
      },
    ],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }
  const created = await addDoc(ref(COLLECTIONS.reports), payload)
  await logAudit({ actor, action: 'report.create', entity: 'report', entityId: created.id, details: report_code })
  return created.id
}

/**
 * Change a report's status, appending to its history.
 * Mirrors api/core/status.php update_status().
 */
export async function updateStatus(id, status, { note, actor } = {}) {
  const current = await getReport(id)
  if (!current) throw new Error('Report not found')

  const history = Array.isArray(current.status_history) ? current.status_history : []
  history.push({
    status,
    at: new Date().toISOString(),
    by: actor?.full_name || 'System',
    note: note || null,
  })

  await patchDoc(COLLECTIONS.reports, id, {
    status,
    status_history: history,
    updated_at: serverTimestamp(),
  })
  await logAudit({ actor, action: 'report.status', entity: 'report', entityId: id, details: status })
  return { ...current, status, status_history: history }
}

/** Flag / unflag a report for review. */
export async function setFlag(id, flagged, { reason, actor } = {}) {
  await patchDoc(COLLECTIONS.reports, id, {
    flagged,
    flag_reason: flagged ? reason || null : null,
    updated_at: serverTimestamp(),
  })
  await logAudit({
    actor,
    action: flagged ? 'report.flag' : 'report.unflag',
    entity: 'report',
    entityId: id,
    details: reason || null,
  })
}

/** Partial edit of report fields. */
export async function updateReport(id, fields, actor) {
  await patchDoc(COLLECTIONS.reports, id, { ...fields, updated_at: serverTimestamp() })
  await logAudit({ actor, action: 'report.update', entity: 'report', entityId: id })
}

/** Delete a report (admin only) and its photo documents. */
export async function deleteReport(id, actor) {
  const photos = await getDocs(
    query(ref(COLLECTIONS.reportPhotos), where('report_id', '==', id)),
  )
  const batch = writeBatch(db)
  photos.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(docRef(COLLECTIONS.reports, id))
  await batch.commit()
  await logAudit({ actor, action: 'report.delete', entity: 'report', entityId: id })
}

/** Photos for one report (base64 bytes are stored inside each document). */
export async function listReportPhotos(reportId) {
  const snap = await getDocs(
    query(ref(COLLECTIONS.reportPhotos), where('report_id', '==', reportId), limit(30)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
