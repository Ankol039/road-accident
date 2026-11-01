/**
 * Works out which Firestore composite indexes the portal actually needs.
 *
 * It runs every distinct query shape the app uses, catches the "requires an
 * index" error Firestore returns, and prints:
 *   - the console link, exactly as Firestore produced it
 *   - the index definition decoded back out of that link
 *
 * Nothing is guessed: the collection group, the field list and the ordering
 * all come from the link Firestore itself handed back.
 *
 * Two link shapes exist in the wild:
 *   ?createIndex=collectionGroup%3D…&field%5B0%5D.fieldPath%3D…   (web SDK)
 *   ?create_composite=<base64 protobuf>                           (admin SDK)
 * Both are understood here.
 *
 * USAGE
 *   node scripts/probe-indexes.mjs
 *   node scripts/probe-indexes.mjs --json     # only the firestore.indexes.json array
 */
import { readServiceAccount } from './service-account.mjs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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

initializeApp({ credential: cert(readServiceAccount(keyPath)) })
const db = getFirestore()

const REPORTS = 'reports'
const AUDIT = 'audit_logs'
const USERS = 'users'
const NOTIFICATIONS = 'notifications'
const PHOTOS = 'report_photos'

const OFFICIAL = ['verified', 'in_progress', 'resolved']
const OPEN = ['submitted', 'under_review', 'info_required', 'assigned', 'on_scene', 'verified', 'in_progress']
const ROLES = ['admin', 'officer', 'reporter']
const STATUSES = ['submitted', 'under_review', 'info_required', 'assigned', 'on_scene', 'verified', 'in_progress', 'resolved', 'rejected', 'duplicate']
const ACTIONS = ['report.status', 'report.create', 'report.flag', 'report.unflag', 'report.update', 'report.assign', 'report.remark', 'report.delete', 'settings.update', 'type.update', 'type.create', 'type.toggle', 'contact.update', 'contact.create', 'contact.delete']

/**
 * A query shape is a plain description; the admin SDK is driven with its
 * chainable API (where / orderBy / limit).
 */
const shapes = []
const shape = (label, collectionName, filters, order, max = 5) =>
  shapes.push({ label, collectionName, filters, order, max })

const eq = (field, value) => ({ field, op: '==', value })
const inList = (field, values) => ({ field, op: 'in', value: values })
const gte = (field, value) => ({ field, op: '>=', value })
const lte = (field, value) => ({ field, op: '<=', value })

/* ---------- reports: the filter matrix on the reports table ---------- */
const REPORT_FILTERS = {
  status: () => eq('status', STATUSES[0]),
  accident_type_id: () => eq('accident_type_id', 'probe'),
  municipality: () => eq('municipality', 'Malolos'),
  flagged: () => eq('flagged', true),
}

const COMBOS = [
  [],
  ['status'],
  ['accident_type_id'],
  ['municipality'],
  ['flagged'],
  ['status', 'accident_type_id'],
  ['status', 'municipality'],
  ['status', 'flagged'],
  ['accident_type_id', 'municipality'],
  ['accident_type_id', 'flagged'],
  ['municipality', 'flagged'],
  ['status', 'accident_type_id', 'municipality'],
  ['status', 'accident_type_id', 'flagged'],
  ['status', 'municipality', 'flagged'],
  ['accident_type_id', 'municipality', 'flagged'],
  ['status', 'accident_type_id', 'municipality', 'flagged'],
]

for (const combo of COMBOS) {
  const filters = combo.map((f) => REPORT_FILTERS[f]())
  shape(`reports [${combo.join('+') || 'no filter'}]`, REPORTS, filters, [['accident_date', 'desc']])
}

// the same filters with a date range on top
for (const combo of [[], ['status'], ['accident_type_id'], ['municipality'], ['flagged']]) {
  const filters = [
    ...combo.map((f) => REPORT_FILTERS[f]()),
    gte('accident_date', '2000-01-01'),
    lte('accident_date', '2100-01-01'),
  ]
  shape(`reports range [${combo.join('+') || 'no filter'}]`, REPORTS, filters, [['accident_date', 'desc']])
}

// official-only filter (the dashboard's "verified accident records")
shape('reports official', REPORTS, [inList('status', OFFICIAL)], [['accident_date', 'desc']])
shape('reports official range', REPORTS, [
  inList('status', OFFICIAL),
  gte('accident_date', '2000-01-01'),
  lte('accident_date', '2100-01-01'),
], [['accident_date', 'desc']])
// duplicate detection
shape('reports open', REPORTS, [inList('status', OPEN)], [['accident_date', 'desc']])
// the dashboard's plain range
shape('reports range only', REPORTS, [
  gte('accident_date', '2000-01-01'),
  lte('accident_date', '2100-01-01'),
], [['accident_date', 'desc']])

/* ---------- audit trail ---------- */
shape('audit range', AUDIT, [
  gte('created_at', new Date('2000-01-01')),
  lte('created_at', new Date('2100-01-01')),
], [['created_at', 'desc']])
for (const action of ACTIONS) {
  shape(`audit action=${action}`, AUDIT, [
    eq('action', action),
    gte('created_at', new Date('2000-01-01')),
    lte('created_at', new Date('2100-01-01')),
  ], [['created_at', 'desc']])
}
shape('audit action only', AUDIT, [eq('action', 'report.status')], [])

/* ---------- users ---------- */
shape('users all', USERS, [], [['created_at', 'desc']])
for (const role of ROLES) {
  shape(`users role=${role}`, USERS, [eq('role', role)], [['created_at', 'desc']])
  shape(`users role=${role} status=active`, USERS, [
    eq('role', role),
    eq('status', 'active'),
  ], [['created_at', 'desc']])
}
shape('users status=active', USERS, [eq('status', 'active')], [['created_at', 'desc']])

/* ---------- notifications ---------- */
shape('notifications', NOTIFICATIONS, [eq('user_id', 'probe')], [['created_at', 'desc']])
shape('notifications unread', NOTIFICATIONS, [
  eq('user_id', 'probe'),
  eq('read', false),
], [['created_at', 'desc']])
shape('notifications unread count', NOTIFICATIONS, [
  eq('user_id', 'probe'),
  eq('read', false),
], [])

/* ---------- photos and reference data ---------- */
shape('report photos', PHOTOS, [eq('report_id', 'probe')], [])
shape('accident types', 'accident_types', [], [['name', 'asc']])

/* ---------- decoding the two link shapes ---------- */

const LINK = /https:\/\/console\.firebase\.google\.com\/[^\s"')]+/

/** Minimal protobuf wire reader — enough for the index payload. */
function readVarint(buf, offset) {
  let value = 0
  let shift = 0
  let i = offset
  for (;;) {
    const byte = buf[i]
    i += 1
    value += (byte & 0x7f) * 2 ** shift
    if ((byte & 0x80) === 0) break
    shift += 7
  }
  return { value, next: i }
}

/**
 * The admin SDK hands back a base64 protobuf:
 *   1: name (string)   2: query scope (varint)   3: repeated IndexField
 *   IndexField: 1: field path (string)             2: order (varint)
 */
function decodeCompositeIndex(base64) {
  const buf = Buffer.from(base64, 'base64')
  const fields = []
  let name = null
  let queryScope = 'COLLECTION'

  let i = 0
  while (i < buf.length) {
    const key = readVarint(buf, i)
    i = key.next
    const fieldNo = key.value >> 3
    const wire = key.value & 7

    if (wire === 2) {
      const len = readVarint(buf, i)
      i = len.next
      const data = buf.slice(i, i + len.value)
      i += len.value

      if (fieldNo === 1) {
        name = data.toString('utf8')
      } else if (fieldNo === 3) {
        // IndexField { 1: field path, 2: order }
        let fieldPath = null
        let order = 1
        let j = 0
        while (j < data.length) {
          const k = readVarint(data, j)
          j = k.next
          const no = k.value >> 3
          const w = k.value & 7
          if (w === 2) {
            const l = readVarint(data, j)
            j = l.next
            const s = data.slice(j, j + l.value).toString('utf8')
            j += l.value
            if (no === 1) fieldPath = s
          } else if (w === 0) {
            const v = readVarint(data, j)
            j = v.next
            if (no === 2) order = v.value
          } else {
            break
          }
        }
        fields.push({ fieldPath, order: order === 2 ? 'DESCENDING' : 'ASCENDING' })
      }
    } else if (wire === 0) {
      const v = readVarint(buf, i)
      i = v.next
      if (fieldNo === 2) queryScope = v.value === 2 ? 'COLLECTION_GROUP' : 'COLLECTION'
    } else {
      break
    }
  }

  const collectionGroup = name ? name.split('/collectionGroups/')[1]?.split('/')[0] : null
  return { collectionGroup, queryScope, fields }
}

/** The older web-SDK link: createIndex holds a whole query string. */
function decodeCreateIndex(value) {
  const q = new URLSearchParams(value)
  const collectionGroup = q.get('collectionGroup')
  const count = Number(q.get('field_count') || 0)
  const fields = []
  for (let n = 0; n < count; n += 1) {
    fields.push({
      fieldPath: q.get(`field[${n}].fieldPath`),
      order: (q.get(`field[${n}].order`) || 'ASCENDING').toUpperCase(),
      ...(q.get(`field[${n}].type`) ? { type: q.get(`field[${n}].type`) } : {}),
    })
  }
  return { collectionGroup, queryScope: 'COLLECTION', fields }
}

/** Turn a console link into an index definition. */
function parseIndex(url) {
  const parsed = new URL(url)
  const composite = parsed.searchParams.get('create_composite')
  if (composite) return decodeCompositeIndex(composite)
  const legacy = parsed.searchParams.get('createIndex')
  if (legacy) return decodeCreateIndex(legacy)
  return null
}

/* ---------- run them all ---------- */

const found = new Map()
const errors = []

for (const s of shapes) {
  try {
    let q = db.collection(s.collectionName)
    for (const f of s.filters) q = q.where(f.field, f.op, f.value)
    for (const [field, dir] of s.order) q = q.orderBy(field, dir)
    if (s.max) q = q.limit(s.max)
    await q.get()
  } catch (error) {
    const message = String(error.message || error)
    const match = message.match(LINK)
    if (!match) {
      errors.push({ label: s.label, message: message.split('\n')[0] })
      continue
    }
    const url = match[0]
    const index = parseIndex(url)
    if (!index || !index.collectionGroup) {
      errors.push({ label: s.label, message: `could not parse ${url}` })
      continue
    }
    const key = `${index.collectionGroup}|${index.fields.map((f) => `${f.fieldPath} ${f.order}`).join(',')}`
    if (!found.has(key)) found.set(key, { ...index, url })
  }
}

console.log(`Ran ${shapes.length} query shapes, ${found.size} need a composite index.\n`)

const indexes = [...found.values()].sort((a, b) => {
  if (a.collectionGroup !== b.collectionGroup) return a.collectionGroup.localeCompare(b.collectionGroup)
  const af = a.fields.map((f) => f.fieldPath).join(',')
  const bf = b.fields.map((f) => f.fieldPath).join(',')
  return af.localeCompare(bf)
})

for (const index of indexes) {
  console.log(`* ${index.collectionGroup} [${index.queryScope}]: ${index.fields.map((f) => `${f.fieldPath} ${f.order}`).join(', ')}`)
  console.log(`  ${index.url}`)
}

if (errors.length) {
  console.log('\n--- errors that were not index problems ---')
  for (const e of errors) console.log(`  ${e.label}: ${e.message}`)
}

const asJson = {
  indexes: indexes.map((i) => ({
    collectionGroup: i.collectionGroup,
    queryScope: i.queryScope,
    fields: i.fields.map((f) => ({ fieldPath: f.fieldPath, order: f.order })),
  })),
  fieldOverrides: [],
}

console.log('\n--- firestore.indexes.json ---')
console.log(JSON.stringify(asJson, null, 2))

process.exit(0)
