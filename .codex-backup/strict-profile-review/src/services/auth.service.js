/**
 * Authentication service (Firebase Auth, email + password).
 *
 * This replaces the PHP token system (api/core/auth.php). Passwords are hashed
 * by Firebase, never by us, and the ID token is refreshed by the SDK.
 *
 * Roles live on the `users/{uid}` Firestore document. Officers and reporters
 * use the mobile app; only `admin` may use this web portal (STAFF_ROLES).
 */
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth'
import { auth } from '../lib/firebase.js'
import { docRef, getDoc, setDoc, serverTimestamp } from '../lib/firestore.js'
import { COLLECTIONS, STAFF_ROLES } from '../lib/constants.js'

/** Sign in with email + password; resolves the Firebase user. */
export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
  return cred.user
}

export const signOut = () => fbSignOut(auth)

export const watchAuth = (callback) => onAuthStateChanged(auth, callback)

export const sendReset = (email) => sendPasswordResetEmail(auth, email.trim())

/** Load the `users/{uid}` profile document (role, name, phone...). */
export async function loadProfile(uid) {
  const snap = await getDoc(docRef(COLLECTIONS.users, uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/** True when the profile holds a role allowed into this web portal. */
export const canUsePortal = (profile) => Boolean(profile && STAFF_ROLES.includes(profile.role))

/**
 * Make sure a `users/{uid}` doc exists for the signed-in account.
 * The first admin is created in the Firebase console; this only backfills the
 * profile document so the rest of the app has a role to read.
 */
export async function ensureProfile(user) {
  // Profiles come from an admin (Users screen), `npm run create-user`,
  // or the user's own mobile registration. Never create one here.
  return await loadProfile(user.uid)   // null when there is no profile
}

/** Change the signed-in user's password (requires a recent login). */
export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, newPassword)
}
