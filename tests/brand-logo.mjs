/** Offline brand/layout verification. No Firebase requests or writes are permitted. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { createServer } from 'vite'

const mode = process.argv[2] || 'verify'
assert.ok(['baseline', 'verify'].includes(mode))
const output = path.resolve('output/brand-logo', mode)
fs.mkdirSync(output, { recursive: true })
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } })
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
const firestoreMock = fs.readFileSync('tests/summaries-downloads.mjs', 'utf8').match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
let browser
const results = [], errors = [], missing = [], assetResponses = []
try {
  browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    userDataDir: path.resolve('tmp/brand-logo', mode), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  await page.emulateTimezone('Asia/Manila')
  await page.evaluateOnNewDocument(() => {
    window.__fixtures = [{ id: 'brand-fixture', report_code: 'RA-DEMO-001', accident_date: '2026-11-02', accident_time: '10:30',
      municipality: 'Malolos', location_text: 'Demo road', accident_type_id: 'collision', accident_type_name: 'Collision',
      injury_status: 'none', status: 'verified', vehicles: [] }]
    window.__queryLog = []; window.__mode = 'normal'; window.__queryDelay = 0
  })
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = new URL(req.url())
    if (['data:', 'blob:'].includes(url.protocol)) return req.continue()
    if (url.origin !== base) return req.abort()
    const respond = body => req.respond({ status: 200, contentType: 'application/javascript', body })
    if (url.pathname === '/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider = ({ children }) => children;
      export const useAuth = () => ({ user: location.pathname === '/login' ? null : { uid: 'offline-admin' }, profile: { role: 'admin', full_name: 'Demo Administrator' }, loading: false, signOut: async () => {} });
      export const useActor = () => ({ uid: 'offline-admin', role: 'admin' });
    `)
    if (url.pathname === '/src/lib/firebase.js') return respond('export const auth = {}, db = {}, apiKey = "offline", isFirebaseConfigured = true;')
    if (url.pathname === '/src/lib/firestore.js') return respond(firestoreMock)
    return req.continue()
  })
  page.on('pageerror', e => errors.push(e.message))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === base && response.status() >= 400) missing.push({ url: url.pathname, status: response.status() })
    if (url.origin === base && /\/(brand\/|favicon|icon-|apple-touch|og-image)/.test(url.pathname)) assetResponses.push({ path: url.pathname, status: response.status(), type: response.headers()['content-type'] })
  })
  const settle = async () => {
    await page.waitForFunction(() => !document.querySelector('.page-loading'))
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map(img => img.decode().catch(() => {})))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})))
    })
  }
  const inspect = async label => {
    const state = await page.evaluate(() => {
      const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
      const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'
      const logos = [...document.querySelectorAll('img.rr-logo')].filter(visible).map(e => ({ ...rect(e), alt: e.alt,
        src: new URL(e.src).pathname, naturalWidth: e.naturalWidth, naturalHeight: e.naturalHeight,
        widthAttribute: e.getAttribute('width'), heightAttribute: e.getAttribute('height'), filter: getComputedStyle(e).filter,
        shadow: getComputedStyle(e).boxShadow, animation: getComputedStyle(e).animationName }))
      const burger = document.querySelector('.rr-burger')
      const lamps = document.querySelector('.rr-login-lamps')
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, logos,
        burger: burger && visible(burger) ? rect(burger) : null, lamps: lamps ? rect(lamps) : null,
        heading: document.querySelector('h1')?.textContent,
        main: document.querySelector('.staff-main') ? rect(document.querySelector('.staff-main')) : null }
    })
    assert.ok(state.scrollWidth <= state.width + 1, `${label}: page overflow`)
    if (mode === 'verify') {
      assert.equal(state.logos.filter(e => e.alt === 'RoadReport').length, 1, `${label}: exactly one named logo`)
      for (const logo of state.logos) {
        assert.ok(logo.naturalWidth > 0 && logo.naturalHeight > 0, `${label}: logo loaded`)
        assert.ok(logo.widthAttribute && logo.heightAttribute, `${label}: reserved aspect ratio`)
        assert.ok(Math.abs(logo.width / logo.height - logo.naturalWidth / logo.naturalHeight) < .01, `${label}: no stretch`)
        assert.ok(logo.height >= 24, `${label}: logo legible`)
        assert.equal(logo.filter, 'none'); assert.equal(logo.shadow, 'none'); assert.equal(logo.animation, 'none')
        assert.ok(logo.x >= 0 && logo.right <= state.width + 1, `${label}: logo fits`)
      }
      const primary = state.logos.find(e => e.alt === 'RoadReport')
      if (state.burger) { assert.equal(primary.height, 28); assert.ok(primary.right + 8 <= state.burger.x, `${label}: burger spacing`) }
      if (state.lamps) { assert.equal(primary.height, 34); assert.ok(primary.right + 8 <= state.lamps.x, `${label}: lamp spacing`) }
      if (state.main && !state.burger) assert.equal(primary.height, 30)
      if (!label.startsWith('drawer')) {
        await page.focus('.rr-logo-link')
        assert.ok(await page.$eval('.rr-logo-link', e => { const s = getComputedStyle(e); return s.outlineStyle === 'solid' && s.outlineWidth === '2px' }), `${label}: focus ring`)
        await page.evaluate(() => document.activeElement.blur())
      }
    }
    results.push({ label, ...state })
  }
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1000 })
    for (const [name, route, selector] of [['login', '/login', '.rr-login-card'], ['landing', '/', '.nav'], ['dashboard', '/admin', '.staff-main h1'], ['reports', '/admin/reports', '.staff-main h1']]) {
      await page.goto(base + route)
      await page.waitForSelector(selector)
      await settle()
      await inspect(`${name}-${width}`)
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: name !== 'landing' })
      if (name === 'landing') {
        await page.$eval('footer', e => e.scrollIntoView({ behavior: 'instant', block: 'end' }))
        await settle()
        await page.screenshot({ path: path.join(output, `landing-footer-${width}.png`) })
        if (mode === 'verify') {
          await page.$eval('.end', e => e.scrollIntoView({ behavior: 'instant', block: 'center' }))
          await settle()
          await page.screenshot({ path: path.join(output, `landing-closing-${width}.png`) })
        }
      }
      if (name === 'dashboard' && width === 390) {
        await page.click('.rr-burger'); await settle()
        await page.waitForFunction(() => document.querySelector('.rr-menu-drawer').getBoundingClientRect().right <= innerWidth + 1)
        await inspect(`drawer-${width}`)
        await page.screenshot({ path: path.join(output, `drawer-${width}.png`) })
        await page.keyboard.press('Escape'); await settle()
        assert.equal(await page.$eval('.rr-burger', e => e.getAttribute('aria-expanded')), 'false')
      }
    }
  }
  if (mode === 'verify') {
    for (const asset of ['favicon.ico', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'og-image.png', ...['horizontal', 'stacked', 'mark'].flatMap(v => ['dark', 'light'].map(t => `brand/logo-${v}-on-${t}.png`))]) {
      const response = await page.goto(`${base}/${asset}`)
      assert.equal(response.status(), 200, asset)
      assert.ok(response.headers()['content-type']?.startsWith('image/'), asset + ': image response')
    }
    await page.goto(base + '/admin/reports')
    await page.waitForSelector('.staff-main h1'); await settle()
    const pdf = await page.evaluate(async () => {
      const { reportPdf } = await import('/src/utils/reportPdf.js')
      const blob = await reportPdf(window.__fixtures, 'Brand verification · November 2026')
      return Array.from(new Uint8Array(await blob.arrayBuffer()))
    })
    fs.writeFileSync(path.join(output, 'report-list.pdf'), Buffer.from(pdf))
    assert.ok(Buffer.from(pdf).subarray(0, 5).toString() === '%PDF-')
  }
  assert.deepEqual(errors, [], 'browser runtime errors')
  assert.deepEqual(missing, [], 'local HTTP errors')
  fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ results, errors, missing, assetResponses, firebase: 'blocked; offline fixtures only' }, null, 2))
  console.log(`PASS ${mode}: ${results.length} screen checks; no runtime errors or local HTTP errors. Screenshots: ${output}`)
} finally {
  await browser?.close()
  await server.close()
}
