/**
 * Drives the Users screen through a real add and a real edit, then proves the
 * result in Firestore and in Firebase Auth.
 *
 * The account it opens is deleted again at the end, so the check can be run
 * as often as you like.
 *
 * We deliberately do NOT use --virtual-time-budget: it starves the network
 * promises Firebase needs. Puppeteer waits on real events instead.
 *
 * USAGE
 *   node scripts/check-user-management.mjs
 *   node scripts/check-user-management.mjs --email someone@roadreport.dev
 *
 * Options
 *   --email <address>  the address to open the test account with
 *   --password <pw>    the password to give it
 */
import { readServiceAccount } from './service-account.mjs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const argv = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}

const BASE = arg('base', process.env.APP_BASE || 'http://localhost:5173')
const ADMIN_EMAIL = arg('admin', process.env.ADMIN_EMAIL || 'admin@roadreport.dev')
const ADMIN_PASSWORD = arg('admin-password', process.env.ADMIN_PASSWORD || 'RoadReport!Admin2026')
const TEST_EMAIL = arg('email', `probe.${Date.now().toString(36)}@roadreport.dev`)
const TEST_PASSWORD = arg('password', 'Probe!Pass2026')

const here = dirname(fileURLToPath(import.meta.url))
const keyCandidates = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  resolve(here, '../../private/firebase-service-account.json'),
  resolve(here, '../firebase-service-account.json'),
].filter(Boolean)
const keyPath = keyCandidates.find((p) => existsSync(p))
if (!keyPath) {
  console.error('Could not find a service-account key. Looked in:\n  ' + keyCandidates.join('\n  '))
  process.exit(1)
}
initializeApp({ credential: cert(readServiceAccount(keyPath)) })
const db = getFirestore()
const adminAuth = getAuth()

const executablePath = CHROME_PATHS.find((p) => existsSync(p))
if (!executablePath) {
  console.error('No Chrome/Chromium found. Checked:\n  ' + CHROME_PATHS.join('\n  '))
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1200 })

const problems = []
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
})
page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))

const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms))
const fail = []
let testUid = null

const text = (selector) => page.$eval(selector, (el) => el.innerText.trim())
const clickByText = async (label, tag = 'button') =>
  page.evaluate(
    (l, t) => {
      const el = [...document.querySelectorAll(t)].find((b) => b.innerText.trim() === l)
      if (!el) throw new Error(`no ${t} says "${l}"`)
      el.click()
    },
    label,
    tag,
  )

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#email', { timeout: 20000 })
  await page.type('#email', ADMIN_EMAIL)
  await page.type('#password', ADMIN_PASSWORD)
  await Promise.all([
    page.waitForFunction(() => location.pathname.startsWith('/admin'), { timeout: 30000 }),
    page.click('#login-form button[type=submit]'),
  ])
  console.log(`Signed in as ${ADMIN_EMAIL}`)

  await page.goto(`${BASE}/admin/users`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('.table tbody tr', { timeout: 20000 })
  await settle(800)

  /* ---------- add ---------- */
  console.log(`\nAdding an officer: ${TEST_EMAIL}`)
  await clickByText('Add a user')
  await page.waitForSelector('#u-name', { timeout: 10000 })
  await settle(400)

  // The badge field only shows for officers, the way the PHP screen did.
  const badgeVisibleForOfficer = await page.$eval('#u-badge', (el) => Boolean(el.offsetParent))
  if (!badgeVisibleForOfficer) fail.push('the badge field is missing for a new officer')

  await page.type('#u-name', 'Probe Officer')
  await page.type('#u-email', TEST_EMAIL)
  await page.type('#u-phone', '0917 555 9999')
  await page.type('#u-badge', 'TPB-9999')
  await page.type('#u-pass', TEST_PASSWORD)
  await clickByText('Save')
  await page.waitForSelector('.toast-msg', { timeout: 20000 })
  const toast = await text('.toast-msg')
  console.log(`Toast: ${toast}`)
  if (/error|could not|failed/i.test(toast)) fail.push(`the screen reported: ${toast}`)

  await settle(2000)

  // ---- the sign-in account really exists ----
  let authUser = null
  try {
    authUser = await adminAuth.getUserByEmail(TEST_EMAIL)
  } catch (error) {
    fail.push(`no Firebase Auth account for ${TEST_EMAIL}: ${error.message}`)
  }
  if (authUser) {
    testUid = authUser.uid
    console.log(`Auth account: ${authUser.email} (${authUser.uid})`)
  }

  // ---- the profile document really exists ----
  let profile = null
  if (testUid) {
    const snap = await db.collection('users').doc(testUid).get()
    if (!snap.exists) fail.push(`users/${testUid} was not written`)
    else {
      profile = snap.data()
      console.log('\nFirestore users/{uid}:')
      console.log(`  full_name : ${profile.full_name}`)
      console.log(`  email     : ${profile.email}`)
      console.log(`  phone     : ${profile.phone}`)
      console.log(`  role      : ${profile.role}`)
      console.log(`  status    : ${profile.status}`)
      console.log(`  badge_no  : ${profile.badge_no}`)
      if (profile.full_name !== 'Probe Officer') fail.push('the full name was not saved')
      if (profile.role !== 'officer') fail.push(`the role is "${profile.role}", expected "officer"`)
      if (profile.badge_no !== 'TPB-9999') fail.push(`the badge is "${profile.badge_no}"`)
      if (profile.status !== 'active') fail.push(`the status is "${profile.status}"`)
    }
  }

  // ---- the new officer is in the table ----
  const inTable = await page.evaluate(
    (mail) => document.querySelector('.table tbody').innerText.includes(mail),
    TEST_EMAIL,
  )
  if (!inTable) fail.push('the new officer is not in the table')

  // ---- the audit trail has the entry ----
  const audit = await db
    .collection('audit_logs')
    .where('entity_id', '==', testUid)
    .get()
  if (audit.empty) fail.push('no audit entry was written for the new user')
  else console.log(`Audit: ${audit.docs[0].data().action}`)

  /* ---------- edit ---------- */
  console.log('\nEditing the officer…')
  await page.evaluate((mail) => {
    const row = [...document.querySelectorAll('.table tbody tr')].find((tr) =>
      tr.innerText.includes(mail),
    )
    const button = [...row.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Edit')
    button.click()
  }, TEST_EMAIL)
  await page.waitForSelector('#u-name', { timeout: 10000 })
  await settle(500)

  const emailReadOnly = await page.$eval('#u-email', (el) => el.readOnly)
  if (!emailReadOnly) fail.push('the sign-in email is editable on an existing user')

  await page.evaluate(() => {
    document.querySelector('#u-name').value = ''
  })
  await page.click('#u-name', { clickCount: 3 })
  await page.type('#u-name', 'Probe Officer Renamed')
  await page.select('#u-status', 'inactive')
  await clickByText('Save')
  await page.waitForSelector('.toast-msg', { timeout: 20000 })
  console.log(`Toast: ${await text('.toast-msg')}`)
  await settle(1800)

  if (testUid) {
    const snap = await db.collection('users').doc(testUid).get()
    const after = snap.data()
    console.log('\nAfter the edit:')
    console.log(`  full_name : ${after.full_name}`)
    console.log(`  status    : ${after.status}`)
    if (after.full_name !== 'Probe Officer Renamed') fail.push('the new name was not saved')
    if (after.status !== 'inactive') fail.push(`the status is "${after.status}"`)

    const audit2 = await db
      .collection('audit_logs')
      .where('entity_id', '==', testUid)
      .get()
    const actions = audit2.docs.map((d) => d.data().action)
    console.log(`Audit entries: ${actions.join(', ')}`)
    if (!actions.includes('user.update')) fail.push('no user.update audit entry was written')
  }

  /* ---------- self protection ---------- */
  console.log('\nChecking that an admin cannot demote themselves…')
  await page.evaluate((mail) => {
    const row = [...document.querySelectorAll('.table tbody tr')].find((tr) =>
      tr.innerText.includes(mail),
    )
    const button = [...row.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Edit')
    button.click()
  }, ADMIN_EMAIL)
  await page.waitForSelector('#u-role', { timeout: 10000 })
  await settle(500)

  const roleDisabled = await page.$eval('#u-role', (el) => el.disabled)
  if (!roleDisabled) fail.push('the role can be changed on your own account')

  // Force the field open, the way a tampered request would, and try to save.
  await page.evaluate(() => {
    const select = document.querySelector('#u-role')
    select.disabled = false
    select.value = 'officer'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await settle(300)
  await clickByText('Save')
  await settle(1200)
  const selfErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.invalid-feedback.d-block')].map((e) => e.innerText.trim()),
  )
  console.log(`Field errors: ${JSON.stringify(selfErrors)}`)
  if (!selfErrors.includes('You cannot remove your own admin role')) {
    fail.push('the screen did not refuse to demote the signed-in administrator')
  }
  await clickByText('Cancel').catch(() => {})

  /* ---------- validation ---------- */
  console.log('\nChecking the field rules…')
  await clickByText('Add a user')
  await page.waitForSelector('#u-name', { timeout: 10000 })
  await settle(400)
  await page.type('#u-name', 'P')
  await page.type('#u-email', 'not-an-email')
  await page.type('#u-phone', '123')
  await page.type('#u-pass', 'short')
  await clickByText('Save')
  await settle(1200)
  const fieldErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.invalid-feedback.d-block')].map((e) => e.innerText.trim()),
  )
  console.log(`Field errors: ${JSON.stringify(fieldErrors)}`)
  const expected = [
    'Enter the full name',
    'Enter a valid email',
    'Use 09XXXXXXXXX or +639XXXXXXXXX',
    'At least 8 characters with letters and numbers',
  ]
  expected.forEach((message) => {
    if (!fieldErrors.includes(message)) fail.push(`the form did not report: ${message}`)
  })

  if (problems.length) {
    console.log('\n--- console problems ---')
    for (const p of [...new Set(problems)]) console.log('  ' + p)
  }

  if (fail.length) {
    console.log('\nUSER MANAGEMENT CHECK FAILED')
    for (const f of fail) console.log('  - ' + f)
    await browser.close()
    await cleanUp()
    process.exit(1)
  }

  console.log('\nUSER MANAGEMENT CHECK PASSED')
  await browser.close()
  await cleanUp()
  process.exit(0)
} catch (error) {
  console.error('\nCHECK FAILED:', error.message)
  if (problems.length) {
    console.error('--- problems ---')
    for (const p of [...new Set(problems)]) console.error('  ' + p)
  }
  await browser.close()
  await cleanUp()
  process.exit(1)
}

/** The check leaves no account behind. */
async function cleanUp() {
  if (!testUid) return
  try {
    /* The app wrote user.create / user.update audit entries for this probe.
       Removing the account would leave them pointing at nothing. */
    const entries = await db.collection('audit_logs').where('entity_id', '==', testUid).get()
    for (const doc of entries.docs) await doc.ref.delete()
    await adminAuth.deleteUser(testUid)
    await db.collection('users').doc(testUid).delete()
    const also = entries.size ? ` and ${entries.size} audit entries` : ''
    console.log(`Cleaned up: ${TEST_EMAIL} (${testUid})${also}`)
  } catch (error) {
    console.error(`Could not clean up ${TEST_EMAIL}: ${error.message}`)
  }
}
