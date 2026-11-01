/** Offline login motion/interaction checks; no Firebase or real accounts.
 * Run against Vite: node tests/login-motion.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = process.argv.find((value) => value.startsWith('http://')) || process.env.APP_BASE || 'http://127.0.0.1:5181'
const firefox = process.argv.includes('firefox')
const origin = new URL(base).origin
const output = path.resolve('output/login-motion' + (firefox ? '/firefox' : ''))
fs.mkdirSync(output, { recursive: true })
// Close only this test's isolated Chrome if a previous check was interrupted.
if (process.argv.includes('--close-previous')) {
  const port = fs.readFileSync('tmp/login-motion/browser-profile/DevToolsActivePort', 'utf8').split('\n')[0]
  const previous = await puppeteer.connect({ browserURL: `http://127.0.0.1:${Number(port)}` })
  await previous.close()
}
const launch = (reduced = false) => puppeteer.launch({
  browser: firefox ? 'firefox' : 'chrome',
  executablePath: firefox ? '/Applications/Firefox.app/Contents/MacOS/firefox' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  userDataDir: path.resolve('tmp/login-motion/' + (firefox ? 'firefox-profile' : 'browser-profile')),
  args: ['--no-sandbox'],
  extraPrefsFirefox: { 'ui.prefersReducedMotion': reduced ? 1 : 0 },
})
let browser = await launch()
const closeBrowser = async () => {
  const process = browser.process()
  // Some Firefox sessions stall on shutdown after changing media preferences.
  // Bound cleanup to this test's child process so the next viewport can run.
  const timer = setTimeout(() => process?.kill('SIGTERM'), 5000)
  try { await browser.close() } catch (error) { if (!process?.killed) throw error }
  finally { clearTimeout(timer) }
}
const errors = [], checks = [], metrics = []
const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

try {
  let page
  const setupPage = async () => {
  page = await browser.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (['data:', 'blob:'].includes(url.protocol)) return request.continue()
    // All remote transport is blocked, including Firebase. Fonts use fallbacks.
    if (url.origin !== origin) return request.respond({ status: 200, contentType: 'text/css', body: '' })
    const js = (body) => request.respond({ status: 200, contentType: 'application/javascript', body })
    if (url.pathname === '/src/lib/firebase.js') return js('export const auth={},db={},apiKey="offline",isFirebaseConfigured=true;')
    if (url.pathname === '/src/pages/Landing.jsx') return js('export default function Landing(){return null}')
    if (url.pathname === '/src/components/Layout.jsx') return js('export default function Layout(){return null}')
    if (url.pathname === '/src/services/auth.service.js') return js(`
      export const watchAuth=cb=>{queueMicrotask(()=>cb(null));return()=>{}};
      export const signIn=async(email,password)=>{
        window.__submitted={email,password};
        await new Promise(r=>setTimeout(r,400));
        if(window.__reject)throw Object.assign(new Error('Incorrect email or password.'),{code:'auth/invalid-credential'});
        return {uid:'offline'};
      };
      export const signOut=async()=>{};
      export const loadProfile=async()=>({role:'admin',status:'active'});
      export const ensureProfile=async()=>null;
      export const canUsePortal=()=>true;
      export const sendReset=async()=>{window.__reset=true};
      export const changePassword=async()=>{};
    `)
    return request.continue()
  })
  await page.evaluateOnNewDocument(() => {
    window.__shifts = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shifts += entry.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  }
  await setupPage()

  let reducedMode = false
  const go = async (width, reduced = false) => {
    if (firefox && reduced !== reducedMode) {
      await closeBrowser()
      browser = await launch(reduced)
      await setupPage()
      reducedMode = reduced
    }
    if (!firefox) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }])
    await page.setViewport({ width, height: width === 390 ? 844 : 1000 })
    await page.goto(base + '/login', { waitUntil: 'networkidle0' })
    await page.waitForSelector('.rr-login-card')
  }
  const overflow = async () => {
    const sizes = await page.evaluate(() => ({ width: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
    assert.ok(sizes.html <= sizes.width && sizes.body <= sizes.width, JSON.stringify(sizes))
  }
  const geometry = () => page.evaluate(() => Object.fromEntries(
    ['.rr-login-card', 'h1', '#email', '#password', '#password-toggle', 'button[type=submit]', '.rr-login-foot'].map((s) => {
      const { x, y, width, height } = document.querySelector(s).getBoundingClientRect()
      return [s, { x, y, width, height }]
    }),
  ))

  for (const width of [1440, 390]) {
    await go(width)
    await settle(1100)
    await overflow()
    const animatedGeometry = await geometry()
    await page.screenshot({ path: path.join(output, `login-${width}.png`), fullPage: true })
    const animationInfo = await page.evaluate(() => document.getAnimations().map((a) => ({
      name: a.animationName,
      properties: [...new Set(a.effect.getKeyframes().flatMap((f) => Object.keys(f)))],
    })))
    assert.equal(animationInfo.filter((a) => a.name === 'rr-login-streak').length, 46)
    assert.equal(animationInfo.filter((a) => a.name === 'rr-login-grid').length, 0)
    assert.equal(animationInfo.filter((a) => a.name === 'rr-login-signal').length, 3)
    for (const a of animationInfo) {
      assert.ok(a.properties.every((p) => ['offset', 'easing', 'composite', 'computedOffset', 'transform', 'opacity', 'backgroundPosition', 'backgroundPositionX', 'backgroundPositionY'].includes(p)), JSON.stringify(a))
    }
    // Deterministically inspect every phase and each switch boundary.
    for (const [time, lit] of [[0, 2], [1999, 2], [2000, 1], [3999, 1], [4000, 0], [5999, 0], [6000, 2]]) {
      const lamps = await page.evaluate(async (time) => {
        document.getAnimations().filter((a) => a.animationName === 'rr-login-signal').forEach((a) => { a.pause(); a.currentTime = time })
        await new Promise(requestAnimationFrame)
        return [...document.querySelectorAll('.rr-login-lamps span')].map((e) => Number(getComputedStyle(e, '::after').opacity))
      }, time)
      assert.deepEqual(lamps, [0, 1, 2].map((i) => Number(i === lit)), `signal at ${time}ms`)
    }
    await page.evaluate(() => document.getAnimations().forEach((a) => a.play()))

    // The grid stays still while a dense field of depth-based streaks moves.
    const roadState = () => page.evaluate(() => ({
      grid: ['animationName', 'backgroundPosition', 'transform'].map((property) => getComputedStyle(document.querySelector('.rr-login-road'), '::before')[property]),
      streaks: [...document.querySelectorAll('.rr-login-streak')].map((e) => {
        const s = getComputedStyle(e)
        return { transform: s.transform, opacity: Number(s.opacity), top: parseFloat(s.top), length: parseFloat(s.width), duration: parseFloat(s.animationDuration) }
      }),
    }))
    const roadBefore = await roadState()
    await settle(200)
    const roadAfter = await roadState()
    assert.deepEqual(roadAfter.grid, roadBefore.grid, 'perspective grid must stay fixed')
    assert.equal(roadAfter.grid[0], 'none')
    assert.ok(roadAfter.streaks.filter((s) => s.opacity > .1).length >= 30, 'dense traffic throughout the loop')
    assert.ok(roadAfter.streaks.every((s, i) => s.transform !== roadBefore.streaks[i].transform), 'all streaks move')
    const byDepth = [...roadAfter.streaks].sort((a, b) => a.top - b.top)
    assert.ok(byDepth[0].duration > byDepth.at(-1).duration && byDepth[0].length < byDepth.at(-1).length, 'nearer trails are faster and longer')
    // Tape still resets by exactly one tile.
    const loops = await page.evaluate(() => {
      const results = {}
      for (const [name, selector, pseudo] of [['rr-login-stripe', '.rr-login-tape', null]]) {
        const a = document.getAnimations().find((a) => a.animationName === name)
        a.pause(); a.currentTime = 0
        const start = getComputedStyle(document.querySelector(selector), pseudo).backgroundPosition
        a.currentTime = a.effect.getTiming().duration - .001
        const end = getComputedStyle(document.querySelector(selector), pseudo).backgroundPosition
        results[name] = { start, end }
        a.play()
      }
      return results
    })
    assert.ok(Math.abs(parseFloat(loops['rr-login-stripe'].end) - 40) < .01)

    await page.focus('#email')
    await page.type('#email', 'fixture@example.invalid')
    await page.type('#password', 'fixture-only')
    await settle(250)
    assert.equal(await page.$eval('.rr-login-field:focus-within', (e) => getComputedStyle(e, '::after').opacity), '1')
    const beforeToggle = await geometry()
    await page.click('#password-toggle')
    assert.equal(await page.$eval('#password', (e) => e.type), 'text')
    assert.equal(await page.$eval('#password-toggle', (e) => e.getAttribute('aria-pressed')), 'true')
    await settle(70)
    const crossfade = await page.$eval('#password-toggle', (e) => [...e.querySelectorAll('svg')].map((s) => Number(getComputedStyle(s).opacity)))
    assert.ok(crossfade.every((n) => n > 0 && n < 1), `crossfade ${crossfade}`)
    await settle(200)
    await page.keyboard.press(' ')
    assert.equal(await page.$eval('#password', (e) => e.type), 'password')
    await settle(220)
    assert.deepEqual(await geometry(), beforeToggle, 'toggle must not shift layout')
    await page.evaluate(() => { window.__reject = true })
    await page.click('button[type=submit]')
    await page.waitForFunction(() => document.querySelector('button[type=submit]').disabled)
    await page.waitForSelector('#message.rr-login-error')
    await overflow()
    assert.equal(await page.$eval('button[type=submit]', (e) => e.disabled), false)
    await page.click('.btn-link')
    await page.waitForSelector('#message.rr-login-success')
    assert.equal(await page.evaluate(() => window.__reset), true)
    await page.evaluate(() => { window.__reject = false })
    await page.click('button[type=submit]')
    await page.waitForFunction(() => location.pathname === '/admin')
    assert.deepEqual(await page.evaluate(() => window.__submitted), { email: 'fixture@example.invalid', password: 'fixture-only' })

    await go(width, true)
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'all motion disabled')
    assert.deepEqual(await geometry(), animatedGeometry, 'reduced motion retains layout')
    await overflow()
    await page.mouse.move(0, 0)
    const staticBefore = await page.screenshot({ path: path.join(output, `login-reduced-${width}.png`), fullPage: true })
    await settle(1100)
    assert.ok(Buffer.from(await page.screenshot({ fullPage: true })).equals(Buffer.from(staticBefore)), 'reduced motion pixels must remain static')
    assert.deepEqual(await page.$$eval('.rr-login-lamps span', (nodes) => nodes.map((e) => getComputedStyle(e).opacity)), ['0.32', '1', '0.32'])
    await page.click('#password-toggle')
    assert.equal(await page.$eval('.rr-login-eye-off', (e) => getComputedStyle(e).display), 'block')
    await page.click('#password-toggle')
    await page.$eval('#password-toggle', (e) => e.blur())
    await page.mouse.move(0, 0)
    // Density changes must preserve the previous reduced-motion appearance.
    await page.evaluate((css) => {
      document.querySelector('style[data-vite-dev-id$="/src/styles/app.css"]').textContent = css
      document.querySelectorAll('.rr-login-streak').forEach((e) => e.remove())
    }, fs.readFileSync('.codex-backup/login-streak-density/src/styles/app.css', 'utf8'))
    assert.ok(Buffer.from(await page.screenshot({ fullPage: true })).equals(Buffer.from(staticBefore)), 'reduced motion matches the original static design')
    checks.push({ width, animationInfo, loops, crossfade, reducedMotion: 'zero animations; identical pixels after 1.1s', interactions: 'focus, pointer/keyboard toggle, submitting, error, reset, success redirect' })
  }

  await go(1440)
  await settle(1200)
  if (!firefox) {
  const cdp = await page.createCDPSession()
  await cdp.send('Performance.enable')
  const before = (await cdp.send('Performance.getMetrics')).metrics
  await settle(3000)
  const after = (await cdp.send('Performance.getMetrics')).metrics
  for (const name of ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount']) {
    metrics.push({ name, delta: after.find((m) => m.name === name).value - before.find((m) => m.name === name).value })
  }
  assert.equal(metrics.find((m) => m.name === 'LayoutCount').delta, 0, 'ambient motion causes no layout')
  assert.equal(await page.evaluate(() => window.__shifts), 0, 'no layout shifts')
  assert.ok(metrics.find((m) => m.name === 'TaskDuration').delta < .6, 'idle animation main-thread work <20% of sample')
  }
  await overflow()
  assert.deepEqual(errors, [], 'no console/runtime errors')
  fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, metrics, errors }, null, 2))
  console.log('PASS: 1440/390, fixed grid, 46 moving depth-based streaks, one active lamp, seamless tape, form/toggle/auth fixtures, reduced motion pixels, no overflow/errors/layout shifts.', metrics)
} finally {
  await closeBrowser()
}
