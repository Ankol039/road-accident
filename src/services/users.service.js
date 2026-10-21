/**
 * Users service (the `users` collection).
 * Ported from api/core/auth.php + api/users/*.php.
 */
import {
  ref,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  docRef,
  setDoc,
  patchDoc,
  fetchDoc,
  serverTimestamp,
} from '../lib/firestore.js'
import { COLLECTIONS } from '../lib/constants.js'

/** All users, most recent first. Small enough for the admin screen. */
export async function listUsers({ role, status, search } = {}) {
  const parts = []
  if (role) parts.push(where('role', '==', role))
  if (status) parts.push(where('status', '==', status))
  parts.push(orderBy('created_at', 'desc'))
  parts.push(limit(500))

  const snap = await getDocs(query(ref(COLLECTIONS.users), ...parts))
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (search) {
    const needle = search.toLowerCase()
    rows = rows.filter((u) =>
      [u.full_name, u.email, u.phone, u.badge_no]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    )
  }
  return rows
}

export const getUser = async (uid) => fetchDoc(COLLECTIONS.users, uid)

/**
 * Create the Firestore profile half of a user.
 *
 * NOTE: the login half is created by the `createStaffAccount` utility, which
 * needs the Firebase Admin SDK. On the Spark plan that runs from a trusted
 * machine, not the browser — see scripts/create-user.mjs in HANDOFF.md.
 */
export async function createUserProfile(uid, data) {
  await setDoc(
    docRef(COLLECTIONS.users, uid),
    { ...data, created_at: serverTimestamp(), updated_at: serverTimestamp() },
    { merge: true },
  )
  return uid
}

/** Update a user's profile fields (role, status, name, phone, badge). */
export const updateUser = (uid, data) => patchDoc(COLLECTIONS.users, uid, data)
