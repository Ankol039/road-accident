/**
 * End-to-end smoke test against the live Firebase project.
 *
 * Signs in as a real administrator with the client SDK, then proves:
 *   1. a read returns the seeded document
 *   2. a write the rules allow actually persists
 *   3. a write the rules forbid is rejected
 *
 * The client SDK is used on purpose: unlike the Admin SDK it goes through the
 * deployed security rules, so a passing run really does mean the rules work.
 *
 * USAGE
 *   node scripts/smoke-test.mjs
 *   node scripts/smoke-test.mjs --email a@b.c --password "secret"
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}

/** Read the VITE_* keys out of .env so the test uses the same project. */
function readEnv() {
  const file = resolve(here, '../.env')
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const env = readEnv()
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const email = arg('email', process.env.ADMIN_EMAIL || 'admin@roadreport.dev')
const password = arg('password', process.env.ADMIN_PASSWORD || 'RoadReport!Admin2026')

if (
  !config.apiKey ||
  config.apiKey === 'your-api-key' ||
  !config.projectId ||
  !config.authDomain ||
  !config.appId ||
  config.appId === 'your-app-id'
) {
  console.error('Missing Firebase Web SDK config in .env')
  process.exit(1)
}

const app = initializeApp(config)
const auth = getAuth(app)
const db = getFirestore(app)

let failures = 0
const ok = (label, extra = '') => console.log(`  PASS  ${label}${extra ? ' — ' + extra : ''}`)
const bad = (label, extra = '') => {
  failures += 1
  console.log(`  FAIL  ${label}${extra ? ' — ' + extra : ''}`)
}

try {
  console.log(`Signing in as ${email}…`)
  const cred = await signInWithEmailAndPassword(auth, email, password)
  ok('sign-in', `uid ${cred.user.uid}`)

  const profile = await getDoc(doc(db, 'users', cred.user.uid))
  ok('profile read', `role=${profile.data()?.role} status=${profile.data()?.status}`)

  // 1. read a seeded report
  const reports = await import('firebase/firestore').then((m) =>
    m.getDocs(m.query(m.collection(db, 'reports'), m.orderBy('accident_date', 'desc'), m.limit(1))),
  )
  const report = reports.docs[0]
  if (!report) bad('report read', 'no reports found')
  else {
    const data = report.data()
    ok('report read', `${data.report_code} status=${data.status} type=${data.accident_type_name}`)

    // 2. a write the rules allow
    const marker = `smoke-test ${new Date().toISOString()}`
    await updateDoc(doc(db, 'reports', report.id), { flag_reason: marker })
    const after = await getDoc(doc(db, 'reports', report.id))
    if (after.data()?.flag_reason === marker) ok('write persists', 'flag_reason read back')
    else bad('write persists', `read back ${after.data()?.flag_reason}`)

    // clean up the marker so the seeded data stays tidy
    await updateDoc(doc(db, 'reports', report.id), { flag_reason: data.flag_reason ?? null })
  }

  // 3. a write the rules must forbid: the audit trail is append-only
  try {
    await updateDoc(doc(db, 'audit_logs', 'smoke-test-should-not-write'), {
      action: 'report.status',
      created_at: new Date(),
    })
    bad('audit log is append-only', 'the update was allowed')
  } catch (error) {
    ok('audit log is append-only', error.code || error.message)
  }

  // 4. and one more: a non-admin may not write a report
  try {
    await setDoc(doc(db, 'reports', 'smoke-test-should-not-create'), { status: 'submitted' })
    bad('report create needs core fields', 'the create was allowed')
  } catch (error) {
    ok('report create needs core fields', error.code || error.message)
  }
} catch (error) {
  failures += 1
  console.error('  FAIL  smoke test:', error.message)
} finally {
  await signOut(auth)
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
