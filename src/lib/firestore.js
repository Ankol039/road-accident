/**
 * Thin wrappers over the Firestore SDK.
 *
 * Every service goes through these so we have one place for query guards and
 * error handling, instead of the raw SDK calls being scattered everywhere.
 */
import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
  increment,
  runTransaction,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { COLLECTIONS } from './constants.js'

/** Reference to a top-level collection. */
export const ref = (name) => collection(db, name)

/** Reference to one document in a top-level collection. */
export const docRef = (name, id) => doc(db, name, id)

export {
  collection,
  collectionGroup,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
  increment,
  runTransaction,
}

/**
 * Fetch a whole collection ordered by a field, with an optional cap.
 * Kept for small collections only (categories, contacts, settings).
 */
export async function fetchCollection(name, { order, direction = 'asc', max } = {}) {
  const parts = []
  if (order) parts.push(orderBy(order, direction))
  if (max) parts.push(limit(max))
  const snap = await getDocs(parts.length ? query(ref(name), ...parts) : ref(name))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Fetch a single document, or null when it does not exist. */
export async function fetchDoc(name, id) {
  const snap = await getDoc(docRef(name, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/** Write a document, merging with whatever is already there. */
export const saveDoc = (name, id, data) =>
  setDoc(docRef(name, id), { ...data, updated_at: serverTimestamp() }, { merge: true })

/** Create a document with a generated ID; returns the new ID. */
export async function createDoc(name, data) {
  const created = await addDoc(ref(name), {
    ...data,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  })
  return created.id
}

export const patchDoc = (name, id, data) => updateDoc(docRef(name, id), data)
export const removeDoc = (name, id) => deleteDoc(docRef(name, id))

/**
 * Read one document from the `settings` collection with a fallback value.
 * The PHP app stored these as single-row config documents.
 */
export async function readSetting(key, fallback = null) {
  try {
    const snap = await getDoc(docRef(COLLECTIONS.settings, key))
    if (!snap.exists()) return fallback
    const data = snap.data()
    return data?.value ?? data ?? fallback
  } catch {
    return fallback
  }
}

export async function writeSetting(key, value) {
  return setDoc(
    docRef(COLLECTIONS.settings, key),
    { value, updated_at: serverTimestamp() },
    { merge: true },
  )
}
