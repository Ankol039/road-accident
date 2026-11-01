/** Offline browser check. Start Vite; run `baseline` before edits, then `verify`.
 * All Firebase/Auth calls are fixtures and all external requests are blocked.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const mode = process.argv[2] || 'verify'
assert.ok(['baseline', 'verify'].includes(mode))
const base = process.env.APP_BASE || 'http://127.0.0.1:5173'
const origin = new URL(base).origin
const output = path.resolve('tmp/sidebar-drawer')
const images = path.resolve('output/sidebar-drawer')
fs.mkdirSync(output, { recursive: true })
fs.mkdirSync(images, { recursive: true })
let firestoreMock = fs.readFileSync('tests/summaries-downloads.mjs', 'utf8').match(/const firestoreMock = `([\s\S]*?)`\n/)[1]
firestoreMock = firestoreMock.replace("if (q.name !== 'reports')", `if (q.name === 'notifications') {
  const rows = Array.from({ length: window.__unreadCount }, (_, i) => ({ id: 'fixture-' + i, user_id: 'offline-admin', read: false, title: 'Report update ' + (i + 1), message: 'A report is ready for review.', created_at: '2026-11-01T06:30:00Z' }));
  const docs = rows.map((r) => ({ id: r.id, data: () => r }));
  return { docs, size: docs.length };
}
if (q.name !== 'reports')`)
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync)
assert.ok(chrome)
const browser = await puppeteer.launch({ executablePath: chrome, headless: true,
  userDataDir: path.join(output, `profile-${mode}`), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.emulateTimezone('Asia/Manila')
  await page.evaluateOnNewDocument(() => {
    window.__fixtures = []
    window.__queryLog = []
    window.__mode = 'normal'
    window.__queryDelay = 0
    window.__unreadCount = 3
    const interval = window.setInterval
    window.setInterval = (fn, ms, ...args) => {
      if (ms === 60000) window.__unreadPoll = fn
      return interval(fn, ms, ...args)
    }
  })
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (['blob:', 'data:'].includes(url.protocol)) return req.continue()
    if (url.origin !== origin) return req.abort()
    const respond = (body) => req.respond({ status: 200, contentType: 'application/javascript', body })
    if (url.pathname === '/src/hooks/useAuth.jsx') return respond(`
      export const AuthProvider = ({ children }) => children;
      export const useAuth = () => ({ user: window.__signedOut ? null : { uid: 'offline-admin' }, profile: { role: 'admin', full_name: 'Portal Administrator' }, loading: false, signOut: async () => { window.__signedOut = true; } });
      export const useActor = () => ({ uid: 'offline-admin', role: 'admin' });
    `)
    if (url.pathname === '/src/lib/firebase.js') return respond(`export const auth = {}, db = {}, apiKey = 'offline-fixture', isFirebaseConfigured = true;`)
    if (url.pathname === '/src/lib/firestore.js') return respond(firestoreMock)
    req.continue()
  })
  const go = async (width, height = 900) => {
    await page.setViewport({ width, height })
    await page.goto(`${base}/admin/notifications`)
    await page.waitForSelector('.notif-row')
    await page.waitForFunction(() => document.querySelector('.side-nav .count-pill')?.textContent === '3')
  }
  const visible = (selector) => page.$eval(selector, (el) => {
    const css = getComputedStyle(el)
    return css.display !== 'none' && css.visibility === 'visible' && el.getBoundingClientRect().width > 0
  })
  const noOverflow = async () => {
    const sizes = await page.evaluate(() => ({ window: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth, shell: document.querySelector('.staff-shell').getBoundingClientRect().width }))
    assert.ok(sizes.html <= sizes.window + 1 && sizes.body <= sizes.window + 1 && sizes.shell <= sizes.window + 1, JSON.stringify(sizes))
  }
  const open = async () => {
    await page.click('.staff-menu-toggle')
    await page.waitForFunction(() => document.querySelector('.staff-menu-toggle')?.getAttribute('aria-expanded') === 'true')
    await page.waitForFunction(() => document.querySelector('.sidebar').contains(document.activeElement))
    await page.waitForFunction(() => Math.abs(document.querySelector('.sidebar').getBoundingClientRect().left) < 1)
  }
  const closed = async () => {
    await page.waitForFunction(() => document.querySelector('.staff-menu-toggle')?.getAttribute('aria-expanded') === 'false')
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.sidebar')).visibility === 'hidden')
    assert.equal(await page.$eval('#page', (el) => el.hasAttribute('inert')), false)
  }
  for (const width of [1440, 1024, 992]) {
    await go(width)
    const file = path.join(output, `desktop-${mode}-${width}.png`)
    await page.screenshot({ path: file })
    if (mode === 'verify') {
      assert.equal(await visible('.sidebar'), true)
      assert.equal(await visible('.staff-topbar'), false)
      assert.equal(await visible('.staff-menu-toggle'), false)
      assert.equal(await page.$eval('.sidebar', (el) => el.hasAttribute('inert')), false)
      const before = PNG.sync.read(fs.readFileSync(path.join(output, `desktop-baseline-${width}.png`)))
      const after = PNG.sync.read(fs.readFileSync(file))
      assert.equal(pixelmatch(before.data, after.data, null, before.width, before.height, { threshold: 0 }), 0, `${width}px desktop changed`)
      await noOverflow()
    }
  }
  if (mode === 'baseline') {
    console.log('PASS: captured desktop baselines at 1440, 1024 and 992px.')
  } else {
    for (const width of [991, 768, 390]) {
      await go(width)
      await closed()
      assert.equal(await visible('.staff-topbar'), true)
      assert.equal(await visible('.sidebar'), false)
      assert.equal(await page.$eval('.staff-menu-toggle', (el) => el.getAttribute('aria-label')), 'Open menu')
      assert.equal(await page.$eval('.sidebar', (el) => el.hasAttribute('inert')), true)
      assert.ok(await page.$('.staff-menu-dot'))
      const tap = await page.$eval('.staff-menu-toggle', (el) => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }))
      assert.ok(tap.width >= 44 && tap.height >= 44)
      await noOverflow()
      if (width !== 991) await page.screenshot({ path: path.join(images, `${width}-closed.png`) })
      await page.evaluate(() => { document.body.style.overflow = 'auto' })
      await open()
      assert.equal(await page.$eval('.staff-menu-toggle', (el) => el.getAttribute('aria-label')), 'Close menu')
      assert.equal(await page.$eval('#page', (el) => el.hasAttribute('inert')), true)
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
      const drawerWidth = await page.$eval('.sidebar', (el) => el.getBoundingClientRect().width)
      assert.ok(Math.abs(drawerWidth - Math.min(width * .86, 300)) < 1)
      assert.equal(await page.$$eval('.side-nav a', (links) => links.length), 8)
      assert.equal(await page.$eval('.side-nav .count-pill', (el) => el.textContent), '3')
      await noOverflow()
      if (width !== 991) await page.screenshot({ path: path.join(images, `${width}-open.png`) })
      for (let i = 0; i < 15; i += 1) {
        await page.keyboard.press('Tab')
        assert.ok(await page.evaluate(() => document.querySelector('.sidebar').contains(document.activeElement) || document.activeElement.matches('.staff-menu-toggle')))
      }
      await page.keyboard.down('Shift')
      for (let i = 0; i < 15; i += 1) {
        await page.keyboard.press('Tab')
        assert.ok(await page.evaluate(() => document.querySelector('.sidebar').contains(document.activeElement) || document.activeElement.matches('.staff-menu-toggle')))
      }
      await page.keyboard.up('Shift')
      await page.keyboard.press('Escape')
      await closed()
      assert.equal(await page.evaluate(() => document.activeElement.matches('.staff-menu-toggle')), true)
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto')
      await open()
      await page.mouse.click(width - 10, 450)
      await closed()
      await open()
      await page.click('.side-nav a[href="/admin/notifications"]')
      await closed() // The active link must close even without a route change.
      await open()
      await page.click('.side-nav a[href="/admin/reports"]')
      await closed()
      assert.equal(new URL(page.url()).pathname, '/admin/reports')
      await noOverflow()
      await open()
      await page.evaluate(() => {
        history.pushState({}, '', '/admin/users')
        dispatchEvent(new PopStateEvent('popstate'))
      })
      await closed() // Route changes without a sidebar click must close too.
      await open()
      await page.setViewport({ width: 992, height: 900 })
      await page.waitForFunction(() => !document.querySelector('.staff-shell').classList.contains('is-menu-open'))
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto')
      assert.equal(await visible('.sidebar'), true)
      await page.setViewport({ width, height: 900 })
      await closed()
      // Hidden drawer links cannot receive keyboard focus.
      await page.$eval('.side-nav a', (el) => el.focus())
      assert.equal(await page.evaluate(() => document.querySelector('.sidebar').contains(document.activeElement)), false)
      await page.focus('.skip-link')
      await page.keyboard.press('Enter')
      assert.equal(await page.evaluate(() => document.activeElement.id), 'page')
    }
    await go(390, 300)
    await open()
    assert.ok(await page.$eval('.sidebar', (el) => el.scrollHeight > el.clientHeight))
    for (let i = 0; i < 12; i += 1) {
      const bounds = await page.evaluate(() => ({ top: document.activeElement.getBoundingClientRect().top, bottom: document.activeElement.getBoundingClientRect().bottom, height: innerHeight }))
      assert.ok(bounds.top >= -1 && bounds.bottom <= bounds.height + 1, 'Focused drawer control must scroll into view')
      await page.keyboard.press('Tab')
    }
    await page.keyboard.press('Escape')
    await closed()
    await go(390)
    await page.evaluate(async () => { window.__unreadCount = 0; await window.__unreadPoll() })
    await page.waitForFunction(() => !document.querySelector('.staff-menu-dot'))
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    assert.equal(await page.$eval('.sidebar', (el) => getComputedStyle(el).transitionDuration), '0s')
    await page.emulateMediaFeatures([])
    await open()
    await page.emulateMediaType('print')
    for (const selector of ['.staff-topbar', '.sidebar', '.staff-drawer-backdrop']) assert.equal(await page.$eval(selector, (el) => getComputedStyle(el).display), 'none')
    await page.emulateMediaType(null)
    await page.keyboard.press('Escape')
    await closed()
    // Existing Bootstrap layers and toasts must sit above the drawer.
    const layers = await page.evaluate(() => {
      const modal = document.createElement('div'); modal.className = 'modal'; document.body.append(modal)
      const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop'; document.body.append(backdrop)
      const read = (el) => Number(getComputedStyle(el).zIndex)
      const result = { drawer: read(document.querySelector('.sidebar')), modal: read(modal), modalBackdrop: read(backdrop), toast: read(document.querySelector('.toast-box')) }
      modal.remove(); backdrop.remove(); return result
    })
    assert.ok(layers.drawer < layers.modalBackdrop && layers.drawer < layers.modal && layers.drawer < layers.toast)
    await page.evaluate(() => { document.body.style.overflow = 'auto' })
    await open()
    await page.click('.sidebar-foot button')
    await page.waitForFunction(() => location.pathname === '/login')
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto')
    await go(390)
    await page.evaluate(() => { document.body.style.overflow = 'auto' })
    await open()
    await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')) })
    await page.waitForFunction(() => !document.querySelector('.staff-shell'))
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto')
    assert.deepEqual(errors, [])
    console.log('PASS: six widths; desktop pixel parity; drawer open/close, route/resize/logout/unmount cleanup; keyboard trap, inert, skip link, scroll lock, unread dot/pill, reduced motion, print hiding, and layer ordering.')
    console.log('Screenshots:', images)
  }
} finally { await browser.close() }
