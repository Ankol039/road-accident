/**
 * Drives the Audit trail screen: writes a known entry, checks that it shows
 * up, that the action filter, the date range and the search all narrow it
 * down, that the pager moves, and that the details are drawn the way the PHP
 * screen drew them. The entry is removed again at the end.
 *
 * We deliberately do NOT use --virtual-time-budget: it starves the network
 * promises Firebase needs. Puppeteer waits on real events instead.
 *
 * USAGE
 *   node scripts/check-audit.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

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
const EMAIL = arg('email', process.env.ADMIN_EMAIL || 'admin@roadreport.dev')
const PASSWORD = arg('password', process.env.ADMIN_PASSWORD || 'RoadReport!Admin2026')

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

const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms))
const fail = []

/** The rows of the table, as plain text. */
const readRows = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.table tbody tr')].map((tr) => tr.innerText.trim()),
  )

/** The "N total, page X of Y" line under the table. */
const summary = () =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find((s) =>
      /total, page \d+ of \d+/.test(s.innerText),
    )
    return el ? el.innerText.trim() : ''
  })

/** The value of the date input, YYYY-MM-DD. */
const isoDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

let probeId = null

const cleanup = async () => {
  if (!probeId) return
  try {
    await db.collection('audit_logs').doc(probeId).delete()
    console.log(`Cleaned up the audit entry ${probeId}`)
  } catch (error) {
    console.error(`Could not clean up the audit entry: ${error.message}`)
  }
}

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

  // ---- a known entry ----
  const probe = await db.collection('audit_logs').add({
    actor_id: 'probe-actor',
    actor_name: 'Probe Auditor',
    actor_role: 'admin',
    action: 'report.status',
    entity: 'report',
    entity_id: 'report-0001',
    details: { changed: { status: { from: 'submitted', to: 'under_review' } } },
    created_at: Timestamp.now(),
  })
  probeId = probe.id
  console.log(`Wrote a probe entry ${probeId}`)

  await page.goto(`${BASE}/admin/audit`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('.table tbody tr', { timeout: 20000 })
  await settle(1200)

  /* ---------- the entry is there ---------- */
  let rows = await readRows()
  console.log(`\nRows on the first page: ${rows.length}`)
  console.log(`Summary: ${await summary()}`)
  const probeRow = rows.find((r) => r.includes('Probe Auditor'))
  if (!probeRow) {
    fail.push('the probe entry is not on the first page')
  } else {
    console.log(`Found: ${probeRow.replace(/\n/g, ' | ')}`)
    if (!probeRow.includes('Changed report status')) {
      fail.push('the action label is missing')
    }
    if (!probeRow.includes('status: submitted → under_review')) {
      fail.push('the details are not drawn as "from → to"')
    }
    if (!probeRow.includes('report-0001')) {
      fail.push('the report link is missing')
    }
  }

  /* ---------- the action filter ---------- */
  console.log('\nFiltering by action…')
  await page.select('select[name=action]', 'report.status')
  await settle(1500)
  rows = await readRows()
  const labels = [...new Set(rows.map((r) => r.split('\n')[2]).filter(Boolean))]
  console.log(`Actions on the page: ${JSON.stringify(labels)}`)
  if (rows.some((r) => r.includes('Added a remark'))) {
    fail.push('the action filter let another action through')
  }
  if (!rows.some((r) => r.includes('Changed report status'))) {
    fail.push('the action filter hid the entries it should keep')
  }

  await page.select('select[name=action]', '')
  await settle(1200)

  /* ---------- the date range ---------- */
  console.log('\nMoving the date range…')
  const setFrom = async (value) => {
    await page.evaluate((val) => {
      const el = document.querySelector('input[name=date_from]')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, value)
    await settle(1500)
  }

  // A range that starts after today holds nothing at all.
  await setFrom(isoDate(1))
  rows = await readRows()
  console.log(`Rows with a range that starts tomorrow: ${JSON.stringify(rows)}`)
  if (!rows.some((r) => r.includes('Nothing was recorded'))) {
    fail.push('the date range did not empty the table')
  }

  // A range that covers today brings the entry back.
  await setFrom(isoDate(-30))
  rows = await readRows()
  if (!rows.some((r) => r.includes('Probe Auditor'))) {
    fail.push('the entry did not come back with a wider date range')
  }

  /* ---------- the search ---------- */
  console.log('\nSearching…')
  await page.evaluate(() => {
    const el = document.querySelector('input[name=q]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, 'Probe Auditor')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle(1800)
  rows = await readRows()
  console.log(`Rows for "Probe Auditor": ${rows.length}`)
  if (rows.length !== 1) fail.push(`the search found ${rows.length} rows, expected 1`)
  if (rows[0] && !rows[0].includes('Changed report status')) {
    fail.push('the search found the wrong entry')
  }

  await page.evaluate(() => {
    const el = document.querySelector('input[name=q]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, '')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle(1500)

  /* ---------- the pager ---------- */
  console.log('\nChecking the pager…')
  const before = await summary()
  const hasNext = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')]
    const next = buttons.find((b) => b.innerText.trim() === 'Next')
    return Boolean(next && !next.disabled)
  })
  if (!hasNext) {
    console.log('  only one page of entries, nothing to page through')
  } else {
    await page.evaluate(() => {
      ;[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Next').click()
    })
    await settle(1500)
    const after = await summary()
    console.log(`  ${before} -> ${after}`)
    if (before === after) fail.push('the pager did not move')
  }

  if (problems.length) {
    console.log('\n--- console problems ---')
    for (const p of [...new Set(problems)]) console.log('  ' + p)
  }

  if (fail.length) {
    console.log('\nAUDIT CHECK FAILED')
    for (const f of fail) console.log('  - ' + f)
    await browser.close()
    await cleanup()
    process.exit(1)
  }

  console.log('\nAUDIT CHECK PASSED')
  await browser.close()
  await cleanup()
  process.exit(0)
} catch (error) {
  console.error('\nCHECK FAILED:', error.message)
  if (problems.length) {
    console.error('--- problems ---')
    for (const p of [...new Set(problems)]) console.error('  ' + p)
  }
  await browser.close()
  await cleanup()
  process.exit(1)
}
