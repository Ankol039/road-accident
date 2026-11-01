/**
 * Creates the first administrator account (Auth user + users/{uid} profile).
 *
 * WHY THIS IS A NODE SCRIPT AND NOT A BUTTON IN THE APP
 * ----------------------------------------------------
 * Creating a Firebase Auth user with an email + password requires the Admin
 * SDK, which needs a service-account key. That key must never reach the
 * browser. On the free Spark plan we cannot use Cloud Functions, so account
 * creation runs from this trusted machine instead. Day-to-day user management
 * in the web app only edits the profile (role, phone, status).
 *
 * USAGE
 *   node scripts/create-user.mjs admin@example.com "A long password" "Full Name" admin
 *
 * Requires the service-account JSON. It is read from (first match wins):
 *   $GOOGLE_APPLICATION_CREDENTIALS
 *   ../private/firebase-service-account.json   (repo parent, the usual spot)
 *   ./firebase-service-account.json
 */
import { readServiceAccount } from './service-account.mjs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

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

const [email, password, fullName, role = 'admin'] = process.argv.slice(2)
if (!email || !password) {
  console.error('Usage: node scripts/create-user.mjs <email> <password> [full name] [role]')
  process.exit(1)
}

const serviceAccount = readServiceAccount(keyPath)
initializeApp({ credential: cert(serviceAccount) })

const auth = getAuth()
const db = getFirestore()

try {
  const user = await auth.createUser({
    email,
    password,
    displayName: fullName || email.split('@')[0],
    emailVerified: false,
  })

  await auth.setCustomUserClaims(user.uid, { role })

  await db.doc(`users/${user.uid}`).set({
    email,
    full_name: fullName || email.split('@')[0],
    role,
    status: 'active',
    created_at: FieldValue.serverTimestamp(),
  }, { merge: true })

  console.log(`Created ${role} account: ${email} (uid ${user.uid})`)
  process.exit(0)
} catch (error) {
  console.error('Failed:', error.message)
  process.exit(1)
}
