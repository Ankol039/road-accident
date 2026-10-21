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
  const { system_name, max_photos_per_report, ...numeric } = values
  await setDoc(
    docRef(COLLECTIONS.settings, 'system'),
    { system_name, max_photos_per_report, updated_at: serverTimestamp() },
    { merge: true },
  )
  await Promise.all(
    Object.entries(numeric).map(([key, value]) =>
      setDoc(
        docRef(COLLECTIONS.settings, key),
        { value: Number(value), updated_at: serverTimestamp() },
        { merge: true },
      ),
    ),
  )
  await logAudit({ actor, action: 'settings.update', entity: 'settings', entityId: 'system' })
}

/* ---------- Accident categories ---------- */

export async function listAccidentTypes() {
  return fetchCollection(COLLECTIONS.accidentTypes, { order: 'name' })
}

export async function saveAccidentType(id, data, actor) {
  if (id) {
    await patchDoc(COLLECTIONS.accidentTypes, id, { ...data, updated_at: serverTimestamp() })
  } else {
    await createDoc(COLLECTIONS.accidentTypes, { ...data, active: true })
  }
  await logAudit({ actor, action: id ? 'type.update' : 'type.create', entity: 'accident_type', entityId: id })
}

export async function toggleAccidentType(id, active, actor) {
  await patchDoc(COLLECTIONS.accidentTypes, id, { active, updated_at: serverTimestamp() })
  await logAudit({ actor, action: 'type.toggle', entity: 'accident_type', entityId: id, details: String(active) })
}

/* ---------- Emergency contacts ---------- */

export async function listEmergencyContacts() {
  return fetchCollection(COLLECTIONS.emergencyContacts, { order: 'sort_order' })
}

export async function saveEmergencyContact(id, data, actor) {
  if (id) {
    await patchDoc(COLLECTIONS.emergencyContacts, id, { ...data, updated_at: serverTimestamp() })
  } else {
    await createDoc(COLLECTIONS.emergencyContacts, data)
  }
  await logAudit({ actor, action: id ? 'contact.update' : 'contact.create', entity: 'emergency_contact', entityId: id })
}

export async function deleteEmergencyContact(id, actor) {
  await removeDoc(COLLECTIONS.emergencyContacts, id)
  await logAudit({ actor, action: 'contact.delete', entity: 'emergency_contact', entityId: id })
}
