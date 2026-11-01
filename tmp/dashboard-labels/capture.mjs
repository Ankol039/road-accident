import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const replacements = { Verified: 'Verified Reports', Closed: 'Closed Reports', Duplicates: 'Duplicated Reports', Flagged: 'Flagged Reports' }
for (const file of ['src/pages/Dashboard.jsx', 'html-mockups/_screens/dashboard/index.html', 'html-mockups/_system/index.html']) {
  const original = fs.readFileSync(`.codex-backup/dashboard-stat-labels/${file}`, 'utf8')
  const expected = file.endsWith('.jsx')
    ? original.replace(/label: '(Verified|Closed|Duplicates|Flagged)'/g, (_, label) => `label: '${replacements[label]}'`)
    : original.replace(/class="stat-label">(Verified|Closed|Duplicates|Flagged)<\/span>/g, (_, label) => `class="stat-label">${replacements[label]}</span>`)
  assert.equal(fs.readFileSync(file, 'utf8'), expected, `Unexpected non-label edit: ${file}`)
}
const base = 'http://127.0.0.1:5173'
const origin = new URL(base).origin
const output = path.resolve('output/dashboard-labels')
fs.mkdirSync(output, { recursive: true })
const firestoreMock = fs.readFileSync('tests/summaries-downloads.mjs', 'utf8').match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, userDataDir: path.resolve('tmp/dashboard-labels/browser-profile'),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.emulateTimezone('Asia/Manila')
  await page.evaluateOnNewDocument(() => {
    const OriginalDate = Date
    window.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : ['2026-11-01T06:30:00Z'])) }
    }
    window.__fixtures = ['on_scene', 'assigned', 'submitted', 'verified', 'resolved', 'rejected', 'duplicate', 'in_progress'].map((status, i) => ({
      id: `fixture-${i}`, report_code: `RA-FIXTURE-${i}`, accident_date: '2026-11-01', accident_time: '10:30',
      location_text: 'Fixture location', municipality: 'Malolos', accident_type_id: 'collision', accident_type_name: 'Collision',
      injury_status: 'none', vehicles: [{ type: 'Car', quantity: 1 }], status, flagged: i === 0,
    }))
    window.__queryLog = []
    window.__queryDelay = 0
    window.__mode = 'normal'
  })
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (['blob:', 'data:'].includes(url.protocol)) return req.continue()
    if (url.origin !== origin) return req.abort()
    const respond = (body) => req.respond({ status: 200, contentType: 'application/javascript', body })
    if (url.pathname === '/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider = ({ children }) => children;
      export const useAuth = () => ({ user: { uid: 'offline-admin' }, profile: { role: 'admin', full_name: 'Portal Administrator' }, loading: false, signOut: async () => {} });
      export const useActor = () => ({ uid: 'offline-admin', role: 'admin' });
    `)
    if (url.pathname === '/src/lib/firebase.js') return respond(`export const auth = {}, db = {}, apiKey = 'offline-fixture', isFirebaseConfigured = true;`)
    if (url.pathname === '/src/lib/firestore.js') return respond(firestoreMock)
    return req.continue()
  })
  const inspect = () => page.$$eval('.stat-card .stat-label', (labels) => labels.map((label) => {
    const box = label.getBoundingClientRect(), card = label.closest('.stat-card').getBoundingClientRect()
    const range = document.createRange(); range.selectNodeContents(label)
    const fits = [...range.getClientRects()].every((rect) => rect.left >= card.left && rect.right <= card.right + 1 && rect.bottom <= card.bottom + 1)
    return { text: label.textContent.trim(), fits, overflow: label.scrollWidth > label.clientWidth + 1, bottom: box.bottom }
  }))
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: width === 390 ? 1200 : 1000 })
    await page.goto(`${base}/admin`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('#cards .stat-label')
    await page.evaluate(async () => {
      const { Chart } = await import('/node_modules/.vite/deps/chart__js.js')
      Object.values(Chart.instances).forEach((chart) => { chart.stop(); chart.options.animation = false; chart.update('none') })
      await document.fonts.ready
    })
    const cards = await inspect()
    assert.deepEqual(cards.map((card) => card.text), ['Officer on scene', 'Needs review', 'Dispatched', 'All reports', 'Verified Reports', 'Closed Reports', 'Duplicated Reports', 'Reported today', 'Flagged Reports'])
    assert.ok(cards.every((card) => card.fits && !card.overflow && card.bottom <= (width === 390 ? 1200 : 1000)))
    await page.screenshot({ path: path.join(output, `dashboard-${width}.png`) })
    await page.goto(`${base}/html-mockups/_screens/dashboard/index.html`, { waitUntil: 'networkidle2' })
    const mockup = await inspect()
    assert.deepEqual(mockup.map((card) => card.text), cards.map((card) => card.text))
    assert.ok(mockup.every((card) => card.fits && !card.overflow))
  }
  assert.deepEqual(errors, [])
  console.log('PASS: only requested label text changed; app and Dashboard mockup labels fit at 1440px and 390px without CSS changes. External requests blocked.')
  console.log('Screenshots:', output)
} finally { await browser.close() }
