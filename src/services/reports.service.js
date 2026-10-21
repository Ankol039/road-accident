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
  runTransaction,
  readSetting,
} from '../lib/firestore.js'
import { db } from '../lib/firebase.js'
import {
  COLLECTIONS,
  OFFICIAL_STATUSES,
  OPEN_STATUSES,
  REPORT_STATUSES,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
  SPECIAL_ENDPOINT_STATUSES,
} from '../lib/constants.js'
import { distanceMeters } from '../utils/validation.js'
import { ValidationError } from '../lib/errors.js'
import { logAudit } from './audit.service.js'
import { notifyOfficer } from './notifications.service.js'

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

/** Find a report by its RA- code, e.g. "RA-2026-000012". */
export async function findReportByCode(code) {
  const wanted = String(code || '').trim().toUpperCase()
  if (!wanted) return null
  const snap = await getDocs(query(ref(COLLECTIONS.reports), where('report_code', '==', wanted), limit(1)))
  return snap.docs.length ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null
}

/**
 * The statuses an administrator may move this report to right now.
 * Mirrors the checks in api/reports/update-status.php.
 */
export function allowedNextStatuses(report) {
  if (!report) return []
  return STATUS_TRANSITIONS[report.status] || []
}

/**
 * Compare the officer's arrival point with the reporter's pin.
 * Ported from api/core/reports.php arrival_assessment().
 *
 * The officer's arrival is stored flat on the report (arrival_latitude,
 * arrival_longitude, arrival_accuracy_m) so OnePinMap can draw it directly.
 */
export function assessArrival(report, radiusM = 120) {
  const radius = Number(radiusM) || 120
  const hasPin = report?.latitude != null && report?.longitude != null
  const hasArrival = report?.arrival_latitude != null && report?.arrival_longitude != null

  const distance =
    hasPin && hasArrival
      ? distanceMeters(
          { latitude: report.latitude, longitude: report.longitude },
          { latitude: report.arrival_latitude, longitude: report.arrival_longitude },
        )
      : null

  const officerAccuracy = report?.arrival_accuracy_m ?? null
  const reporterAccuracy = report?.gps_accuracy_m ?? null
  const known = officerAccuracy != null && reporterAccuracy != null
  const accuracy = Math.max(Number(officerAccuracy || 0), Number(reporterAccuracy || 0))

  const matches = distance != null && distance <= radius

  return {
    distance_m: distance,
    radius_m: radius,
    matches,
    accuracy_uncertain: !known || accuracy > radius,
    review_required: !matches || !known || accuracy > radius,
    officer_accuracy_m: officerAccuracy,
    reporter_accuracy_m: reporterAccuracy,
    officer_name: report?.arrival_officer_name || report?.officer_name || null,
    at: report?.arrival_at || null,
    count: report?.arrival_count || 1,
  }
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
 * Mirrors api/reports/update-status.php.
 *
 * The workflow rules travel with the change, so the screen and the service
 * agree on what is allowed:
 *   - only the moves listed in STATUS_TRANSITIONS are accepted
 *   - "assigned" and "on_scene" have their own steps (except the resend)
 *   - rejecting needs a reason; asking for more information needs a note
 *   - approving an arrival the GPS does not back up needs a note
 *   - confirming a duplicate needs a linked original report and a note
 */
export async function updateStatus(id, status, { note, reason, actor } = {}) {
  const current = await getReport(id)
  if (!current) throw new Error('Report not found')

  const from = current.status
  const errors = {}

  if (!REPORT_STATUSES.includes(status)) {
    throw new ValidationError({ status: 'Unknown status' })
  }

  const resend = from === 'on_scene' && status === 'assigned'
  if (SPECIAL_ENDPOINT_STATUSES[status] && !resend) {
    throw new ValidationError({ status: `Use ${SPECIAL_ENDPOINT_STATUSES[status]} for this step` })
  }
  if (!allowedNextStatuses(current).includes(status)) {
    throw new ValidationError({
      status: `Cannot change status from "${STATUS_LABELS[from]}" to "${STATUS_LABELS[status]}"`,
    })
  }

  if (status === 'rejected' && !reason) errors.reason = 'Enter the reason'
  if (status === 'info_required' && !note) errors.note = 'Tell the reporter what information is missing'
  if (resend && !note) errors.note = 'Tell the officer what to fix'
  if (from === 'duplicate' && !note) errors.note = 'Say why this is not a duplicate'

  // Approving an arrival the GPS does not back up has to be documented.
  if (from === 'on_scene' && status === 'verified') {
    const radius = Number(await readSetting('arrival_match_radius_m', 120))
    if (assessArrival(current, radius).review_required && !note) {
      errors.note = 'Describe the evidence checked'
    }
  }

  if (status === 'duplicate') {
    const original = current.duplicate_of ? await getReport(current.duplicate_of) : null
    if (!original || original.id === id || ['duplicate', 'rejected'].includes(original.status)) {
      errors.duplicate_of = 'Link a valid original report using Flag first'
    }
    if (!note) errors.note = 'Explain why both reports describe the same incident'
  }

  if (Object.keys(errors).length) throw new ValidationError(errors)

  const changes = { status, updated_at: serverTimestamp() }
  if (status === 'verified') {
    changes.verified_by = actor?.uid || actor?.id || null
    changes.verified_by_name = actor?.full_name || null
    changes.verified_at = new Date().toISOString()
  }
  if (status === 'rejected') {
    changes.rejection_reason = String(reason).slice(0, 255)
  }
  if (from === 'duplicate') {
    // The report leaves the duplicate queue, so the flag goes with it.
    Object.assign(changes, {
      flagged: false,
      flag_reason: null,
      duplicate_of: null,
      duplicate_of_code: null,
      duplicate_distance_m: null,
    })
  }

  const historyNote =
    status === 'rejected'
      ? `Rejected: ${reason}`
      : resend
        ? `Location does not match. Officer asked to resend arrival: ${note}`
        : from === 'duplicate'
          ? `Not a duplicate: ${note}`
          : status === 'verified' && from === 'on_scene'
            ? `Admin reviewed arrival and evidence. Approved to clear the site${note ? `. ${note}` : ''}`
            : note || null

  // A transaction keeps the timeline append safe: two staff members cannot
  // overwrite each other's entry.
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef(COLLECTIONS.reports, id))
    if (!snap.exists()) throw new Error('Report not found')
    const history = Array.isArray(snap.data().status_history) ? [...snap.data().status_history] : []
    history.push({
      status,
      at: new Date().toISOString(),
      by: actor?.full_name || 'System',
      note: historyNote,
    })
    tx.update(docRef(COLLECTIONS.reports, id), { ...changes, status_history: history })
  })

  await logAudit({
    actor,
    action: 'report.status',
    entity: 'report',
    entityId: id,
    details: `${from} -> ${status}${historyNote ? `: ${historyNote}` : ''}`,
  })

  // The officer hears about the administrator's decision.
  if (current.officer_id && current.officer_id !== actor?.uid) {
    const message =
      status === 'verified'
        ? 'Approved: the location matches. You may now clear the site and remove the vehicles.'
        : resend
          ? `Your location does not match the reported pin. ${note} Then tap "I've arrived" again.`
          : status === 'rejected'
            ? `Report closed as rejected: ${reason}. No further action needed.`
            : `Status is now: ${STATUS_LABELS[status]}`
    await notifyOfficer(current.officer_id, `Report ${current.report_code}`, message, current)
  }

  return { ...current, ...changes, status_history: [...(current.status_history || []), { status, at: changes.verified_at || new Date().toISOString(), by: actor?.full_name || 'System', note: historyNote }] }
}

/**
 * Send the report's pin to a traffic officer.
 * Mirrors api/reports/assign.php.
 *
 * A submitted or under-review report moves to "assigned"; a report that is
 * already assigned (or being cleared) can be handed to another officer, and
 * the hand-over is kept as a remark.
 */
export async function assignOfficer(id, officer, { note, actor } = {}) {
  const current = await getReport(id)
  if (!current) throw new Error('Report not found')

  const errors = {}
  const dispatch = ['submitted', 'under_review'].includes(current.status)
  const reassign = ['assigned', 'verified', 'in_progress'].includes(current.status)
  if (!dispatch && !reassign) {
    throw new ValidationError({
      officer_id: `An officer cannot be sent while the report is "${STATUS_LABELS[current.status]}".`,
    })
  }
  if (!officer || officer.role !== 'officer' || officer.status !== 'active') {
    errors.officer_id = 'Choose an active traffic officer'
  }
  if (reassign && officer && current.officer_id === officer.id) {
    errors.officer_id = 'This officer is already assigned'
  }
  if (Object.keys(errors).length) throw new ValidationError(errors)

  const changes = {
    officer_id: officer.id,
    officer_name: officer.full_name,
    officer_badge_no: officer.badge_no || null,
    updated_at: serverTimestamp(),
  }

  const historyEntry = {
    status: 'assigned',
    at: new Date().toISOString(),
    by: actor?.full_name || 'System',
    note: `Officer dispatched: ${officer.full_name}${note ? `. ${note}` : ''}`,
  }

  const remark = {
    type: 'action',
    content: `Reassigned from ${current.officer_name || 'nobody'} to ${officer.full_name}${note ? `: ${note}` : ''}`,
    is_internal: true,
    by: actor?.full_name || 'System',
    at: new Date().toISOString(),
  }

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef(COLLECTIONS.reports, id))
    if (!snap.exists()) throw new Error('Report not found')
    const data = snap.data()
    const update = { ...changes }
    if (dispatch) {
      update.status = 'assigned'
      const history = Array.isArray(data.status_history) ? [...data.status_history] : []
      history.push(historyEntry)
      update.status_history = history
    } else {
      const remarks = Array.isArray(data.remarks) ? [...data.remarks] : []
      remarks.push(remark)
      update.remarks = remarks
    }
    tx.update(docRef(COLLECTIONS.reports, id), update)
  })

  await logAudit({
    actor,
    action: 'report.assign',
    entity: 'report',
    entityId: id,
    details: `${officer.full_name}${reassign ? ' (reassigned)' : ''}`,
  })

  await notifyOfficer(
    officer.id,
    `Go to this accident: ${current.report_code}`,
    `${current.location_text || ''}${
      current.latitude != null ? ` (pin ${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)})` : ''
    }. Open the report for the map, and tap "I've arrived" at the scene.${note ? ` ${note}` : ''}`,
    current,
  )

  return { ...current, ...changes, status: dispatch ? 'assigned' : current.status }
}

/**
 * Add a remark, finding or action to a report.
 * Mirrors api/reports/add-remark.php.
 */
export async function addRemark(id, { type = 'remark', content, is_internal = true } = {}, actor) {
  const text = String(content || '').trim()
  const errors = {}
  if (!['remark', 'finding', 'action'].includes(type)) {
    errors.type = 'Choose remark, finding or action taken'
  }
  if (text.length < 3) errors.content = 'Write the remark'
  if (Object.keys(errors).length) throw new ValidationError(errors)

  const current = await getReport(id)
  if (!current) throw new Error('Report not found')

  const remark = {
    type,
    content: text.slice(0, 2000),
    is_internal: Boolean(is_internal),
    by: actor?.full_name || 'System',
    at: new Date().toISOString(),
  }

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef(COLLECTIONS.reports, id))
    if (!snap.exists()) throw new Error('Report not found')
    const remarks = Array.isArray(snap.data().remarks) ? [...snap.data().remarks] : []
    remarks.push(remark)
    tx.update(docRef(COLLECTIONS.reports, id), { remarks, updated_at: serverTimestamp() })
  })

  await logAudit({
    actor,
    action: 'report.remark',
    entity: 'report',
    entityId: id,
    details: `${type}${is_internal ? ' (internal)' : ''}`,
  })

  return remark
}

/**
 * Flag / unflag a report for review.
 * Mirrors api/reports/flag.php, including linking a duplicate original.
 */
export async function setFlag(id, flagged, { reason, duplicate_of, actor } = {}) {
  const current = await getReport(id)
  if (!current) throw new Error('Report not found')

  const errors = {}
  let original = null

  if (flagged && duplicate_of) {
    original = await findReportByCode(duplicate_of)
    if (!original) original = await getReport(duplicate_of)
    if (!original || original.id === id) {
      errors.duplicate_of = 'No other report has that ID'
    }
  }

  const flagReason = flagged
    ? String(reason || (original ? `Duplicate of ${original.report_code}` : '')).trim()
    : null
  if (flagged && !flagReason) {
    errors.reason = 'Say why it is flagged (incomplete, duplicate...)'
  }
  if (Object.keys(errors).length) throw new ValidationError(errors)

  await patchDoc(COLLECTIONS.reports, id, {
    flagged,
    flag_reason: flagged ? flagReason.slice(0, 255) : null,
    duplicate_of: flagged && original ? original.id : null,
    duplicate_of_code: flagged && original ? original.report_code || null : null,
    updated_at: serverTimestamp(),
  })

  await logAudit({
    actor,
    action: flagged ? 'report.flag' : 'report.unflag',
    entity: 'report',
    entityId: id,
    details: flagged ? flagReason : null,
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
