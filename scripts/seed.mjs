/**
 * Seeds fresh sample data so the portal has something to show.
 *
 * This replaces api/tools/seed.php. We reseeded rather than migrated because
 * Firebase Auth passwords cannot be carried over from the PHP bcrypt hashes.
 *
 * The documents written here follow the React schema (see HANDOFF.md §7):
 *   reports/{id}        report_code, accident_type_id = <accident_types doc id>,
 *                        status_history[] = {status, at, by, note}, flagged,
 *                        officer_id / officer_name, arrival_* (flat)
 *   report_photos/{id}  report_id, category, source, mime, data (base64)
 *   users/{uid}         one document per Firebase Auth account
 *   notifications/{id}  user_id = the Auth uid, read (bool)
 *   audit_logs/{id}     actor_id, actor_name, actor_role, action, entity, ...
 *
 * USAGE
 *   node scripts/seed.mjs            # add sample reports + categories + contacts
 *   node scripts/seed.mjs --reset    # delete existing sample rows first
 *
 * Requires the service-account JSON (see scripts/create-user.mjs for the paths).
 * Firestore rules do not apply to the Admin SDK, so this can write freely.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const here = dirname(fileURLToPath(import.meta.url))
const candidates = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  resolve(here, '../../private/firebase-service-account.json'),
  resolve(here, '../firebase-service-account.json'),
].filter(Boolean)

const keyPath = candidates.find((p) => existsSync(p))
if (!keyPath) {
  console.error('Could not find a service-account key. Looked in:\n  ' + candidates.join('\n  '))
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
const db = getFirestore()
const auth = getAuth()
const reset = process.argv.includes('--reset')

const ACCIDENT_TYPES = [
  ['Vehicle collision', 'Two or more vehicles collided on the road.'],
  ['Hit and run', 'A vehicle struck someone or something and left the scene.'],
  ['Rollover', 'A vehicle tipped over.'],
  ['Pedestrian struck', 'A pedestrian was hit by a vehicle.'],
  ['Motorcycle crash', 'A motorcycle or tricycle was involved.'],
  ['Road obstruction', 'Debris, spillage or a stalled vehicle blocking the road.'],
]

const CONTACTS = [
  ['Bulacan Provincial Rescue', '911', 'emergency', 1],
  ['DPWH Bulacan District Office', '(044) 791-0000', 'government', 2],
  ['Provincial Traffic Management', '(044) 791-1111', 'traffic', 3],
]

const TOWNS = [
  'Malolos', 'Meycauayan', 'Marilao', 'Bocaue', 'Santa Maria',
  'San Jose del Monte', 'Baliwag', 'Guiguinto',
]

const INJURY = ['fatal', 'serious', 'slight', 'none', 'unknown']
const ROADS = ['MacArthur Hwy', 'Maharlika Hwy', 'Paseo del Congreso', 'Quirino Hwy', 'Bulacan–Candaba Hwy']
const VEHICLES = ['Car', 'Motorcycle', 'Tricycle', 'Jeepney', 'Truck', 'Bus']

/** Traffic officers: a Firebase Auth account plus a `users` profile document. */
const OFFICERS = [
  { email: 'officer.reyes@roadreport.dev', name: 'Rina Reyes', badge: 'TPB-0142', phone: '0917 555 0142' },
  { email: 'officer.santos@roadreport.dev', name: 'Miguel Santos', badge: 'TPB-0207', phone: '0918 555 0207' },
]

/** Password for the seeded officer accounts (development data only). */
const OFFICER_PASSWORD = 'RoadReport!Officer2026'

/** How each status got there, so the seeded timeline reads like a real one. */
const HISTORY_FOR = {
  submitted: ['submitted'],
  under_review: ['submitted', 'under_review'],
  info_required: ['submitted', 'under_review', 'info_required'],
  assigned: ['submitted', 'under_review', 'assigned'],
  on_scene: ['submitted', 'under_review', 'assigned', 'on_scene'],
  verified: ['submitted', 'under_review', 'assigned', 'on_scene', 'verified'],
  in_progress: ['submitted', 'under_review', 'assigned', 'on_scene', 'verified', 'in_progress'],
  resolved: ['submitted', 'under_review', 'assigned', 'on_scene', 'verified', 'in_progress', 'resolved'],
  rejected: ['submitted', 'rejected'],
  duplicate: ['submitted', 'duplicate'],
}

const NOTES = {
  under_review: 'Administrator started reviewing the report.',
  info_required: 'Asked the reporter for a clearer photo of the plate.',
  assigned: 'Officer dispatched to the pinned location.',
  on_scene: 'Officer tapped "I have arrived" in the app.',
  verified: 'Officer location matched the reporter pin.',
  in_progress: 'Officer started clearing the site.',
  resolved: 'Vehicles removed, the road is clear.',
  rejected: 'Nothing found at the location, closing as a false report.',
  duplicate: 'An earlier open report covers the same spot and time.',
}

const base = { lat: 14.84, lng: 120.81 }
const jitter = (n) => (Math.random() - 0.5) * n
const pad = (n, w = 6) => String(n).padStart(w, '0')

/** Rough metres-per-degree for the offset we use to fake an officer's GPS. */
const offset = (metres) => ({ lat: metres / 111320, lng: metres / 105000 })

/**
 * The report statuses we cycle through. The first two are deliberately
 * `on_scene` so the arrival check panel has real data to work with:
 * one that matches the pin and one that does not.
 */
const STATUS_PLAN = [
  'on_scene', 'on_scene', 'submitted', 'under_review', 'assigned', 'verified',
  'in_progress', 'resolved', 'rejected', 'duplicate', 'info_required', 'submitted',
  'assigned', 'verified', 'resolved', 'under_review', 'submitted', 'on_scene',
  'verified', 'resolved',
]

function buildStatusHistory(status, officer, at) {
  const steps = HISTORY_FOR[status] || ['submitted']
  const start = at.getTime() - steps.length * 3600000
  return steps.map((step, i) => ({
    status: step,
    at: new Date(start + i * 3600000).toISOString(),
    by: step === 'submitted' ? 'Public reporter' : officer?.name || 'RoadReport Admin',
    note: i === 0 ? 'Report created' : NOTES[step] || null,
  }))
}

function sampleReport(i, status, typeId, typeName, officer, at) {
  const town = TOWNS[i % TOWNS.length]
  const road = ROADS[i % ROADS.length]
  const needsOfficer = ['assigned', 'on_scene', 'verified', 'in_progress', 'resolved'].includes(status)
  const assigned = needsOfficer ? officer : null

  const latitude = base.lat + jitter(0.22)
  const longitude = base.lng + jitter(0.22)

  const report = {
    report_code: `RA-${at.getFullYear()}-${pad(i + 1)}`,
    accident_date: at.toISOString().slice(0, 10),
    accident_time: `${String(6 + (i % 16)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
    accident_type_id: typeId,
    accident_type_name: typeName,
    injury_status: INJURY[i % INJURY.length],
    location_text: `${road}, ${town}`,
    barangay: `Barangay ${(i % 12) + 1}`,
    municipality: town,
    latitude,
    longitude,
    description:
      `Sample accident record #${i + 1} in ${town}, generated by scripts/seed.mjs for development.`,
    vehicles: [
      { type: VEHICLES[i % VEHICLES.length], quantity: 1 + (i % 3) },
      ...(i % 3 === 0 ? [{ type: VEHICLES[(i + 2) % VEHICLES.length], quantity: 1 }] : []),
    ],
    status,
    flagged: i % 11 === 0,
    flag_reason: i % 11 === 0 ? 'Needs a second look before it is counted.' : null,
    status_history: buildStatusHistory(status, assigned, at),
    gps_accuracy_m: 8 + (i % 20),
    created_at: Timestamp.fromDate(new Date(at.getTime() - 7200000)),
    updated_at: Timestamp.fromDate(at),
  }

  if (assigned) {
    report.officer_id = assigned.uid
    report.officer_name = assigned.name
    report.officer_badge_no = assigned.badge
  }

  // The officer's arrival point: flat fields, matching OnePinMap.
  if (status === 'on_scene' || status === 'verified' || status === 'in_progress' || status === 'resolved') {
    // The first two on_scene reports are close to / far from the pin.
    const away = i === 0 ? 18 : i === 1 ? 420 : 25 + (i % 40)
    const off = offset(away)
    report.arrival_latitude = latitude + off.lat
    report.arrival_longitude = longitude + off.lng
    report.arrival_accuracy_m = 9 + (i % 14)
    report.arrival_at = new Date(at.getTime() - 900000).toISOString()
    report.arrival_officer_name = assigned?.name || OFFICERS[0].name
    report.arrival_count = 1
  }

  if (status === 'rejected') {
    report.rejection_reason = 'Nothing found at the location, closing as a false report.'
  }
  if (status === 'verified' || status === 'in_progress' || status === 'resolved') {
    report.verified_by = 'seed-admin'
    report.verified_by_name = 'RoadReport Admin'
    report.verified_at = new Date(at.getTime() - 600000).toISOString()
  }

  if (i % 6 === 0) {
    report.remarks = [
      {
        type: 'remark',
        content: 'Called the reporter to confirm the exact lane.',
        is_internal: false,
        by: 'RoadReport Admin',
        at: new Date(at.getTime() - 1800000).toISOString(),
      },
    ]
  }

  return report
}

async function clearCollection(name) {
  const snap = await db.collection(name).get()
  const chunks = []
  for (let i = 0; i < snap.docs.length; i += 400) chunks.push(snap.docs.slice(i, i + 400))
  for (const chunk of chunks) {
    const batch = db.batch()
    chunk.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  return snap.size
}

/**
 * The legacy PHP rows in `users` had numeric document ids and a bcrypt
 * `password_hash`. They are not Firebase Auth accounts, so they are dropped on
 * reset; the Auth-backed profiles (doc id = the Auth uid) are kept.
 */
async function clearLegacyUsers() {
  const listed = await auth.listUsers(1000)
  const authUids = new Set(listed.users.map((u) => u.uid))
  const snap = await db.collection('users').get()
  const orphans = snap.docs.filter((d) => !authUids.has(d.id))
  const batch = db.batch()
  orphans.forEach((d) => batch.delete(d.ref))
  if (orphans.length) await batch.commit()
  return orphans.length
}

/** Create the Auth account if it is missing; return its uid either way. */
async function ensureAuthUser({ email, name, role }) {
  try {
    const existing = await auth.getUserByEmail(email)
    await auth.setCustomUserClaims(existing.uid, { role })
    return { uid: existing.uid, email, name, role, created: false }
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
  }
  const created = await auth.createUser({
    email,
    password: OFFICER_PASSWORD,
    displayName: name,
    emailVerified: false,
  })
  await auth.setCustomUserClaims(created.uid, { role })
  return { uid: created.uid, email, name, role, created: true }
}

/**
 * The legacy PHP app stored raw JPEG bytes in report_photos. We keep the real
 * photographs (so the gallery shows actual scene photos) but re-encode them as
 * base64 strings under the React field names.
 *
 * Older runs of this script stored the base64 text base64-encoded a second
 * time, so the reader also unwraps that: the photograph has to decode to an
 * image, not to more base64 text.
 */
async function grabLegacyPhotos() {
  const snap = await db.collection('report_photos').get()
  const out = []
  for (const d of snap.docs) {
    const data = d.data()
    if (!data || data.data == null) continue

    let base64 = null
    if (Buffer.isBuffer(data.data)) {
      // The legacy PHP app stored the raw JPEG bytes.
      const raw = data.data
      if (raw.length < 1000) continue
      base64 = raw.toString('base64')
    } else {
      base64 = String(data.data)
      if (base64.length < 1000) continue
      // Unwrap one level if the value turns out to be base64 text.
      const unwrapped = Buffer.from(base64, 'base64').toString('utf8')
      if (unwrapped !== base64 && /^[A-Za-z0-9+/=\s]+$/.test(unwrapped)) base64 = unwrapped
    }

    // The photograph must decode to an image.
    const bytes = Buffer.from(base64, 'base64')
    const isImage =
      (bytes[0] === 0xff && bytes[1] === 0xd8) || // JPEG
      (bytes[0] === 0x89 && bytes[1] === 0x50) || // PNG
      (bytes[0] === 0x47 && bytes[1] === 0x49) // GIF
    if (!isImage) {
      console.warn(`  skipped a photo that does not decode to an image (${d.id})`)
      continue
    }

    out.push({
      category: data.category || 'scene',
      source: data.source || 'camera',
      mime: data.mime_type || data.mime || 'image/jpeg',
      width: data.width || 0,
      height: data.height || 0,
      base64,
    })
  }
  return out
}

try {
  // Photos are read before any reset wipes them.
  const legacyPhotos = await grabLegacyPhotos()

  if (reset) {
    for (const name of [
      'reports', 'report_photos', 'accident_types', 'emergency_contacts',
      'notifications', 'audit_logs', 'counters',
    ]) {
      const n = await clearCollection(name)
      if (n) console.log(`Cleared ${n} ${name}`)
    }
    const n = await clearLegacyUsers()
    if (n) console.log(`Cleared ${n} legacy users`)
  }

  /* ---------- traffic officers (Auth account + profile document) ---------- */

  const officers = []
  for (const spec of OFFICERS) {
    const account = await ensureAuthUser({ ...spec, role: 'officer' })
    await db.doc(`users/${account.uid}`).set({
      email: account.email,
      full_name: account.name,
      phone: spec.phone,
      role: 'officer',
      status: 'active',
      badge_no: spec.badge,
      created_at: Timestamp.now(),
    }, { merge: true })
    officers.push({ ...account, badge: spec.badge })
    console.log(`Officer ${account.email} (${account.uid})${account.created ? ' created' : ' reused'}`)
  }

  /* ---------- accident categories: remember the real document ids ---------- */

  const typeBatch = db.batch()
  const types = []
  for (const [name, description] of ACCIDENT_TYPES) {
    const ref = db.collection('accident_types').doc()
    typeBatch.set(ref, { name, description, active: true, created_at: Timestamp.now() })
    types.push({ id: ref.id, name })
  }
  await typeBatch.commit()
  console.log(`Seeded ${types.length} accident categories`)

  /* ---------- emergency contacts ---------- */

  const contactBatch = db.batch()
  const contacts = []
  for (const [name, phone, category, sort_order] of CONTACTS) {
    const ref = db.collection('emergency_contacts').doc()
    contactBatch.set(ref, { name, phone, category, sort_order, is_active: true })
    contacts.push({ id: ref.id, name })
  }
  await contactBatch.commit()

  /* ---------- reports ---------- */

  const reportBatch = db.batch()
  const counter = {}
  const reportIds = []
  const now = Date.now()
  for (let i = 0; i < STATUS_PLAN.length; i += 1) {
    const status = STATUS_PLAN[i]
    const type = types[i % types.length]
    const officer = officers[i % officers.length]
    const at = new Date(now - Math.floor(Math.random() * 60) * 86400000)
    const id = `report-${pad(i + 1, 4)}`
    const report = sampleReport(i, status, type.id, type.name, officer, at)
    reportBatch.set(db.collection('reports').doc(id), report)
    reportIds.push({ id, report, officer })
    counter[report.accident_date.slice(0, 4)] = (counter[report.accident_date.slice(0, 4)] || 0) + 1
  }
  await reportBatch.commit()

  // The duplicate report points at an earlier open report.
  const duplicate = reportIds.find((r) => r.report.status === 'duplicate')
  const original = reportIds.find((r) => r.report.status === 'submitted')
  if (duplicate && original) {
    await db.doc(`reports/${duplicate.id}`).update({
      duplicate_of: original.id,
      duplicate_of_code: original.report.report_code,
      flagged: true,
      flag_reason: `Duplicate of ${original.report.report_code}.`,
    })
  }

  /* ---------- photos: keep the real photographs from the legacy rows ---------- */

  const photos = legacyPhotos.length
    ? legacyPhotos
    : [{
        category: 'scene',
        source: 'camera',
        mime: 'image/jpeg',
        width: 640,
        height: 480,
        base64: '',
      }]

  const photoBatch = db.batch()
  let photoCount = 0
  for (const r of reportIds) {
    const wanted = ['scene', 'plate', 'damage']
    // Reports with casualties also carry the sensitive "people" photo, so the
    // blurred / revealed section is exercised in the admin portal.
    if (['fatal', 'serious'].includes(r.report.injury_status)) wanted.push('people')
    for (const category of wanted) {
      const source = photos.find((p) => p.category === category) || photos[0]
      if (!source?.base64) continue
      photoBatch.set(db.collection('report_photos').doc(), {
        report_id: r.id,
        category,
        source: source.source,
        mime: source.mime,
        data: source.base64,
        width: source.width,
        height: source.height,
        uploaded_at: Timestamp.now(),
      })
      photoCount += 1
    }
  }
  await photoBatch.commit()

  /* ---------- counters (the next report code continues from here) ---------- */

  for (const [year, value] of Object.entries(counter)) {
    await db.collection('counters').doc(`reports_${year}`).set({ value }, { merge: true })
  }

  /* ---------- system settings ---------- */

  await db.collection('settings').doc('system').set({
    system_name: 'RoadReport Bulacan',
    max_photos_per_report: 6,
  })
  for (const [key, value] of Object.entries({
    duplicate_window_minutes: 120,
    duplicate_radius_m: 150,
    arrival_match_radius_m: 120,
  })) {
    await db.collection('settings').doc(key).set({ value })
  }

  /* ---------- notifications for every admin account ---------- */

  const admins = await db.collection('users').where('role', '==', 'admin').get()
  const notifications = [
    ['New report awaiting review', 'A report was submitted near MacArthur Hwy in Malolos.', 'submitted'],
    ['Officer dispatched', 'Rina Reyes was assigned to report RA-2026-000002.', 'assigned'],
    ['Site cleared', 'The assigned officer finished clearing the site.', 'resolved'],
  ]
  let notificationCount = 0
  const notificationBatch = db.batch()
  for (const admin of admins.docs) {
    notifications.forEach(([title, message, kind], i) => {
      notificationBatch.set(db.collection('notifications').doc(), {
        user_id: admin.id,
        report_code: `RA-2026-00000${i + 1}`,
        title,
        message,
        kind,
        read: false,
        created_at: Timestamp.fromDate(new Date(now - (i + 1) * 1800000)),
      })
      notificationCount += 1
    })
  }
  await notificationBatch.commit()

  /* ---------- a little audit history so the trail is not empty ---------- */

  const adminDoc = admins.docs[0]
  const adminName = adminDoc?.data()?.full_name || 'RoadReport Admin'

  // Every entry points at a real document, the way the app writes it: the
  // audit screen links to the item and shows its name.
  const pick = (status) =>
    reportIds.find((r) => r.report.status === status) || reportIds[0]
  const auditSeed = [
    ['report.status', 'report', pick('under_review').id, { changed: { status: { from: 'submitted', to: 'under_review' } } }],
    ['report.status', 'report', pick('assigned').id, { changed: { status: { from: 'under_review', to: 'assigned' } } }],
    ['report.assign', 'report', pick('assigned').id, { officer: officers[0]?.email || null }],
    ['report.remark', 'report', pick('on_scene').id, { kind: 'remark', note: 'Called the reporter, the lane is confirmed.' }],
    ['report.flag', 'report', pick('duplicate').id, { reason: 'Duplicate of an earlier report.' }],
    ['settings.update', 'settings', 'system', { changed: { arrival_match_radius_m: { from: 100, to: 120 } } }],
    ['type.update', 'accident_type', types[0].id, { name: types[0].name }],
    ['contact.update', 'emergency_contact', contacts[0].id, { name: contacts[0].name }],
  ]
  for (let i = 0; i < auditSeed.length; i += 1) {
    const [action, entity, entityId, details] = auditSeed[i]
    await db.collection('audit_logs').doc().set({
      actor_id: adminDoc?.id || 'seed',
      actor_name: adminName,
      actor_role: 'admin',
      action,
      entity,
      entity_id: entityId,
      details,
      created_at: Timestamp.fromDate(new Date(now - (i + 1) * 5400000)),
    })
  }

  console.log(
    `Seeded ${reportIds.length} reports, ${types.length} accident types, ${CONTACTS.length} emergency contacts, ` +
    `${photoCount} photos, ${notificationCount} notifications and ${auditSeed.length} audit entries.`,
  )
  console.log(`Officer sign-in password: ${OFFICER_PASSWORD}`)
  process.exit(0)
} catch (error) {
  console.error('Seed failed:', error.message)
  console.error(error.stack)
  process.exit(1)
}
