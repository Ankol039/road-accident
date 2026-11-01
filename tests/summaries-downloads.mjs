/** Offline browser regression: run Vite, then `node tests/summaries-downloads.mjs`.
 * All Firebase/auth modules are intercepted and every external request is blocked.
 * Downloads and a browser profile stay under tmp/summaries-downloads/.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import puppeteer from 'puppeteer-core'

const base = process.env.APP_BASE || 'http://127.0.0.1:5173'
const origin = new URL(base).origin
const output = path.resolve('tmp/summaries-downloads')
const chrome = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((file) => fs.existsSync(file))
assert.ok(chrome, 'Chrome is required')
fs.mkdirSync(output, { recursive: true })

const fixtures = Array.from({ length: 130 }, (_, i) => ({
  id: `fixture-${i}`, report_code: `RA-TEST-${String(i).padStart(4, '0')}`,
  accident_date: '2026-10-15', accident_time: '10:30',
  location_text: `Road ${i}, near "Market"\nNorth entrance`, barangay: 'Centro', municipality: 'Malolos',
  accident_type_id: 'collision', accident_type_name: 'Collision, "rear-end"', injury_status: 'none',
  officer_name: 'José "Pepe", Cruz', reporter_name: 'Reporter, "Test"',
  status: ['verified', 'in_progress', 'resolved'][i % 3],
}))
fixtures.push(
  { ...fixtures[0], id: 'first', report_code: 'RA-FIRST', accident_date: '2026-10-01' },
  { ...fixtures[0], id: 'last', report_code: 'RA-LAST', accident_date: '2026-10-31' },
  { ...fixtures[0], id: 'public', report_code: 'RA-PUBLIC', status: 'submitted' },
  { ...fixtures[0], id: 'outside-before', report_code: 'RA-OUTSIDE-BEFORE', accident_date: '2026-09-30' },
  { ...fixtures[0], id: 'outside-after', report_code: 'RA-OUTSIDE-AFTER', accident_date: '2026-11-01' },
  { ...fixtures[0], id: 'formula', report_code: '=1+1', accident_type_name: '+SUM(1,2)', officer_name: '-1+2', reporter_name: '@SUM(1,2)' },
)

const firestoreMock = `
export const ref = (name) => ({ name });
export const docRef = (name, id) => ({ name, id });
export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const orderBy = (field, direction) => ({ kind: 'order', field, direction });
export const limit = (value) => ({ kind: 'limit', value });
export const startAfter = (value) => ({ kind: 'cursor', value });
export const query = (ref, ...parts) => ({ ...ref, parts });
export async function getDocs(q) {
  if (q.name !== 'reports') {
    const docs = q.name === 'accident_types' ? [{ id: 'collision', data: () => ({ name: 'Collision' }) }] : [];
    return { docs, size: docs.length };
  }
  window.__queryLog.push(q);
  await new Promise((resolve) => setTimeout(resolve, window.__queryDelay));
  if (window.__loadError) throw new Error('Fixture load failed');
  let rows = window.__mode === 'empty' ? [] : window.__mode === 'cap'
    ? Array.from({ length: 2000 }, (_, i) => ({ ...window.__fixtures[0], id: 'cap-' + i, report_code: 'CAP-' + i, status: i === 0 ? 'verified' : 'submitted' }))
    : [...window.__fixtures];
  for (const p of q.parts || []) {
    if (p.kind === 'where') rows = rows.filter((r) => p.op === '>=' ? r[p.field] >= p.value : p.op === '<=' ? r[p.field] <= p.value : p.op === 'in' ? p.value.includes(r[p.field]) : r[p.field] === p.value);
    if (p.kind === 'order') rows.sort((a, b) => String(a[p.field]).localeCompare(String(b[p.field])) * (p.direction === 'desc' ? -1 : 1));
    if (p.kind === 'limit') rows = rows.slice(0, p.value);
  }
  const docs = rows.map((r) => ({ id: r.id, ref: docRef('reports', r.id), data: () => r }));
  return { docs, size: docs.length };
}
export const fetchCollection = async () => [{ id: 'collision', name: 'Collision' }];
export const fetchDoc = async () => null;
export const getDoc = async () => ({ exists: () => false });
export const readSetting = async (_key, fallback) => fallback;
const deny = () => { throw new Error('Writes are forbidden in this offline check'); };
export const setDoc = deny, addDoc = deny, patchDoc = deny, removeDoc = deny, createDoc = deny;
export const writeBatch = deny, runTransaction = deny;
export const serverTimestamp = () => null, increment = () => null;
`

const browser = await puppeteer.launch({
  executablePath: chrome, headless: true,
  userDataDir: path.join(output, 'browser-profile'),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  const pageErrors = []
  page.on('pageerror', (err) => pageErrors.push(err.message))
  await page.evaluateOnNewDocument((rows) => {
    window.__fixtures = rows
    window.__queryLog = []
    window.__mode = 'normal'
    window.__queryDelay = 80
    window.__loadError = false
    window.__downloadClicks = []
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__downloadClicks.push({ attached: this.isConnected, name: this.download })
      return click.call(this)
    }
  }, fixtures)
  const pdfRequests = []
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (['blob:', 'data:'].includes(url.protocol)) return req.continue()
    if (url.origin !== origin) return req.abort()
    if (/jspdf/.test(url.pathname)) pdfRequests.push(url.pathname)
    const respond = (body) => req.respond({ status: 200, contentType: 'application/javascript', body })
    if (url.pathname === '/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider = ({ children }) => children;
      export const useAuth = () => ({ user: { uid: 'offline-admin' }, profile: { role: 'admin', status: 'active', full_name: 'Offline Admin' }, loading: false, signOut: async () => {} });
      export const useActor = () => ({ uid: 'offline-admin', role: 'admin' });
    `)
    if (url.pathname === '/src/lib/firebase.js') return respond(`export const auth = {}, db = {}, apiKey = 'offline-fixture', isFirebaseConfigured = true;`)
    if (url.pathname === '/src/lib/firestore.js') return respond(firestoreMock)
    return req.continue()
  })
  const client = await browser.target().createCDPSession()
  const reportCsv = 'section.panel.no-print button:first-of-type'
  const reportPdf = 'section.panel.no-print button:last-of-type'
  const summaryCsv = '.rr-summaries-actions button:first-child'
  const enabled = () => page.waitForFunction((selector) => {
    const button = document.querySelector(selector)
    return button && !button.disabled
  }, {}, reportCsv)
  const loaded = () => page.waitForFunction(() => {
    const tbody = document.querySelector('.table-responsive tbody')
    return tbody && !tbody.textContent.includes('Loading…')
  })
  const setDate = (selector, value) => page.$eval(selector, (input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  const downloadFile = async (selector, testCase) => {
    const directory = path.join(output, testCase)
    fs.mkdirSync(directory, { recursive: true })
    await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory, eventsEnabled: true })
    let suggestedName, guid
    const finished = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Download timed out: ' + testCase)) }, 30000)
      const begin = (event) => { suggestedName = event.suggestedFilename; guid = event.guid }
      const progress = (event) => {
        if (event.guid !== guid) return
        if (event.state === 'completed') { cleanup(); resolve() }
        if (event.state === 'canceled') { cleanup(); reject(new Error('Download canceled')) }
      }
      const cleanup = () => { clearTimeout(timeout); client.off('Browser.downloadWillBegin', begin); client.off('Browser.downloadProgress', progress) }
      client.on('Browser.downloadWillBegin', begin)
      client.on('Browser.downloadProgress', progress)
    })
    await page.click(selector)
    await finished
    assert.equal(new URL(page.url()).pathname, testCase === 'reports-page' ? '/admin/reports' : '/admin/summaries')
    const file = path.join(directory, suggestedName)
    assert.ok(fs.statSync(file).size > 100)
    return { file, name: suggestedName, bytes: fs.readFileSync(file) }
  }
  const openCsv = (file) => {
    const result = spawnSync('python3', ['-c',
      'import csv,json,sys; f=open(sys.argv[1],encoding="utf-8-sig",newline=""); print(json.dumps(list(csv.reader(f))))', file], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout)
  }

  await page.goto(`${base}/admin/summaries`)
  await enabled()
  await setDate('#date_from', '2026-10-01')
  await setDate('#date_to', '2026-10-31')
  await page.click('#summary-form button[type="submit"]')
  await enabled()
  assert.equal(pdfRequests.length, 0, 'PDF packages must stay lazy')
  // Draft date edits must not change the exported applied range.
  await setDate('#date_from', '2026-10-15')
  const csv = await downloadFile(reportCsv, 'official-csv')
  assert.equal(csv.name, 'roadreport-reports-2026-10-01_to_2026-10-31.csv')
  assert.deepEqual([...csv.bytes.subarray(0, 3)], [239, 187, 191])
  const records = openCsv(csv.file)
  assert.equal(records.length, 134) // header + 130 regular, two boundaries, one formula
  assert.equal(records[0][0], 'Report ID')
  assert.ok(records.every((row) => row.length === 9))
  assert.ok(records.some((row) => row[0] === 'RA-FIRST'))
  assert.ok(records.some((row) => row[0] === 'RA-LAST'))
  assert.ok(!records.some((row) => /RA-PUBLIC|RA-OUTSIDE/.test(row[0])))
  const regular = records.find((row) => row[0] === 'RA-TEST-0000')
  assert.equal(regular[3], 'Road 0, near "Market"\nNorth entrance, Centro, Malolos')
  assert.equal(regular[4], 'Collision, "rear-end"')
  assert.equal(regular[6], 'José "Pepe", Cruz')
  const formula = records.find((row) => row[0] === "'=1+1")
  assert.ok(formula)
  assert.equal(formula[4], "'+SUM(1,2)")
  assert.equal(formula[6], "'-1+2")
  assert.equal(formula[7], "'@SUM(1,2)")

  const summary = await downloadFile(summaryCsv, 'summary-csv')
  assert.ok(summary.name.includes('month-official-2026-10-01_to_2026-10-31'))
  const summaryRows = openCsv(summary.file)
  assert.equal(summaryRows[0][0], 'Period')
  assert.ok(summaryRows.every((row) => row.length === 10))
  assert.equal(summaryRows.at(-1)[0], 'Total')
  assert.equal(summaryRows.at(-1)[1], '133')

  const pdf = await downloadFile(reportPdf, 'official-pdf')
  assert.equal(pdf.name, 'roadreport-reports-2026-10-01_to_2026-10-31.pdf')
  assert.equal(pdf.bytes.subarray(0, 5).toString(), '%PDF-')
  assert.ok(pdf.bytes.subarray(-30).toString().includes('%%EOF'))
  assert.ok(pdfRequests.length > 0)

  await page.evaluate(() => { window.__queryDelay = 700 })
  await page.click('#export-official')
  assert.equal(await page.$eval(reportCsv, (b) => b.disabled), true)
  assert.equal(await page.$eval(reportPdf, (b) => b.disabled), true)
  assert.equal(await page.$eval(summaryCsv, (b) => b.disabled), true)
  await enabled()
  const allCsv = await downloadFile(reportCsv, 'all-csv')
  assert.ok(openCsv(allCsv.file).some((row) => row[0] === 'RA-PUBLIC'))

  await page.evaluate(() => {
    window.__originalCreateObjectURL = URL.createObjectURL
    URL.createObjectURL = () => { throw new Error('Fixture generation failure') }
  })
  await page.click(reportCsv)
  await page.waitForFunction(() => [...document.querySelectorAll('[role="alert"]')].some((el) => el.textContent.includes('Fixture generation failure')))
  await page.evaluate(() => { URL.createObjectURL = window.__originalCreateObjectURL })
  await enabled()

  await page.evaluate(() => { window.__mode = 'cap'; window.__queryDelay = 80 })
  await page.click('#export-official')
  await enabled()
  await page.waitForSelector('.alert-warning')
  const capCsv = await downloadFile(reportCsv, 'capped-csv')
  assert.equal(openCsv(capCsv.file).length, 2, 'Cap notice must survive filtering 2,000 rows down to one')
  const defaultShape = await page.evaluate(async () => Array.isArray(await (await import('/src/services/stats.service.js')).loadRange()))
  assert.equal(defaultShape, true, 'Other loadRange callers keep the array API')

  await page.evaluate(() => { window.__mode = 'empty' })
  await setDate('#date_from', '2026-10-01')
  await setDate('#date_to', '2026-10-30')
  await page.click('#summary-form button[type="submit"]')
  await loaded()
  for (const selector of [reportCsv, reportPdf, summaryCsv]) assert.equal(await page.$eval(selector, (b) => b.disabled), true)
  await page.evaluate(() => { window.__mode = 'normal'; window.__loadError = true })
  await setDate('#date_to', '2026-10-31')
  await page.click('#summary-form button[type="submit"]')
  await page.waitForFunction(() => document.body.textContent.includes('Fixture load failed'))
  assert.equal(await page.$eval(reportCsv, (b) => b.disabled), true)
  assert.ok(await page.evaluate(() => window.__downloadClicks.every((entry) => entry.attached)))
  const lifecycle = await page.evaluate(async () => {
    const { download } = await import('/src/utils/download.js')
    const originals = { click: HTMLAnchorElement.prototype.click, revoke: URL.revokeObjectURL, timeout: window.setTimeout }
    let attached = false, revoked = false, delay = 0, cleanup
    try {
      HTMLAnchorElement.prototype.click = function () { attached = this.isConnected }
      URL.revokeObjectURL = () => { revoked = true }
      window.setTimeout = (fn, ms) => { cleanup = fn; delay = ms; return 1 }
      download('lifecycle.txt', 'fixture', 'text/plain')
      const revokedSynchronously = revoked
      cleanup()
      return { attached, revokedSynchronously, revokedAfterTimeout: revoked, delay }
    } finally {
      HTMLAnchorElement.prototype.click = originals.click
      URL.revokeObjectURL = originals.revoke
      window.setTimeout = originals.timeout
    }
  })
  assert.equal(lifecycle.attached, true)
  assert.equal(lifecycle.revokedSynchronously, false)
  assert.equal(lifecycle.revokedAfterTimeout, true)
  assert.ok(lifecycle.delay >= 1000)

  await page.goto(`${base}/admin/reports`)
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Export this page') && !b.disabled))
  const reportsSelector = '.rr-reports-actions button:first-child'
  const reportsCsv = await downloadFile(reportsSelector, 'reports-page')
  assert.equal(openCsv(reportsCsv.file)[0][0], 'Report ID')
  assert.deepEqual([...reportsCsv.bytes.subarray(0, 3)], [239, 187, 191])
  assert.deepEqual(pageErrors, [])
  console.log('PASS: CSV/PDF/summary downloads, CSV parsing and injection protection, applied filters, loading/empty/error states, truncation before filtering, and shared Reports CSV.')
  console.log('PDF for inspection:', pdf.file)
} finally {
  await browser.close()
}
