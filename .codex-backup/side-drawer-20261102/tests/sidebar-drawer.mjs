/** Offline inline-menu browser check (replaces the earlier drawer checks). Start Vite; run `baseline` before edits, then `verify`.
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
    await page.evaluate(() => { document.body.style.overflow = 'auto' })
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
    await page.click('.rr-burger')
    await page.waitForFunction(() => document.querySelector('.rr-burger')?.getAttribute('aria-expanded') === 'true')
    await page.$eval('.rr-burger', async (el) => {
      await Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished))
    })
    assert.equal(await visible('#site-nav'), true)
    assert.equal(await visible('.rr-nav-label'), true)
    assert.equal(await visible('.sidebar-foot'), true)
  }
  const closed = async () => {
    await page.waitForFunction(() => document.querySelector('.rr-burger')?.getAttribute('aria-expanded') === 'false')
    assert.equal(await visible('#site-nav'), false)
    assert.equal(await visible('.rr-nav-label'), false)
    assert.equal(await visible('.sidebar-foot'), false)
    assert.equal(await page.$eval('#page', (el) => el.hasAttribute('inert')), false)
  }
  const cdp = await page.createCDPSession()
  const navIsHiddenFromAT = async () => {
    const { root } = await cdp.send('DOM.getDocument')
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#site-nav' })
    const { node } = await cdp.send('DOM.describeNode', { nodeId })
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: false })
    assert.equal(nodes[0].ignored, true, 'Closed navigation must be excluded from the accessibility tree')
  }
  for (const width of [1440, 1024, 992]) {
    await go(width)
    const file = path.join(output, 'desktop-' + mode + '-' + width + '.png')
    await page.screenshot({ path: file })
    if (mode === 'verify') {
      assert.equal(await visible('.sidebar'), true)
      assert.equal(await visible('#site-nav'), true)
      assert.equal(await visible('.sidebar-foot'), true)
      assert.equal(await visible('.rr-burger'), false)
      assert.equal(await page.$eval('.sidebar', (el) => getComputedStyle(el).width), '248px')
      const before = PNG.sync.read(fs.readFileSync(path.join(output, 'desktop-baseline-' + width + '.png')))
      const after = PNG.sync.read(fs.readFileSync(file))
      assert.equal(pixelmatch(before.data, after.data, null, before.width, before.height, { threshold: 0 }), 0, width + 'px desktop changed')
      await noOverflow()
    }
  }
  if (mode === 'baseline') {
    console.log('PASS: captured desktop baselines at 1440, 1024 and 992px.')
  } else {
    for (const width of [991, 768, 414, 390]) {
      await go(width)
      await closed()
      assert.equal(await visible('.sidebar'), true)
      assert.equal(await visible('.rr-burger'), true)
      assert.equal(await page.$eval('.sidebar', (el) => getComputedStyle(el).position), 'sticky')
      assert.equal(await page.$eval('.staff-shell', (el) => getComputedStyle(el).display), 'block')
      assert.equal(await page.$eval('.sidebar', (el) => el.firstElementChild.matches('.rr-burger')), true)
      assert.equal(await page.$eval('.rr-burger', (el) => el.getAttribute('aria-controls')), 'site-nav')
      assert.equal(await page.$eval('.rr-burger', (el) => el.getAttribute('aria-label')), 'Open menu')
      const tap = await page.$eval('.rr-burger', (el) => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }))
      assert.ok(tap.width >= 44 && tap.height >= 44)
      assert.equal(await page.$eval('.rr-burger', (el) => {
        const button = el.getBoundingClientRect()
        const bar = el.parentElement.getBoundingClientRect()
        return button.top >= bar.top && button.bottom <= bar.bottom
      }), true, 'Closed bar contains the entire menu button')
      await noOverflow()
      await navIsHiddenFromAT()
      // display:none must prevent both programmatic and sequential keyboard focus.
      await page.focus('.rr-burger')
      await page.$eval('#site-nav a', (el) => el.focus())
      assert.equal(await page.evaluate(() => document.activeElement.matches('.rr-burger')), true)
      await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement.closest('#site-nav, .sidebar-foot') !== null), false)
      await page.focus('.rr-burger')
      if ([768, 390].includes(width)) await page.screenshot({ path: path.join(images, width + '-closed.png') })
      await page.evaluate(() => { document.body.style.overflow = 'auto' })
      const beforeMain = await page.$eval('#page', (el) => el.getBoundingClientRect().top)
      await open()
      assert.equal(await page.$eval('.rr-burger', (el) => el.getAttribute('aria-label')), 'Close menu')
      assert.equal(await page.$eval('.sidebar', (el) => el.classList.contains('rr-menu-open')), true)
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto')
      assert.equal(await page.$eval('#page', (el) => el.hasAttribute('inert')), false)
      assert.ok(await page.$eval('#page', (el) => el.getBoundingClientRect().top) > beforeMain + 300, 'Inline list pushes content down')
      assert.equal(await page.$$eval('#site-nav a', (links) => links.length), 8)
      assert.equal(await page.$eval('#site-nav .count-pill', (el) => el.textContent), '3')
      await noOverflow()
      if ([768, 390].includes(width)) await page.screenshot({ path: path.join(images, width + '-open.png') })
      await page.focus('#site-nav a')
      await page.keyboard.press('Escape')
      await closed()
      assert.equal(await page.evaluate(() => document.activeElement.matches('.rr-burger')), true)
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto')
      await open()
      await page.click('.rr-burger')
      await closed()
      await open()
      await page.click('#site-nav a[href="/admin/notifications"]')
      await closed() // Active link closes without changing the route.
      await open()
      await page.click('#site-nav a[href="/admin/reports"]')
      await closed()
      assert.equal(new URL(page.url()).pathname, '/admin/reports')
      await noOverflow()
      await open()
      await page.evaluate(() => {
        history.pushState({}, '', '/admin/users')
        dispatchEvent(new PopStateEvent('popstate'))
      })
      await closed() // Route change without a sidebar click.
      await noOverflow()
      await open()
      await page.setViewport({ width: 992, height: 900 })
      await page.waitForFunction(() => !document.querySelector('.sidebar').classList.contains('rr-menu-open'))
      assert.equal(await visible('#site-nav'), true)
      assert.equal(await visible('.rr-burger'), false)
      await page.setViewport({ width, height: 900 })
      await closed()
      await navIsHiddenFromAT()
      await page.focus('.skip-link')
      await page.keyboard.press('Enter')
      assert.equal(await page.evaluate(() => document.activeElement.id), 'page')
      console.log('PASS: ' + width + 'px inline menu, close actions, accessibility, resize and no overflow.')
    }
    await go(390, 300)
    await open()
    assert.ok(await page.$eval('.sidebar', (el) => el.scrollHeight > el.clientHeight))
    await page.focus('.sidebar-foot button')
    const bounds = await page.$eval('.sidebar-foot button', (el) => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom }))
    assert.ok(bounds.top >= -1 && bounds.bottom <= 301, 'Short viewport scrolls logout into view')
    await page.keyboard.press('Escape')
    await closed()
    await go(390)
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    assert.equal(await page.$eval('.rr-burger-bars', (el) => getComputedStyle(el).transitionDuration), '0s')
    await page.emulateMediaFeatures([])
    await open()
    await page.emulateMediaType('print')
    for (const selector of ['.sidebar', '.rr-burger']) assert.equal(await page.$eval(selector, (el) => getComputedStyle(el).display), 'none')
    await page.emulateMediaType(null)
    await page.keyboard.press('Escape')
    await closed()
    const layers = await page.evaluate(() => {
      const modal = document.createElement('div'); modal.className = 'modal'; document.body.append(modal)
      const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop'; document.body.append(backdrop)
      const read = (el) => Number(getComputedStyle(el).zIndex)
      const result = { menu: read(document.querySelector('.sidebar')), modal: read(modal), modalBackdrop: read(backdrop), toast: read(document.querySelector('.toast-box')) }
      modal.remove(); backdrop.remove(); return result
    })
    assert.ok(layers.menu < layers.modalBackdrop && layers.menu < layers.modal && layers.menu < layers.toast)
    await open()
    await page.click('.sidebar-foot button')
    await page.waitForFunction(() => location.pathname === '/login')
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto')
    assert.equal(await page.evaluate(() => window.__signedOut), true)
    await go(390)
    await open()
    await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')) })
    await page.waitForFunction(() => !document.querySelector('.staff-shell'))
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto')
    assert.deepEqual(errors, [])
    console.log('PASS: seven widths; exact desktop pixel parity; click/Escape/link/route/resize/logout/unmount; hidden navigation accessibility; normal body scrolling; short viewport; reduced motion; print and layer ordering.')
    console.log('Screenshots:', images)
  }
} finally { await browser.close() }
