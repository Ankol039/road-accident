/**
 * Drives one real status change through the browser and proves it landed.
 *
 * The screen is exercised the way an administrator would: pick the new
 * status, type the note, press the button. Afterwards the Firestore document
 * is read back with the Admin SDK, so "it looked right in the UI" is not
 * enough to pass.
 *
 * We deliberately do NOT use --virtual-time-budget: it starves the network
 * promises Firebase needs. Puppeteer waits on real events instead.
 *
 * USAGE
 *   node scripts/check-status-change.mjs
 *   node scripts/check-status-change.mjs --report report-0003 --to under_review
 *   node scripts/check-status-change.mjs --report report-0002 --to verified --note "..."
 *
 * Options
 *   --report <id>      report document id   (default report-0003)
 *   --to <status>      status to move to    (default under_review)
 *   --note <text>      note typed into the form
 *   --arrival          use the officer arrival panel instead of the status form
 *   --email <address>  admin email  (env ADMIN_EMAIL also works)
 *   --password <pw>    admin password (env ADMIN_PASSWORD also works)
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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
const has = (name) => argv.includes(`--${name}`)

const BASE = arg('base', process.env.APP_BASE || 'http://localhost:5173')
const EMAIL = arg('email', process.env.ADMIN_EMAIL || 'admin@roadreport.dev')
const PASSWORD = arg('password', process.env.ADMIN_PASSWORD || 'RoadReport!Admin2026')
const REPORT = arg('report', 'report-0003')
const TO = arg('to', 'under_review')
const NOTE = arg('note', `Checked in the browser by the status-change check.`)
const USE_ARRIVAL = has('arrival')

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
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
const db = getFirestore()

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
page.on('requestfailed', (req) => {
  const url = req.url()
  if (url.startsWith('data:')) return
  // Firestore's streaming channel is aborted when the page closes; that is
  // not a failure of the screen.
  if (url.includes('google.firestore.v1.Firestore/Write/channel')) return
  problems.push(`requestfailed: ${url} (${req.failure()?.errorText})`)
})

const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms))
const fail = []

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#email', { timeout: 20000 })
  await page.type('#email', EMAIL)
  await page.type('#password', PASSWORD)
  await Promise.all([
    page.waitForFunction(() => location.pathname.startsWith('/admin'), { timeout: 30000 }),
    page.click('#login-form button[type=submit]'),
  ])
  console.log(`Signed in as ${EMAIL}`)

  await page.goto(`${BASE}/admin/reports/${REPORT}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('.timeline', { timeout: 20000 })
  await settle(1200)

  const before = await page.evaluate(() => ({
    status: document.querySelector('.status-badge')?.innerText.trim(),
    timeline: document.querySelectorAll('.timeline li').length,
    badges: [...document.querySelectorAll('.timeline .status-badge')].map((b) => b.innerText.trim()),
  }))
  console.log(`\nBefore: status "${before.status}", ${before.timeline} timeline entries`)
  console.log(`        ${before.badges.join(' -> ')}`)

  // ---- pick the new status and write the note, the way an admin would ----
  if (USE_ARRIVAL) {
    // The arrival panel approves with a note in #approve-note.
    await page.waitForSelector('#approve-note', { timeout: 10000 })
    await page.type('#approve-note', NOTE)
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((b) =>
        b.innerText.includes('Approve: officer may clear the site'),
      )
      if (!button) throw new Error('the approve button is not on the page')
      button.click()
    })
  } else {
    await page.waitForSelector('#next-status', { timeout: 10000 })
    await page.select('#next-status', TO)
    await page.type('#status-note', NOTE)
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find(
        (b) => b.innerText.trim() === 'Save status',
      )
      if (!button) throw new Error('the save button is not on the page')
      button.click()
    })
  }

  // The toast confirms the write; the page then reloads the report.
  await page.waitForSelector('.toast-msg', { timeout: 20000 })
  const toast = await page.$eval('.toast-msg', (el) => el.innerText.trim())
  console.log(`\nToast: ${toast}`)
  if (/error|could not|failed/i.test(toast)) fail.push(`the screen reported: ${toast}`)

  await settle(2500)

  const after = await page.evaluate(() => ({
    status: document.querySelector('.status-badge')?.innerText.trim(),
    timeline: document.querySelectorAll('.timeline li').length,
    badges: [...document.querySelectorAll('.timeline .status-badge')].map((b) => b.innerText.trim()),
    notes: [...document.querySelectorAll('.timeline li p')].map((p) => p.innerText.trim()),
    panelErrors: [...document.querySelectorAll('.alert-danger')].map((a) => a.innerText.trim()),
  }))
  console.log(`\nAfter:  status "${after.status}", ${after.timeline} timeline entries`)
  console.log(`        ${after.badges.join(' -> ')}`)
  if (after.panelErrors.length) {
    console.log(`\nPanel errors:\n  ${after.panelErrors.join('\n  ')}`)
    fail.push(`the form showed an error: ${after.panelErrors.join(' / ')}`)
  }
  if (after.timeline <= before.timeline) {
    fail.push(`the timeline did not grow (${before.timeline} -> ${after.timeline})`)
  }

  // ---- read the document back ----
  const snap = await db.collection('reports').doc(REPORT).get()
  if (!snap.exists) {
    fail.push(`reports/${REPORT} does not exist`)
  } else {
    const data = snap.data()
    const history = data.status_history || []
    const last = history[history.length - 1] || {}
    console.log(`\nFirestore reports/${REPORT}:`)
    console.log(`  status          : ${data.status}`)
    console.log(`  status_history  : ${history.length} entries`)
    console.log(`  last entry      : ${JSON.stringify(last)}`)
    console.log(`  verified_by     : ${data.verified_by_name || '—'}`)
    console.log(`  updated_at      : ${data.updated_at?.toDate?.().toISOString?.() || '—'}`)

    if (data.status !== TO) fail.push(`Firestore status is "${data.status}", expected "${TO}"`)
    if (history.length !== before.timeline + 1) {
      fail.push(`Firestore has ${history.length} history entries, expected ${before.timeline + 1}`)
    }
    if (last.status !== TO) fail.push(`the last history entry is "${last.status}", expected "${TO}"`)
    if (!String(last.note || '').includes(NOTE.slice(0, 20))) {
      fail.push(`the history note does not carry the typed note: "${last.note}"`)
    }
  }

  // ---- the audit trail must have the entry too ----
  // Only the equality filter is used, so this needs no composite index.
  const audit = await db
    .collection('audit_logs')
    .where('entity_id', '==', REPORT)
    .get()
  const entries = audit.docs
    .map((d) => d.data())
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  console.log(`\nAudit entries for ${REPORT}: ${entries.length}`)
  for (const data of entries.slice(0, 3)) {
    console.log(`  ${data.action} :: ${data.details || '—'}`)
  }
  if (!entries.length) fail.push('no audit entry was written for this report')

  if (problems.length) {
    console.log('\n--- console problems ---')
    for (const p of [...new Set(problems)]) console.log('  ' + p)
  }

  if (fail.length) {
    console.log('\nSTATUS CHANGE CHECK FAILED')
    for (const f of fail) console.log('  - ' + f)
    await browser.close()
    process.exit(1)
  }

  console.log('\nSTATUS CHANGE CHECK PASSED')
  await browser.close()
  process.exit(0)
} catch (error) {
  console.error('\nCHECK FAILED:', error.message)
  if (problems.length) {
    console.error('--- problems ---')
    for (const p of [...new Set(problems)]) console.error('  ' + p)
  }
  try {
    await page.screenshot({ path: 'check-status-change-failure.png', fullPage: true })
    console.error('screenshot -> check-status-change-failure.png')
  } catch {
    /* ignore */
  }
  await browser.close()
  process.exit(1)
}
