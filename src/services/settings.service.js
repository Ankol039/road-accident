/**
 * Settings service: accident categories, emergency contacts, system settings.
 * Ported from api/core/settings.php + api/settings/*.php.
 *
 * Documents:
 *   settings/system              { system_name, max_photos_per_report, ... }
 *   settings/duplicate_window_minutes, duplicate_radius_m, arrival_match_radius_m
 *   accident_types/{id}          { name, description, active }
 *   emergency_contacts/{id}      { name, phone, category, sort_order, is_active }
 */
import {
  ref,
  getDocs,
  query,
  where,
  fetchCollection,
  fetchDoc,
  createDoc,
  patchDoc,
  removeDoc,
  serverTimestamp,
  docRef,
  setDoc,
} from '../lib/firestore.js'
import { COLLECTIONS } from '../lib/constants.js'
import { logAudit } from './audit.service.js'
import { ValidationError } from '../lib/errors.js'

/** Default system settings, used when the settings docs are missing. */
export const DEFAULT_SETTINGS = {
  system_name: 'RoadReport Bulacan',
  max_photos_per_report: 6,
  duplicate_window_minutes: 120,
  duplicate_radius_m: 150,
  arrival_match_radius_m: 120,
}

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS)

/** Read every system setting into one flat object. */
export async function getSystemSettings() {
  const [system, ...rest] = await Promise.all([
    fetchDoc(COLLECTIONS.settings, 'system'),
    ...SETTING_KEYS.filter((k) => !['system_name', 'max_photos_per_report'].includes(k)).map((k) =>
      fetchDoc(COLLECTIONS.settings, k),
    ),
  ])
  const merged = { ...DEFAULT_SETTINGS, ...(system || {}) }
  const otherKeys = SETTING_KEYS.filter(
    (k) => !['system_name', 'max_photos_per_report'].includes(k),
  )
  rest.forEach((doc, i) => {
    if (doc && doc.value != null) merged[otherKeys[i]] = doc.value
  })
  return merged
}

/** Save the system settings form. */
export async function saveSystemSettings(values, actor) {
  const errors = {}
  const next = {}

  if (values.system_name !== undefined) {
    const name = String(values.system_name || '').trim()
    if (!name || name.length > 40) errors.system_name = 'Enter a name (up to 40 characters)'
    else next.system_name = name
  }

  // The ranges of api/settings/save.php.
  const numbers = {
    max_photos_per_report: [3, 15, 'int'],
    duplicate_radius_m: [1, 500, 'float'],
    duplicate_window_minutes: [1, 1440, 'int'],
    arrival_match_radius_m: [5, 500, 'float'],
  }
  Object.entries(numbers).forEach(([key, [min, max, kind]]) => {
    if (values[key] === undefined || values[key] === '') return
    const raw = Number(values[key])
    if (!Number.isFinite(raw) || raw < min || raw > max) {
      errors[key] = `Enter a number from ${min} to ${max}`
    } else {
      next[key] = kind === 'int' ? Math.round(raw) : Math.round(raw * 10) / 10
    }
  })

  if (Object.keys(errors).length) throw new ValidationError(errors)

  const old = await getSystemSettings()
  const changed = {}
  Object.entries(next).forEach(([key, value]) => {
    if (String(old[key]) !== String(value)) changed[key] = { from: old[key], to: value }
  })
  if (!Object.keys(changed).length) return { changed: {} }

  // Only the keys that were actually given are written: Firestore refuses
  // an undefined value.
  const system = {}
  if (next.system_name !== undefined) system.system_name = next.system_name
  if (next.max_photos_per_report !== undefined) {
    system.max_photos_per_report = next.max_photos_per_report
  }
  const rest = { ...next }
  delete rest.system_name
  delete rest.max_photos_per_report

  await setDoc(docRef(COLLECTIONS.settings, 'system'), { ...system, updated_at: serverTimestamp() }, {
    merge: true,
  })
  await Promise.all(
    Object.entries(rest).map(([key, value]) =>
      setDoc(
        docRef(COLLECTIONS.settings, key),
        { value, updated_at: serverTimestamp() },
        { merge: true },
      ),
    ),
  )
  await logAudit({
    actor,
    action: 'settings.update',
    entity: 'settings',
    entityId: 'system',
    details: { changed },
  })
  return { changed }
}

/* ---------- Accident categories ---------- */

/**
 * Every category, "Other" last, then by name.
 * api/accident-types/list.php sorted it that way.
 */
export async function listAccidentTypes() {
  const rows = await fetchCollection(COLLECTIONS.accidentTypes, { order: 'name' })
  return rows.sort(
    (a, b) =>
      Number(a.name === 'Other') - Number(b.name === 'Other') ||
      String(a.name || '').localeCompare(String(b.name || '')),
  )
}

/**
 * How many reports use each category.
 * One query for every category, like api/accident-types/list.php did.
 */
export async function accidentTypeUsage() {
  const types = await listAccidentTypes()
  const ids = types.map((t) => t.id)
  const usage = {}
  ids.forEach((id) => {
    usage[id] = 0
  })
  if (!ids.length) return usage
  const snap = await getDocs(query(ref(COLLECTIONS.reports), where('accident_type_id', 'in', ids)))
  snap.docs.forEach((d) => {
    const typeId = d.data().accident_type_id
    if (typeId in usage) usage[typeId] += 1
  })
  return usage
}

/**
 * Add or change a category.
 * A category is never deleted — reports already use it — so it is hidden from
 * the report form instead.
 */
export async function saveAccidentType(id, data, actor) {
  const name = String(data.name || '').trim()
  if (name.length < 3 || name.length > 60) {
    throw new ValidationError({ name: 'Enter a name (3 to 60 characters)' })
  }
  const all = await listAccidentTypes()
  const old = id ? all.find((t) => t.id === id) : null
  if (id && !old) throw new Error('Category not found')
  const clash = all.find((t) => t.id !== id && String(t.name).toLowerCase() === name.toLowerCase())
  if (clash) {
    throw new ValidationError({ name: 'A category with this name already exists' })
  }

  const description = String(data.description || '').trim().slice(0, 255) || null
  // Editing a category keeps it visible unless the caller says otherwise.
  const active = data.active === undefined ? old?.active !== false : Boolean(data.active)

  if (id) {
    await patchDoc(COLLECTIONS.accidentTypes, id, {
      name,
      description,
      active,
      updated_at: serverTimestamp(),
    })
  } else {
    await createDoc(COLLECTIONS.accidentTypes, { name, description, active })
  }
  await logAudit({
    actor,
    action: id ? 'type.update' : 'type.create',
    entity: 'accident_type',
    entityId: id,
    details: { name, active, new: !id },
  })
  return id
}

export async function toggleAccidentType(id, active, actor) {
  await patchDoc(COLLECTIONS.accidentTypes, id, { active, updated_at: serverTimestamp() })
  await logAudit({ actor, action: 'type.toggle', entity: 'accident_type', entityId: id, details: String(active) })
}

/* ---------- Emergency contacts ---------- */

export async function listEmergencyContacts() {
  return fetchCollection(COLLECTIONS.emergencyContacts, { order: 'sort_order' })
}

/** Add or change an emergency contact. */
export async function saveEmergencyContact(id, data, actor) {
  const name = String(data.name || '').trim()
  const phone = String(data.phone || '').trim()
  const errors = {}
  if (name.length < 2) errors.name = 'Enter the name'
  if (!/^[0-9+()\- ]{3,20}$/.test(phone)) {
    errors.phone = 'Enter a phone number (digits, +, -, spaces)'
  }
  if (Object.keys(errors).length) throw new ValidationError(errors)

  const contact = {
    name: name.slice(0, 100),
    phone,
    category: String(data.category || '').trim().slice(0, 40) || null,
    sort_order: Number(data.sort_order || 0),
    is_active: data.is_active === undefined ? true : Boolean(data.is_active),
  }

  if (id) {
    await patchDoc(COLLECTIONS.emergencyContacts, id, contact)
  } else {
    await createDoc(COLLECTIONS.emergencyContacts, contact)
  }
  await logAudit({
    actor,
    action: id ? 'contact.update' : 'contact.create',
    entity: 'emergency_contact',
    entityId: id,
    details: { name: contact.name, new: !id },
  })
  return id
}

export async function deleteEmergencyContact(id, actor) {
  await removeDoc(COLLECTIONS.emergencyContacts, id)
  await logAudit({ actor, action: 'contact.delete', entity: 'emergency_contact', entityId: id })
}
