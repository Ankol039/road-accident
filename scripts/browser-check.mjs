/**
 * Drives the installed Google Chrome against the dev server to prove that a
 * screen really talks to Firestore.
 *
 * We deliberately do NOT use --virtual-time-budget: it starves the network
 * promises Firebase needs, so /login and /admin look stuck on "Loading…".
 * Puppeteer waits on real network events instead.
 *
 * USAGE
 *   node scripts/browser-check.mjs                      # open /admin, signed in
 *   node scripts/browser-check.mjs --path /admin/users
 *   node scripts/browser-check.mjs --path /admin --shot dashboard.png
 *   node scripts/browser-check.mjs --path /admin --wait ".stat-card"
 *
 * Options
 *   --path <route>      route to open after signing in   (default /admin)
 *   --email <address>   admin email  (env ADMIN_EMAIL also works)
 *   --password <pw>     admin password (env ADMIN_PASSWORD also works)
 *   --wait <selector>   wait for this selector before reporting
 *   --shot <file.png>   save a screenshot
 *   --no-signin         do not sign in first
 */
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

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
const ROUTE = arg('path', '/admin')
const EMAIL = arg('email', process.env.ADMIN_EMAIL || 'admin@roadreport.dev')
const PASSWORD = arg('password', process.env.ADMIN_PASSWORD || 'RoadReport!Admin2026')
const WAIT_FOR = arg('wait', null)
const SHOT = arg('shot', null)
const SIGNIN = !has('no-signin')

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
await page.setViewport({ width: 1440, height: 1000 })

const problems = []
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
})
page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
page.on('requestfailed', (req) => {
  const url = req.url()
  if (url.startsWith('data:')) return
  problems.push(`requestfailed: ${url} (${req.failure()?.errorText})`)
})

const settle = async (ms = 1200) => {
  await new Promise((r) => setTimeout(r, ms))
}

try {
  if (SIGNIN) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('#email', { timeout: 20000 })
    await page.type('#email', EMAIL)
    await page.type('#password', PASSWORD)
    await Promise.all([
      page.waitForFunction(() => location.pathname.startsWith('/admin'), { timeout: 30000 }),
      page.click('#login-form button[type=submit]'),
    ])
    console.log(`Signed in as ${EMAIL} -> ${page.url()}`)
  }

  if (ROUTE !== page.url().replace(BASE, '')) {
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  }

  // Give Firestore time to answer before we judge the screen.
  await settle(2500)
  if (WAIT_FOR) {
    await page.waitForSelector(WAIT_FOR, { timeout: 20000 })
  }
  await settle(600)

  const info = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\n{3,}/g, '\n\n').trim()
    return {
      title: document.title,
      path: location.pathname + location.search,
      loading: text.includes('Loading…'),
      text: text.slice(0, 4000),
      counts: {
        tables: document.querySelectorAll('table').length,
        rows: document.querySelectorAll('tbody tr').length,
        panels: document.querySelectorAll('.panel').length,
        cards: document.querySelectorAll('.stat-card').length,
        alerts: document.querySelectorAll('.alert').length,
        modals: document.querySelectorAll('.modal').length,
      },
      alertText: [...document.querySelectorAll('.alert')].map((a) => a.innerText.trim()).slice(0, 5),
    }
  })

  console.log('\n--- page ---')
  console.log('title  :', info.title)
  console.log('path   :', info.path)
  console.log('counts :', JSON.stringify(info.counts))
  if (info.alertText.length) console.log('alerts :', JSON.stringify(info.alertText, null, 2))
  console.log('\n--- text ---\n' + info.text)

  if (SHOT) {
    await page.screenshot({ path: SHOT, fullPage: true })
    console.log(`\nscreenshot -> ${SHOT}`)
  }

  if (problems.length) {
    console.log('\n--- problems ---')
    for (const p of [...new Set(problems)]) console.log('  ' + p)
  } else {
    console.log('\nno console errors, no failed requests')
  }

  await browser.close()
  process.exit(0)
} catch (error) {
  console.error('\nBROWSER CHECK FAILED:', error.message)
  if (problems.length) {
    console.error('--- problems ---')
    for (const p of [...new Set(problems)]) console.error('  ' + p)
  }
  try {
    await page.screenshot({ path: 'browser-check-failure.png', fullPage: true })
    console.error('screenshot -> browser-check-failure.png')
  } catch { /* ignore */ }
  await browser.close()
  process.exit(1)
}
