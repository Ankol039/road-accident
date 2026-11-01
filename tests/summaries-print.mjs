/** Offline print regression. Start Vite, run with `baseline` before edits, then `verify`.
 * Uses the download check's Firestore mock; blocks all external traffic and writes.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const mode = process.argv[2] || 'verify'
assert.ok(['baseline', 'verify'].includes(mode))
const base = process.env.APP_BASE || 'http://127.0.0.1:5173'
const origin = new URL(base).origin
const output = path.resolve('tmp/summaries-print')
const deliverables = path.resolve('output/pdf/summaries-print')
fs.mkdirSync(output, { recursive: true })
fs.mkdirSync(deliverables, { recursive: true })
const mockSource = fs.readFileSync('tests/summaries-downloads.mjs', 'utf8')
const firestoreMock = mockSource.match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
const fixtures = Array.from({ length: 24 }, (_, i) => {
  const date = new Date(Date.UTC(2024, 11 + i, 1)).toISOString().slice(0, 10)
  return {
    id: `print-${i}`, report_code: `RA-PRINT-${i}`, accident_date: date, accident_time: '10:30',
    location_text: 'Market entrance', municipality: 'San Jose del Monte, Doña Remedios Trinidad',
    accident_type_id: 'collision', accident_type_name: 'Multi-vehicle collision involving a passenger jeepney and a delivery truck',
    injury_status: i % 2 ? 'none' : 'slight', vehicles: [{ type: 'Jeepney', quantity: 2 }],
    status: 'verified', officer_name: 'Print Officer', reporter_name: 'Print Reporter',
  }
})
const papers = [
  { name: 'a4-landscape', format: 'A4', landscape: true },
  { name: 'a4-portrait', format: 'A4', landscape: false },
  { name: 'letter', format: 'Letter', landscape: false },
]
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync)
assert.ok(chrome)
const browser = await puppeteer.launch({ executablePath: chrome, headless: true,
  userDataDir: path.join(output, `profile-${mode}`), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.emulateTimezone('Asia/Manila')
  await page.evaluateOnNewDocument((rows) => {
    const OriginalDate = Date
    window.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : ['2026-11-01T06:30:00Z'])) }
      static now() { return new OriginalDate('2026-11-01T06:30:00Z').getTime() }
    }
    window.__fixtures = rows
    window.__queryLog = []
    window.__mode = 'normal'
    window.__queryDelay = 30
  }, fixtures)
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (['blob:', 'data:'].includes(url.protocol)) return req.continue()
    if (url.origin !== origin) return req.abort()
    const respond = (body) => req.respond({ status: 200, contentType: 'application/javascript', body })
    if (url.pathname === '/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider = ({ children }) => children;
      export const useAuth = () => ({ user: { uid: 'offline-admin' }, profile: { role: 'admin', full_name: 'Offline Admin' }, loading: false, signOut: async () => {} });
      export const useActor = () => ({ uid: 'offline-admin', role: 'admin' });
    `)
    if (url.pathname === '/src/lib/firebase.js') return respond(`export const auth = {}, db = {}, apiKey = 'offline-fixture', isFirebaseConfigured = true;`)
    if (url.pathname === '/src/lib/firestore.js') return respond(firestoreMock)
    req.continue()
  })
  const setDate = (selector, value) => page.$eval(selector, (input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await page.goto(`${base}/admin/summaries`)
  await page.waitForSelector('#summary-form')
  await setDate('#date_from', '2024-12-01')
  await setDate('#date_to', '2026-11-01')
  await page.click('#summary-form button[type="submit"]')
  await page.waitForFunction(() => !document.querySelector('.rr-summaries-export button').disabled)
  // The print heading must ignore these unsaved changes.
  await page.select('#period', 'year')
  await page.select('#scope', 'all')
  await setDate('#date_from', '2030-01-01')
  await setDate('#date_to', '2030-12-31')
  // Finish chart animation without advancing frozen Date.now().
  await page.evaluate(async () => {
    const { Chart } = await import('/node_modules/.vite/deps/chart__js.js')
    const chart = Chart.getChart(document.querySelector('canvas'))
    chart.options.animation = false
    chart.update('none')
    await document.fonts.ready
  })
  await page.screenshot({ path: path.join(output, `summaries-screen-${mode}.png`), fullPage: true })
  if (mode === 'verify') {
    assert.equal(await page.$eval('.print-only', (el) => getComputedStyle(el).display), 'none')
    for (const paper of papers) {
      // CSS normally requests A4 landscape. Simulate an explicit paper/orientation override as a stress test.
      const override = paper.name === 'a4-landscape' ? null : await page.addStyleTag({
        content: `@media print { @page roadreport-summary { size: ${paper.format} portrait; } }`,
      })
      await page.pdf({ path: path.join(deliverables, `${paper.name}.pdf`), format: paper.format,
        landscape: paper.landscape, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false })
      if (override) await override.evaluate((el) => el.remove())
    }
    await page.emulateMediaType('print')
    assert.equal(await page.$eval('#summary-form', (el) => getComputedStyle(el).display), 'none')
    assert.equal(await page.$eval('.summaries-page .print-only', (el) => getComputedStyle(el).display), 'block')
    const heading = await page.$eval('.summary-print-heading', (el) => el.innerText)
    assert.ok(heading.includes('Grouped by Month'))
    assert.ok(heading.includes('Counting: Verified accident records'))
    assert.ok(heading.includes('2024-12-01 to 2026-11-01'))
    assert.ok(!heading.includes('2030'))
    assert.ok(heading.includes('Generated'))
    await page.emulateMediaType(null)
    // Test zero page margins without shipping them: compare later-page spacing in the resulting PDF.
    const zero = await page.addStyleTag({ content: '@media print { @page roadreport-summary { margin: 0; } .summaries-page { padding: 10mm; } }' })
    await page.pdf({ path: path.join(output, 'zero-margin-experiment.pdf'), format: 'A4', landscape: true,
      preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true })
    await zero.evaluate((el) => el.remove())
  }
  await page.goto(`${base}/admin/reports`)
  await page.emulateMediaType(null)
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((el) => el.textContent.includes('Export this page') && !el.disabled))
  for (const paper of papers) {
    await page.pdf({ path: path.join(output, `reports-${mode}-${paper.name}.pdf`), format: paper.format,
      landscape: paper.landscape, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false })
  }
  assert.deepEqual(errors, [])
  console.log(`PASS: ${mode} print capture; all external requests blocked. PDFs: ${mode === 'verify' ? deliverables : output}`)
} finally { await browser.close() }
