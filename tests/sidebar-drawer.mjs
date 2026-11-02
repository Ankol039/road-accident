/** Offline drawer browser check. Start Vite; run `baseline` before edits, then `verify`.
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
// Optional backup directory allows stable baselines from original sources without
// restoring or otherwise changing the live project files.
let originalServer
let base = process.env.APP_BASE || 'http://127.0.0.1:5173'
if (mode === 'baseline' && process.argv[3]) {
  const { createServer } = await import('vite')
  const source = path.resolve(process.argv[3])
  originalServer = await createServer({
    server: { host: '127.0.0.1', port: 0, open: false },
    plugins: [{ name: 'original-sidebar-baseline', enforce: 'pre', load(id) {
      for (const file of ['src/components/Layout.jsx', 'src/styles/app.css']) {
        if (id === path.resolve(file)) return fs.readFileSync(path.join(source, file), 'utf8')
      }
    } }],
  })
  await originalServer.listen()
  base = 'http://127.0.0.1:' + originalServer.httpServer.address().port
}
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
  const go = async (width, height = 900, route = '/admin/notifications') => {
    await page.setViewport({ width, height })
    await page.goto(`${base}${route}`)
    await page.waitForSelector('.staff-shell')
    await page.waitForFunction(() => document.querySelector('.side-nav .count-pill')?.textContent === '3')
    await page.evaluate(async () => {
      document.body.style.overflow = ''
      await document.fonts.ready
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      await Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect.getComputedTiming().endTime)).map((a) => a.finished.catch(() => {})))
    })
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
    await page.$eval('.rr-menu-drawer', async (el) => {
      await Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished))
    })
    assert.equal(await visible('#site-nav'), true)
    assert.equal(await visible('.rr-nav-label'), true)
    assert.equal(await visible('.sidebar-foot'), true)
  }
  const closed = async () => {
    await page.waitForFunction(() => document.querySelector('.rr-burger')?.getAttribute('aria-expanded') === 'false')
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.rr-menu-drawer')).visibility === 'hidden')
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
    const routes = ['/admin', '/admin/reports', '/admin/summaries', '/admin/users', '/admin/settings', '/admin/audit', '/admin/notifications', '/admin/account']
    const focused = (selector) => page.evaluate((selector) => document.activeElement.matches(selector), selector)
    const waitTransitions = () => page.$eval('.rr-menu-drawer', async (el) => {
      await Promise.all(el.getAnimations().map((animation) => animation.finished))
    })
    for (const width of [390, 820]) {
      for (const route of routes) {
        await go(width, 900, route)
        await closed()
        await navIsHiddenFromAT()
        assert.equal(await page.$eval('.rr-burger', (el) => el.getAttribute('aria-controls')), 'admin-menu-drawer')
        assert.equal(await page.$eval('.rr-burger', (el) => el.getAttribute('aria-label')), 'Open menu')
        await page.focus('.rr-burger')
        await page.$eval('#site-nav a', (el) => el.focus())
        assert.equal(await focused('.rr-burger'), true)
        // Ensure every route has a scrollable background without changing app data.
        await page.$eval('#page', (el) => { el.style.minHeight = '2000px' })
        await page.evaluate(() => scrollTo({ top: 150, behavior: 'instant' }))
        const before = await page.evaluate(() => ({ top: document.querySelector('#page').getBoundingClientRect().top, bar: document.querySelector('.sidebar').getBoundingClientRect().height, barTop: document.querySelector('.sidebar').getBoundingClientRect().top, scroll: scrollY, width: document.querySelector('#page').getBoundingClientRect().width }))
        await open()
        assert.equal(await focused('.rr-menu-close'), true)
        const state = await page.evaluate(() => {
          const drawer = document.querySelector('.rr-menu-drawer')
          const rect = drawer.getBoundingClientRect()
          return {
            top: document.querySelector('#page').getBoundingClientRect().top,
            bar: document.querySelector('.sidebar').getBoundingClientRect().height,
            barTop: document.querySelector('.sidebar').getBoundingClientRect().top,
            scroll: scrollY, width: document.querySelector('#page').getBoundingClientRect().width,
            drawer: { top: rect.top, right: rect.right, height: rect.height, width: rect.width },
            inert: ['#page', '.rr-burger', '.rr-sidebar-brand', '.skip-link'].every((s) => document.querySelector(s).hasAttribute('inert')),
            locked: getComputedStyle(document.documentElement).overflowY === 'hidden',
            role: drawer.getAttribute('role'), modal: drawer.getAttribute('aria-modal'),
            hit: document.elementFromPoint(5, 120).className,
          }
        })
        for (const key of ['top', 'bar', 'barTop', 'scroll', 'width']) assert.equal(state[key], before[key], route + ' page shifted: ' + key)
        assert.equal(state.barTop, 0, 'Sticky bar stays at the top behind the backdrop')
        assert.ok(state.inert && state.locked)
        assert.equal(state.drawer.top, 0)
        assert.equal(state.drawer.right, width)
        assert.equal(state.drawer.height, 900)
        assert.equal(state.drawer.width, Math.min(.85 * width, 320))
        assert.equal(state.role, 'dialog'); assert.equal(state.modal, 'true')
        assert.equal(state.hit, 'rr-menu-backdrop')
        await page.mouse.move(10, 160)
        await page.mouse.wheel({ deltaY: 400 })
        assert.equal(await page.evaluate(() => scrollY), before.scroll)
        for (const selector of ['.rr-burger', '.rr-menu-close']) {
          const target = await page.$eval(selector, (el) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }))
          assert.ok(target.w >= 44 && target.h >= 44)
        }
        await page.keyboard.down('ShiftLeft')
        await page.keyboard.press('Tab')
        await page.keyboard.up('ShiftLeft')
        assert.equal(await focused('.sidebar-foot button'), true)
        await page.keyboard.press('Tab')
        assert.equal(await focused('.rr-menu-close'), true)
        for (let i = 0; i < 20; i++) {
          await page.keyboard.press('Tab')
          assert.equal(await page.evaluate(() => !!document.activeElement.closest('.rr-menu-drawer')), true)
        }
        // No ancestor may create a fixed-position containing block.
        assert.deepEqual(await page.$eval('.rr-menu-drawer', (el) => {
          const bad = []
          for (let node = el.parentElement; node; node = node.parentElement) {
            const c = getComputedStyle(node)
            if (c.transform !== 'none' || c.filter !== 'none' || c.perspective !== 'none' || c.backdropFilter !== 'none' || c.contain !== 'none' || c.willChange.includes('transform')) bad.push(node.className || node.tagName)
          }
          return bad
        }), [])
        await noOverflow()
        if (route === '/admin') await page.screenshot({ path: path.join(images, width + '-open.png') })
        await page.keyboard.press('Escape')
        await closed()
        assert.equal(await focused('.rr-burger'), true)
        assert.equal(await page.evaluate(() => document.body.style.overflow), '')
        assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '')
        await open(); await page.click('.rr-menu-close'); await closed()
        assert.equal(await focused('.rr-burger'), true)
        await open(); await page.mouse.click(5, 120); await closed()
        assert.equal(await focused('.rr-burger'), true)
        await open(); await page.click('#site-nav a[aria-current="page"]'); await closed()
        assert.equal(await focused('.rr-burger'), true)
        const next = route === '/admin/reports' ? '/admin/users' : '/admin/reports'
        await open(); await page.click('#site-nav a[href="' + next + '"]'); await closed()
        assert.equal(new URL(page.url()).pathname, next)
        assert.equal(await focused('#page'), true, 'Navigation focus must win')
        await open()
        await page.evaluate(() => { history.pushState({}, '', '/admin/account'); dispatchEvent(new PopStateEvent('popstate')) })
        await closed()
        assert.equal(await focused('#page'), true, 'External route focus must win')
        console.log('PASS: ' + width + 'px ' + route + ': geometry, scroll lock, focus trap, close/X/backdrop/Escape/links/routes and accessibility.')
      }
    }
    await go(390, 300)
    await open()
    assert.ok(await page.$eval('.rr-menu-drawer', (el) => el.scrollHeight > el.clientHeight))
    await page.focus('.sidebar-foot button')
    const bounds = await page.$eval('.sidebar-foot button', (el) => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom }))
    assert.ok(bounds.top >= -1 && bounds.bottom <= 301, 'Short viewport scrolls logout into view')
    await page.keyboard.press('Escape'); await closed()
    await go(390)
    // Assert that both transitions really run, and only animate transform/opacity.
    await page.click('.rr-burger')
    const animations = await page.$$eval('.rr-menu-drawer, .rr-menu-backdrop', (els) => els.flatMap((el) => el.getAnimations().map((a) => ({ property: a.transitionProperty, duration: a.effect.getTiming().duration }))))
    assert.deepEqual(animations.map((a) => a.property).sort(), ['opacity', 'transform'])
    assert.ok(animations.every((a) => a.duration === 250))
    await waitTransitions()
    await page.setViewport({ width: 1440, height: 900 })
    await page.waitForFunction(() => document.querySelector('.rr-burger').getAttribute('aria-expanded') === 'false')
    assert.equal(await visible('#site-nav'), true)
    assert.equal(await visible('.rr-burger'), false)
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    await page.setViewport({ width: 390, height: 900 }); await closed()
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await open()
    for (const selector of ['.rr-menu-drawer', '.rr-menu-backdrop']) assert.equal(await page.$eval(selector, (el) => getComputedStyle(el).transitionDuration), '0s')
    await page.click('.rr-menu-close'); await closed()
    assert.equal(await page.$eval('.rr-menu-drawer', (el) => el.getAnimations().length), 0)
    await page.emulateMediaFeatures([])
    await open(); await page.emulateMediaType('print')
    for (const selector of ['.sidebar', '.rr-burger']) assert.equal(await page.$eval(selector, (el) => getComputedStyle(el).display), 'none')
    await page.emulateMediaType(null)
    await page.keyboard.press('Escape'); await closed()
    await open(); await page.click('.sidebar-foot button')
    await page.waitForFunction(() => location.pathname === '/login')
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    assert.equal(await page.evaluate(() => window.__signedOut), true)
    await go(390); await open()
    await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')) })
    await page.waitForFunction(() => !document.querySelector('.staff-shell'))
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '')
    assert.deepEqual(errors, [])
    console.log('PASS: exact desktop pixel parity at 992/1024/1440; all eight admin routes at 390/820; short viewport; transitions; reduced motion; resize; print; logout and unmount cleanup.')
    console.log('Screenshots:', images)
  }
} finally { await browser.close(); await originalServer?.close() }
