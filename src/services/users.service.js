/**
 * Users service (the `users` collection).
 * Ported from api/core/auth.php + api/users/*.php.
 *
 * A user has two halves:
 *   * the Firebase Auth account, which holds the password and the sign-in
 *     email — the browser can only open a new one through the Identity
 *     Toolkit REST API, never through the client SDK (that would sign the
 *     administrator out)
 *   * the Firestore profile document `users/{uid}`, which holds the role, the
 *     badge number and the status the workflow reads
 *
 * The two are created together by createStaffUser(). Changing the sign-in
 * email of somebody else needs the Admin SDK, so the email is fixed once the
 * account exists; a password reset email can still be sent from here.
 */
import {
  ref,
  getDocs,
  query,
  where,
  limit,
  docRef,
  setDoc,
  patchDoc,
  fetchDoc,
  serverTimestamp,
} from '../lib/firestore.js'
import { COLLECTIONS, USER_ROLES, ADMIN_CREATABLE_ROLES, OFFICER_ACTIVE_STATUSES } from '../lib/constants.js'
import { apiKey } from '../lib/firebase.js'
import { logAudit } from './audit.service.js'
import { ValidationError } from '../lib/errors.js'

/** The order the PHP API sorted the table in: administrators, officers, reporters. */
const ROLE_ORDER = { admin: 0, officer: 1, reporter: 2 }

export const ROLE_LABELS = {
  admin: 'Administrator',
  officer: 'Traffic officer',
  reporter: 'Public user',
}

/**
 * All users, optionally narrowed to a role or a status.
 *
 * The order is set in JavaScript (sortUsers), not by an orderBy(), so the
 * query stays on the single-field indexes and the screen works whether or not
 * the composite indexes have been deployed. The staff directory is small, so
 * one page of it is all the browser ever needs.
 */
export async function listUsers({ role, status, search } = {}) {
  const parts = []
  if (role) parts.push(where('role', '==', role))
  if (status) parts.push(where('status', '==', status))
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
  return sortUsers(rows)
}

/** Role first (administrator, officer, reporter), then the name. */
export function sortUsers(rows) {
  return [...rows].sort(
    (a, b) =>
      (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
      String(a.full_name || '').localeCompare(String(b.full_name || '')),
  )
}

export const getUser = async (uid) => fetchDoc(COLLECTIONS.users, uid)

/** Find a user by their sign-in email. */
export async function findUserByEmail(email) {
  const needle = String(email || '').trim().toLowerCase()
  if (!needle) return null
  const snap = await getDocs(
    query(ref(COLLECTIONS.users), where('email', '==', needle), limit(1)),
  )
  return snap.docs.length ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null
}

/**
 * How many reports each officer is still working on.
 * One query for every officer, like api/users/list.php did.
 */
export async function openCasesByOfficer() {
  const snap = await getDocs(
    query(ref(COLLECTIONS.reports), where('status', 'in', OFFICER_ACTIVE_STATUSES)),
  )
  const counts = {}
  snap.docs.forEach((d) => {
    const officerId = d.data().officer_id
    if (!officerId) return
    counts[officerId] = (counts[officerId] || 0) + 1
  })
  return counts
}

/**
 * The field rules from api/core/auth.php validate_user_fields().
 * Returns {} when everything is fine.
 */
export async function validateUserFields(fields, { needPassword = false, currentUid = null } = {}) {
  const errors = {}

  if (fields.full_name !== undefined) {
    if (!fields.full_name || fields.full_name.trim().length < 2) {
      errors.full_name = 'Enter the full name'
    }
  }

  if (fields.email !== undefined) {
    const email = String(fields.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email'
    } else {
      const other = await findUserByEmail(email)
      if (other && other.id !== currentUid) {
        errors.email = 'This email is already registered'
      }
    }
  }

  if (fields.phone) {
    // 0917 555 0142 and +63 917 555 0142 are the same number, so the spacing
    // is dropped before the check.
    const digits = String(fields.phone).replace(/[\s-]/g, '')
    if (!/^(09\d{9}|\+639\d{9})$/.test(digits)) {
      errors.phone = 'Use 09XXXXXXXXX or +639XXXXXXXXX'
    }
  }

  const password = fields.password
  if (needPassword || (password !== undefined && password !== null && password !== '')) {
    const pass = String(password || '')
    if (pass.length < 8 || !/[A-Za-z]/.test(pass) || !/\d/.test(pass)) {
      errors.password = 'At least 8 characters with letters and numbers'
    }
  }

  if (fields.role !== undefined && !USER_ROLES.includes(fields.role)) {
    errors.role = 'Choose Administrator or Traffic officer'
  }
  if (fields.status !== undefined && !['active', 'inactive'].includes(fields.status)) {
    errors.status = 'Choose active or inactive'
  }

  // Only officers carry a badge number, and they cannot do without one.
  const role = fields.role
  if (role !== undefined) {
    if (role === 'officer' && !String(fields.badge_no || '').trim()) {
      errors.badge_no = 'Officers need a badge number'
    }
  }

  return errors
}

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

/* ---------- the Auth half ---------- */

const identityToolkit = (path, body) =>
  fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/**
 * Open a sign-in account for a new user.
 *
 * The Identity Toolkit REST API is used on purpose: the client SDK's
 * createUserWithEmailAndPassword() would sign the administrator out, because
 * it signs the new account in on this browser. A plain REST call leaves the
 * session alone.
 *
 * @returns {Promise<string>} the new user's uid.
 */
export async function createAuthAccount(email, password) {
  const res = await identityToolkit('accounts:signUp', {
    email: String(email).trim().toLowerCase(),
    password,
    returnSecureToken: false,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = body?.error?.message || 'Could not create the sign-in account.'
    if (/EMAIL_EXISTS/i.test(message)) {
      throw new ValidationError({ email: 'This email is already registered' })
    }
    if (/INVALID_PASSWORD/i.test(message)) {
      throw new ValidationError({ password: 'At least 8 characters with letters and numbers' })
    }
    if (/INVALID_EMAIL/i.test(message)) {
      throw new ValidationError({ email: 'Enter a valid email' })
    }
    throw new Error(message)
  }
  return body.localId
}

/** Ask Firebase to email somebody a password reset link. */
export async function sendPasswordReset(email) {
  const res = await identityToolkit('accounts:sendOobCode', {
    requestType: 'PASSWORD_RESET',
    email: String(email).trim().toLowerCase(),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.error?.message || 'Could not send the reset email.')
  }
}

/**
 * Add a user: the sign-in account first, then the profile document.
 * api/users/save.php did the same in one commit; here the two halves live in
 * two systems, so the account is opened first and the profile follows.
 */
export async function createStaffUser(fields, actor) {
  if (!ADMIN_CREATABLE_ROLES.includes(fields.role)) {
    throw new ValidationError({ role: 'Choose Administrator or Traffic officer. Public users register themselves in the mobile app.' })
  }
  const email = String(fields.email).trim().toLowerCase()
  const errors = await validateUserFields({ ...fields, email }, { needPassword: true })
  if (Object.keys(errors).length) throw new ValidationError(errors)

  const uid = await createAuthAccount(email, fields.password)

  await setDoc(
    docRef(COLLECTIONS.users, uid),
    {
      email,
      full_name: fields.full_name.trim(),
      phone: fields.phone ? String(fields.phone).trim() : null,
      role: fields.role,
      status: fields.status || 'active',
      badge_no: fields.role === 'officer' ? fields.badge_no.trim() : null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true },
  )

  await logAudit({
    actor,
    action: 'user.create',
    entity: 'user',
    entityId: uid,
    details: { email, role: fields.role },
  })
  return uid
}

/**
 * Change a user's profile. Only the fields that really changed are written,
 * and the audit trail records what changed.
 */
export async function updateStaffUser(uid, fields, actor, current) {
  const errors = await validateUserFields(fields, { currentUid: uid })
  if (fields.role === 'reporter' && current?.role !== 'reporter') {
    errors.role = 'Staff accounts cannot be changed into public users'
  }

  // An administrator cannot demote or deactivate their own account.
  // api/users/save.php refused both, and the dialog disables the two fields.
  if (actor?.uid && actor.uid === uid) {
    if (fields.role !== undefined && fields.role !== 'admin') {
      errors.role = 'You cannot remove your own admin role'
    }
    if (fields.status !== undefined && fields.status !== 'active') {
      errors.status = 'You cannot deactivate your own account'
    }
  }

  if (Object.keys(errors).length) throw new ValidationError(errors)

  const next = {}
  if (fields.full_name !== undefined) next.full_name = String(fields.full_name).trim()
  if (fields.phone !== undefined) next.phone = fields.phone ? String(fields.phone).trim() : null
  if (fields.role !== undefined) next.role = fields.role
  if (fields.status !== undefined) next.status = fields.status
  // Only officers carry a badge number.
  if (fields.role !== undefined && fields.role !== 'officer') next.badge_no = null
  else if (fields.badge_no !== undefined) next.badge_no = fields.badge_no ? String(fields.badge_no).trim() : null
  next.updated_at = serverTimestamp()

  const changed = Object.keys(next).filter((key) => {
    if (key === 'updated_at') return false
    return String(current?.[key] ?? '') !== String(next[key] ?? '')
  })
  if (!changed.length) return { changed: [] }

  await patchDoc(COLLECTIONS.users, uid, next)

  const logged = {}
  changed.forEach((key) => {
    logged[key] = next[key]
  })
  await logAudit({
    actor,
    action: 'user.update',
    entity: 'user',
    entityId: uid,
    details: { changed: logged },
  })
  return { changed }
}
